export const SCANNER_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
];
export const MAX_SCANNER_IMAGE_BYTES = 10 * 1024 * 1024;

export function scannerCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge = 1280,
  canvas = document.createElement("canvas"),
): HTMLCanvasElement {
  if (width <= 0 || height <= 0)
    throw new Error("La imagen todavía no está disponible.");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error("No se pudo preparar la imagen para leer el código.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function scannerImage(
  file: File,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  if (!SCANNER_IMAGE_TYPES.includes(file.type))
    throw new Error("Elige una imagen JPG, PNG, WebP, GIF o BMP.");
  if (file.size > MAX_SCANNER_IMAGE_BYTES)
    throw new Error(
      "La imagen supera los 10 MB. Elige una imagen más pequeña.",
    );
  signal.throwIfAborted();
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        image.src = "";
        reject(new DOMException("Lectura cancelada", "AbortError"));
      };
      image.onload = () => {
        signal.removeEventListener("abort", abort);
        resolve();
      };
      image.onerror = () => {
        signal.removeEventListener("abort", abort);
        reject(new Error("No se pudo abrir la imagen. Prueba con otra foto."));
      };
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
    signal.throwIfAborted();
    if (image.naturalWidth * image.naturalHeight > 40000000)
      throw new Error(
        "La imagen tiene demasiada resolución. Reduce su tamaño e inténtalo otra vez.",
      );
    return scannerCanvas(image, image.naturalWidth, image.naturalHeight, 2048);
  } finally {
    image.onload = null;
    image.onerror = null;
    URL.revokeObjectURL(url);
  }
}
