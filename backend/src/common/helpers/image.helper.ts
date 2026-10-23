import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

export const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000;
export const MAX_IMAGE_PIXELS = 12_000_000;
export const MAX_IMAGE_DIMENSION = 8192;
export const ALLOWED_IMAGE_MIME_PATTERN =
  /^data:image\/(?:png|jpe?g|webp);base64,/;

type ImageKind = "png" | "jpeg" | "webp";

export interface ParsedImage {
  mimeType: string;
  kind: ImageKind;
  buffer: Buffer;
  dataUrl: string;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function invalid(): never {
  throw new BadRequestException(
    "Imagen inválida. Envía únicamente una imagen PNG, JPEG o WebP estática, sin archivos ni datos concatenados.",
  );
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function assertPng(buffer: Buffer): void {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) invalid();
  let offset = 8;
  let sawData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) invalid();
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) invalid();
    if (
      crc32(buffer.subarray(offset + 4, end - 4)) !==
      buffer.readUInt32BE(end - 4)
    )
      invalid();
    if (offset === 8 && (type !== "IHDR" || length !== 13)) invalid();
    if (offset !== 8 && type === "IHDR") invalid();
    if (["acTL", "fcTL", "fdAT"].includes(type)) invalid();
    if (type === "IDAT") sawData = true;
    if (type === "IEND") {
      if (length !== 0 || !sawData || end !== buffer.length) invalid();
      return;
    }
    offset = end;
  }
  invalid();
}

function assertJpeg(buffer: Buffer): void {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) invalid();
  let offset = 2;
  let inScan = false;
  let sawScan = false;
  while (offset < buffer.length) {
    if (inScan) {
      if (buffer[offset++] !== 0xff) continue;
    } else if (buffer[offset++] !== 0xff) {
      invalid();
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) invalid();
    const marker = buffer[offset++];
    if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7)))
      continue;
    inScan = false;
    if (marker === 0xd9) {
      if (!sawScan || offset !== buffer.length) invalid();
      return;
    }
    if (marker === 0x01) continue;
    if (marker < 0xc0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7))
      invalid();
    if (offset + 2 > buffer.length) invalid();
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) invalid();
    offset += length;
    if (marker === 0xda) {
      inScan = true;
      sawScan = true;
    }
  }
  invalid();
}

function assertWebp(buffer: Buffer): void {
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP" ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  )
    invalid();
  let offset = 12;
  let images = 0;
  const allowed = ["VP8X", "VP8 ", "VP8L", "ALPH", "ICCP", "EXIF", "XMP "];
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (!allowed.includes(type) || end > buffer.length) invalid();
    if (type === "VP8X" && (size !== 10 || (buffer[offset + 8] & 2) !== 0))
      invalid();
    if (type === "VP8 " || type === "VP8L") images++;
    if (size % 2 && (end >= buffer.length || buffer[end] !== 0)) invalid();
    offset = end + (size % 2);
  }
  if (offset !== buffer.length || images !== 1) invalid();
}

export async function parseImageDataUrl(
  value: unknown,
  maxLength: number = MAX_IMAGE_DATA_URL_LENGTH,
): Promise<ParsedImage> {
  if (typeof value !== "string" || value.length > maxLength) invalid();
  const header = ALLOWED_IMAGE_MIME_PATTERN.exec(value);
  if (!header) invalid();
  const payload = value.slice(header[0].length);
  if (!payload || payload.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(payload))
    invalid();
  const buffer = Buffer.from(payload, "base64");
  if (buffer.toString("base64") !== payload) invalid();
  const declared = header[0].slice(11, -8);
  const kind: ImageKind = declared === "jpg" ? "jpeg" : (declared as ImageKind);
  if (kind === "png") assertPng(buffer);
  else if (kind === "jpeg") assertJpeg(buffer);
  else assertWebp(buffer);

  try {
    const decoder = sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    });
    const metadata = await decoder.metadata();
    if (
      metadata.format !== kind ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS
    )
      invalid();

    // Rebuild from decoded pixels so no original metadata or ancillary payload is retained.
    const { data, info } = await decoder
      .rotate()
      .raw()
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    const encoder = sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    });
    if (kind === "png") encoder.png();
    else if (kind === "jpeg") encoder.jpeg({ quality: 90 });
    else encoder.webp({ lossless: true });
    const clean = await encoder.timeout({ seconds: 5 }).toBuffer();
    const mimeType = `image/${kind}`;
    const dataUrl = `data:${mimeType};base64,${clean.toString("base64")}`;
    if (dataUrl.length > maxLength) {
      throw new BadRequestException(
        "La imagen procesada es demasiado grande. Reduce su resolución.",
      );
    }
    return { mimeType, kind, buffer: clean, dataUrl };
  } catch (error: unknown) {
    if (error instanceof BadRequestException) throw error;
    invalid();
  }
}

export async function parseImageSource(
  value: unknown,
): Promise<string | null | undefined> {
  if (value === undefined || value === null || value === "") return value;
  return (await parseImageDataUrl(value)).dataUrl;
}
