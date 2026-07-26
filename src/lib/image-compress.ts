// Client-side receipt preparation: shrink phone photos before base64 upload.
// A 4MB Android photo becomes ~5.3MB of base64 in a JSON body, which is the
// main cause of flaky mobile uploads. We downscale + re-encode to JPEG so the
// request stays small while receipt text remains legible for AI parsing.

export const UPLOAD_MIMES = ["image/jpeg", "image/png", "application/pdf"] as const;
export type UploadMime = (typeof UPLOAD_MIMES)[number];

const MAX_EDGE = 2000;
const TARGET_BYTES = 1.2 * 1024 * 1024;

/** Types the picker accepts. Anything image-ish (or blank on Android) is normalized to JPEG. */
export function isAcceptableUpload(file: File) {
  const t = (file.type || "").toLowerCase();
  if (t === "application/pdf") return true;
  if (t.startsWith("image/")) return true;
  // Some Android pickers hand over an empty MIME type — fall back to extension.
  if (!t) return /\.(jpe?g|png|heic|heif|webp|pdf)$/i.test(file.name);
  return false;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decode (e.g. some HEIC-tagged JPEGs) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Returns a small JPEG plus its base64 payload. PDFs and anything that fails to
 * decode pass through untouched so nothing ever breaks because of compression.
 */
export async function prepareUpload(
  file: File,
): Promise<{ filename: string; mime: UploadMime; base64: string }> {
  const type = (file.type || "").toLowerCase();
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(file.name);

  if (isPdf) {
    return { filename: file.name, mime: "application/pdf", base64: await fileToBase64(file) };
  }

  try {
    const src = await decode(file);
    const sw = "width" in src ? src.width : 0;
    const sh = "height" in src ? src.height : 0;
    if (!sw || !sh) throw new Error("empty image");

    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas ctx");
    ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    if ("close" in src && typeof src.close === "function") src.close();

    let blob: Blob | null = null;
    for (const q of [0.8, 0.65, 0.5, 0.4]) {
      blob = await toBlob(canvas, q);
      if (blob && blob.size <= TARGET_BYTES) break;
    }
    if (!blob) throw new Error("encode failed");

    const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return {
      filename: `${base}.jpg`.slice(-200),
      mime: "image/jpeg",
      base64: await blobToBase64(blob),
    };
  } catch {
    // Fall back to the original file, as long as the server will accept it.
    const mime: UploadMime = type === "image/png" ? "image/png" : "image/jpeg";
    return { filename: file.name, mime, base64: await fileToBase64(file) };
  }
}

export function fileToBase64(file: Blob): Promise<string> {
  return blobToBase64(file);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      const i = res.indexOf("base64,");
      resolve(i >= 0 ? res.slice(i + 7) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Retry a flaky network call a few times with increasing backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}
