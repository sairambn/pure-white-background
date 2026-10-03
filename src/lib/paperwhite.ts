export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_EDGE = 2048;
export const MAX_FILES = 15;
export const FEATHER_MIN = 0;
export const FEATHER_MAX = 5;
export const FEATHER_DEFAULT = 1;
export const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export type ItemStatus = "queued" | "processing" | "done" | "error";

export type WorkItem = {
  id: string;
  file: File;
  fileName: string;
  originalUrl: string;
  /** Transparent cutout (no white plate) — kept so feather can update live. */
  cutoutUrl: string | null;
  resultUrl: string | null;
  status: ItemStatus;
  progress: number;
  message: string;
};

export type ProcessOptions = {
  /** Soften cutout edge in pixels (0–5). Default 1. */
  featherPx?: number;
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

/** Calligraphy italic watermark in the bottom-right corner. */
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const text = "thiru";
  const shortSide = Math.min(width, height);

  const fontSize = Math.round(Math.min(34, Math.max(14, shortSide * 0.036)));
  const marginX = Math.round(Math.max(12, shortSide * 0.03));
  const marginY = Math.round(Math.max(10, shortSide * 0.026));

  ctx.save();
  ctx.font = `italic 500 ${fontSize}px "Segoe Script", "Apple Chancery", "Brush Script MT", "Palatino Linotype", Georgia, cursive`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  const x = width - marginX;
  const y = height - marginY;

  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  ctx.fillText(text, x + 1, y + 1);

  ctx.fillStyle = "rgba(32, 28, 26, 0.48)";
  ctx.fillText(text, x, y);

  ctx.restore();
}

/** Horizontal then vertical box blur on a single-channel buffer (alpha). */
function boxBlurChannel(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return src;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const span = r * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) {
      const cx = Math.min(w - 1, Math.max(0, x));
      sum += src[row + cx];
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / span;
      const leave = Math.min(w - 1, Math.max(0, x - r));
      const enter = Math.min(w - 1, Math.max(0, x + r + 1));
      sum += src[row + enter] - src[row + leave];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const cy = Math.min(h - 1, Math.max(0, y));
      sum += tmp[cy * w + x];
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      const leave = Math.min(h - 1, Math.max(0, y - r));
      const enter = Math.min(h - 1, Math.max(0, y + r + 1));
      sum += tmp[enter * w + x] - tmp[leave * w + x];
    }
  }

  return out;
}

/**
 * Soften only the alpha edge of a transparent cutout.
 * RGB stays unchanged so product color is preserved.
 */
export function featherCutoutCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  radiusPx: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser could not prepare the cutout.");

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);

  const r = Math.max(0, Math.min(FEATHER_MAX, radiusPx));
  if (r < 0.25) return canvas;

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const alpha = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    alpha[p] = data[i + 3];
  }

  let blurred = boxBlurChannel(alpha, width, height, r);
  blurred = boxBlurChannel(blurred, width, height, Math.max(1, r * 0.6));

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    data[i + 3] = Math.max(0, Math.min(255, Math.round(blurred[p])));
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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

/** Place a transparent cutout on pure white, with optional edge feather + watermark. */
export async function compositeOnWhite(cutoutUrl: string, featherPx = FEATHER_DEFAULT): Promise<string> {
  const image = await loadImage(cutoutUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const feathered =
    featherPx > 0
      ? featherCutoutCanvas(image, width, height, featherPx)
      : (() => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          const cx = c.getContext("2d");
          if (!cx) throw new Error("Your browser could not create the image.");
          cx.drawImage(image, 0, 0);
          return c;
        })();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the image.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(feathered, 0, 0);
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

/**
 * Remove background on-device, feather the edge, place on pure white.
 * Returns both the transparent cutout (for live re-feather) and the white PNG.
 */
export async function removeToWhite(
  file: File,
  onProgress: (p: number, msg: string) => void,
  isCancelled: () => boolean,
  options: ProcessOptions = {},
): Promise<RemoveResult> {
  const featherPx = options.featherPx ?? FEATHER_DEFAULT;

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

  onProgress(84, "Softening edges and placing on pure white…");
  const cutoutUrl = URL.createObjectURL(foreground);
  try {
    if (isCancelled()) throw new Error("__cancelled__");
    const resultUrl = await compositeOnWhite(cutoutUrl, featherPx);
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
