import { MAX_EDGE } from "./batch";

export {
  MAX_BYTES,
  MAX_EDGE,
  MAX_FILES,
  CONCURRENCY,
  ALLOWED,
  type ItemStatus,
  type WorkItem,
  type AcceptResult,
  isAllowedImage,
  createWorkItem,
  acceptFiles,
  releaseItemUrls,
  releaseAll,
  BatchStore,
} from "./batch";

/** Downscale very large images so mobile devices stay stable. */
export async function prepareImage(file: File): Promise<File | Blob> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) {
    bitmap.close();
    return file;
  }

  const scale = MAX_EDGE / longest;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  return blob ?? file;
}

/**
 * Premium © tnmeds watermark — bottom-right.
 * Small, light, tracked letter-spacing, soft lift on pure white.
 */
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const text = "© tnmeds";
  const shortSide = Math.min(width, height);

  const fontSize = Math.round(Math.min(18, Math.max(10, shortSide * 0.018)));
  const marginX = Math.round(Math.max(16, shortSide * 0.028));
  const marginY = Math.round(Math.max(14, shortSide * 0.024));

  ctx.save();
  ctx.font = `400 ${fontSize}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.max(0.5, fontSize * 0.06)}px`;
  } catch {
    // ignore if unsupported
  }

  const x = width - marginX;
  const y = height - marginY;

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(text, x, y - 0.5);

  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillText(text, x + 0.5, y + 0.5);

  ctx.fillStyle = "rgba(40, 40, 40, 0.32)";
  ctx.fillText(text, x, y);

  ctx.restore();
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not prepare the cutout."));
    image.src = url;
  });
  return image;
}

/** Place a transparent cutout on pure white + watermark. */
export async function compositeOnWhite(cutoutUrl: string): Promise<string> {
  const image = await loadImage(cutoutUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the image.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0);
  drawWatermark(context, width, height);

  const whiteBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the image."))),
      "image/png",
      1,
    );
  });
  return URL.createObjectURL(whiteBlob);
}

export type RemoveResult = {
  cutoutUrl: string;
  resultUrl: string;
};

/** Shared model import — loaded once, then cached by the browser. */
let modelModule: Promise<typeof import("@imgly/background-removal")> | null = null;

function getModel() {
  if (!modelModule) {
    modelModule = import("@imgly/background-removal");
  }
  return modelModule;
}

/** CDN path for WASM + ONNX model assets (must match installed package version). */
export const MODEL_PUBLIC_PATH =
  "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";

/** Warm the model on page load so the first photo is faster. */
export async function preloadModel(): Promise<void> {
  try {
    const { removeBackground } = await getModel();
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 64, 64);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
    if (!blob) return;
    await removeBackground(blob, {
      model: "isnet_quint8",
      device: "cpu",
      publicPath: MODEL_PUBLIC_PATH,
      output: { format: "image/png", quality: 0.9 },
    }).catch(() => {
      // Preload is best-effort
    });
  } catch {
    // Preload is best-effort
  }
}

/** Remove background on-device and place on pure white — optimized for speed. */
export async function removeToWhite(
  file: File,
  onProgress: (p: number, msg: string) => void,
  isCancelled: () => boolean,
): Promise<RemoveResult> {
  onProgress(5, "Preparing…");
  const prepared = await prepareImage(file);
  if (isCancelled()) throw new Error("__cancelled__");

  onProgress(12, "Loading model…");
  const { removeBackground } = await getModel();
  if (isCancelled()) throw new Error("__cancelled__");

  const progress = (_key: string, current: number, total: number) => {
    if (isCancelled() || total <= 0) return;
    onProgress(Math.min(80, 12 + Math.round((current / total) * 68)), "Removing background…");
  };

  const base = {
    model: "isnet_quint8" as const,
    publicPath: MODEL_PUBLIC_PATH,
    output: { format: "image/png" as const, quality: 0.95 },
    progress,
  };

  let foreground: Blob | null = null;
  let lastError: unknown;

  for (const device of ["gpu", "cpu"] as const) {
    if (isCancelled()) throw new Error("__cancelled__");
    try {
      onProgress(device === "gpu" ? 14 : 18, device === "gpu" ? "Trying GPU…" : "Running on CPU…");
      foreground = await removeBackground(prepared, { ...base, device });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      foreground = null;
    }
  }

  if (!foreground) {
    const raw = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
    if (/failed to fetch|networkerror|net::|load failed|ERR_/i.test(raw)) {
      throw new Error("Could not download the AI model. Check your internet and try again.");
    }
    if (/publicPath|session|backend|wasm/i.test(raw)) {
      throw new Error("Model failed to start in this browser. Try Chrome or Edge, or reload.");
    }
    throw new Error(raw.slice(0, 180) || "Background removal failed.");
  }

  if (isCancelled()) throw new Error("__cancelled__");

  onProgress(88, "Finishing…");
  const cutoutUrl = URL.createObjectURL(foreground);
  try {
    if (isCancelled()) throw new Error("__cancelled__");
    const resultUrl = await compositeOnWhite(cutoutUrl);
    if (isCancelled()) {
      URL.revokeObjectURL(resultUrl);
      throw new Error("__cancelled__");
    }
    onProgress(100, "Ready");
    return { cutoutUrl, resultUrl };
  } catch (error) {
    URL.revokeObjectURL(cutoutUrl);
    throw error;
  }
}

/** CRC32 for ZIP (STORE method). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Build a ZIP (STORE) from named binary files — no extra dependency. */
export function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);

    localParts.push(localHeader, file.data);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(central);
    offset += localHeader.length + size;
  }

  const centralDir = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  const zipBytes = concat([...localParts, centralDir, end]);
  return new Blob([zipBytes], { type: "application/zip" });
}

/** Download every ready white PNG as one ZIP. */
export async function downloadAllAsZip(
  items: { fileName: string; resultUrl: string }[],
): Promise<void> {
  const files: { name: string; data: Uint8Array }[] = [];
  const used = new Set<string>();

  for (const item of items) {
    const res = await fetch(item.resultUrl);
    const buf = new Uint8Array(await res.arrayBuffer());
    let base = (item.fileName.replace(/\.[^.]+$/, "") || "photo").replace(/[^\w\-]+/g, "_");
    if (!base) base = "photo";
    let name = `${base}-white.png`;
    let n = 2;
    while (used.has(name)) {
      name = `${base}-white-${n}.png`;
      n += 1;
    }
    used.add(name);
    files.push({ name, data: buf });
  }

  if (files.length === 0) return;

  const blob = buildZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "paperwhite.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
