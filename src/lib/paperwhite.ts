export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_EDGE = 2048;
export const MAX_FILES = 15;
export const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export type ItemStatus = "queued" | "processing" | "done" | "error";

export type WorkItem = {
  id: string;
  file: File;
  fileName: string;
  originalUrl: string;
  /** Transparent cutout (no white plate). */
  cutoutUrl: string | null;
  resultUrl: string | null;
  status: ItemStatus;
  progress: number;
  message: string;
};

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
    canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.95),
  );
  return blob ?? file;
}

export function isAllowedImage(file: File): { ok: true } | { ok: false; reason: string } {
  const type = (file.type || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif")) {
    return { ok: false, reason: "HEIC is not supported. Export as JPG or PNG." };
  }
  if (!type.startsWith("image/") || (type && !ALLOWED.has(type) && type !== "image/jpg")) {
    return { ok: false, reason: "Use PNG, JPG, or WebP only." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "Over 10 MB. Choose a smaller file." };
  }
  return { ok: true };
}

/**
 * Premium © tnmeds watermark — bottom-right.
 * Small, light, tracked letter-spacing, soft lift on pure white.
 */
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const text = "© tnmeds";
  const shortSide = Math.min(width, height);

  // Keep it small so the product stays the hero
  const fontSize = Math.round(Math.min(18, Math.max(10, shortSide * 0.018)));
  const marginX = Math.round(Math.max(16, shortSide * 0.028));
  const marginY = Math.round(Math.max(14, shortSide * 0.024));

  ctx.save();
  ctx.font = `400 ${fontSize}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  // Subtle tracking (supported in modern browsers)
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.max(0.5, fontSize * 0.06)}px`;
  } catch {
    // ignore if unsupported
  }

  const x = width - marginX;
  const y = height - marginY;

  // Hairline white lift so the mark never looks muddy on #ffffff
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(text, x, y - 0.5);

  // Soft depth
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillText(text, x + 0.5, y + 0.5);

  // Main mark — quiet charcoal, premium opacity
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

/** Remove background on-device and place on pure white. */
export async function removeToWhite(
  file: File,
  onProgress: (p: number, msg: string) => void,
  isCancelled: () => boolean,
): Promise<RemoveResult> {
  onProgress(4, "Preparing your photo…");
  const prepared = await prepareImage(file);
  if (isCancelled()) throw new Error("__cancelled__");

  onProgress(8, "Loading the private background-removal model…");
  const { removeBackground } = await import("@imgly/background-removal");
  if (isCancelled()) throw new Error("__cancelled__");

  const foreground = await removeBackground(prepared, {
    model: "isnet_quint8",
    output: { format: "image/png", quality: 1 },
    progress: (_key: string, current: number, total: number) => {
      if (isCancelled()) return;
      if (total > 0) onProgress(Math.min(75, 8 + Math.round((current / total) * 67)), "Removing background…");
    },
  });
  if (isCancelled()) throw new Error("__cancelled__");

  onProgress(84, "Placing on pure white…");
  const cutoutUrl = URL.createObjectURL(foreground);
  try {
    if (isCancelled()) throw new Error("__cancelled__");
    const resultUrl = await compositeOnWhite(cutoutUrl);
    if (isCancelled()) {
      URL.revokeObjectURL(resultUrl);
      throw new Error("__cancelled__");
    }
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
