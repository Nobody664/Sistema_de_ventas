export interface ScanResult {
  rawValue: string;
  format: string;
}

export interface BarcodeDecoder {
  detect(source: HTMLCanvasElement): Promise<ScanResult[]>;
}

const FORMATS = [
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "code_93",
  "upc_a",
  "upc_e",
  "codabar",
  "itf",
  "qr_code",
  "data_matrix",
  "pdf417",
  "aztec",
];

interface NativeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDecoder;
  getSupportedFormats(): Promise<string[]>;
}

export async function createBarcodeDecoder(): Promise<BarcodeDecoder> {
  let native: BarcodeDecoder | null = null;
  const constructor = (
    globalThis as typeof globalThis & {
      BarcodeDetector?: NativeDetectorConstructor;
    }
  ).BarcodeDetector;
  if (constructor) {
    try {
      const supported = await constructor.getSupportedFormats();
      const formats = FORMATS.filter((format) => supported.includes(format));
      if (formats.length) native = new constructor({ formats });
    } catch {
      native = null;
    }
  }

  let fallback: Promise<BarcodeDecoder> | null = null;
  return {
    async detect(source) {
      if (native) {
        try {
          const results = await native.detect(source);
          const found = results.filter((result) => result.rawValue?.length > 0);
          if (found.length)
            return found.map((result) => ({
              rawValue: result.rawValue,
              format: result.format ?? "unknown",
            }));
        } catch {
          native = null;
        }
      }
      if (!fallback) {
        fallback = import("./zxing-decoder")
          .then((module) => module.createZxingDecoder())
          .catch((error: unknown) => {
            fallback = null;
            throw error;
          });
      }
      return (await fallback).detect(source);
    },
  };
}
