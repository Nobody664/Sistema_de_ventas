export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/webp';
}

export function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Selecciona una imagen PNG, JPEG o WebP'));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error('La imagen no debe exceder 10MB'));
  }
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const resolved = resolveCompressed(img, maxWidth, maxHeight, quality, format);
        resolve(resolved);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = url;
  });
}

function resolveCompressed(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  format: string,
): string {
  let { width, height } = img;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const result = canvas.toDataURL(format, quality);
  if (result.length > 2_000_000) throw new Error('La imagen es demasiado grande; reduce su resolución');
  return result;
}
