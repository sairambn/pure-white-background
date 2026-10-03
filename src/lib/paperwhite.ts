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

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const text = "thiru";
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.035));
  const padding = Math.max(8, Math.round(fontSize * 0.6));

  ctx.save();
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  // Soft shadow so it stays readable on white
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillText(text, width - padding + 0.5, height - padding + 0.5);

  ctx.fillStyle = "rgba(40, 40, 40, 0.55)";
  ctx.fillText(text, width - padding, height - padding);
  ctx.restore();
}

export async function removeToWhite(
  file: File,
  onProgress: (p: number, msg: string) => void,
  isCancelled: () => boolean,
): Promise<string> {
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

  onProgress(84, "Placing your cutout on pure white…");
  const transparentUrl = URL.createObjectURL(foreground);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not prepare the cutout."));
      image.src = transparentUrl;
    });
    if (isCancelled()) throw new Error("__cancelled__");

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not create the image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    drawWatermark(context, canvas.width, canvas.height);

    const whiteBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the image."))),
        "image/png",
        1,
      );
    });
    if (isCancelled()) throw new Error("__cancelled__");
    return URL.createObjectURL(whiteBlob);
  } finally {
    URL.revokeObjectURL(transparentUrl);
  }
}
