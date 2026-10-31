import {
  BarcodeFormat,
  BinaryBitmap,
  ChecksumException,
  DecodeHintType,
  FormatException,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
} from "@zxing/library";
import type { BarcodeDecoder } from "./decoder";

const FORMATS = new Map<BarcodeFormat, string>([
  [BarcodeFormat.EAN_13, "ean_13"],
  [BarcodeFormat.EAN_8, "ean_8"],
  [BarcodeFormat.UPC_A, "upc_a"],
  [BarcodeFormat.UPC_E, "upc_e"],
  [BarcodeFormat.CODE_128, "code_128"],
  [BarcodeFormat.CODE_39, "code_39"],
  [BarcodeFormat.CODE_93, "code_93"],
  [BarcodeFormat.CODABAR, "codabar"],
  [BarcodeFormat.ITF, "itf"],
  [BarcodeFormat.QR_CODE, "qr_code"],
  [BarcodeFormat.DATA_MATRIX, "data_matrix"],
  [BarcodeFormat.PDF_417, "pdf417"],
  [BarcodeFormat.AZTEC, "aztec"],
]);

export function createZxingDecoder(): BarcodeDecoder {
  const reader = new MultiFormatReader();
  reader.setHints(
    new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [...FORMATS.keys()]],
      [DecodeHintType.TRY_HARDER, true],
      [DecodeHintType.ASSUME_GS1, true],
    ]),
  );
  return {
    async detect(canvas) {
      const source = new HTMLCanvasElementLuminanceSource(canvas);
      try {
        const result = reader.decodeWithState(
          new BinaryBitmap(new HybridBinarizer(source)),
        );
        return [
          {
            rawValue: result.getText(),
            format: FORMATS.get(result.getBarcodeFormat()) ?? "unknown",
          },
        ];
      } catch (error) {
        if (
          error instanceof NotFoundException ||
          error instanceof ChecksumException ||
          error instanceof FormatException
        )
          return [];
        throw error;
      } finally {
        reader.reset();
      }
    },
  };
}
