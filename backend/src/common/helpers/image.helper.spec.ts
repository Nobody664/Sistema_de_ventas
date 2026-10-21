import "reflect-metadata";
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import {
  parseImageDataUrl,
  parseImageSource,
  MAX_IMAGE_DATA_URL_LENGTH,
} from "./image.helper";

const toDataUrl = (mime: string, buffer: Buffer): string =>
  `data:${mime};base64,${buffer.toString("base64")}`;
const createImage = (): sharp.Sharp =>
  sharp({
    create: {
      width: 16,
      height: 12,
      channels: 3,
      background: { r: 150, g: 80, b: 30 },
    },
  });
let png: Buffer;
let jpeg: Buffer;
let webp: Buffer;

before(async () => {
  [png, jpeg, webp] = await Promise.all([
    createImage().png().toBuffer(),
    createImage().jpeg().toBuffer(),
    createImage().webp().toBuffer(),
  ]);
});

describe("image decoding and sanitization", () => {
  it("fully decodes real PNG, JPEG, progressive JPEG and WebP and preserves dimensions", async () => {
    const progressive = await createImage()
      .jpeg({ progressive: true })
      .toBuffer();
    for (const [kind, input] of [
      ["png", png],
      ["jpeg", jpeg],
      ["jpeg", progressive],
      ["webp", webp],
    ] as const) {
      const result = await parseImageDataUrl(toDataUrl(`image/${kind}`, input));
      const decoded = await sharp(result.buffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(result.kind, kind);
      assert.equal(decoded.info.width, 16);
      assert.equal(decoded.info.height, 12);
      assert.equal(result.dataUrl, toDataUrl(`image/${kind}`, result.buffer));
    }
  });

  it("strips EXIF metadata and embedded comments instead of storing the original file", async () => {
    const marker = '<?php echo "embedded-payload"; ?>';
    const original = await createImage()
      .withExif({ IFD0: { ImageDescription: marker } })
      .jpeg()
      .toBuffer();
    const comment = Buffer.from(marker);
    const segment = Buffer.alloc(comment.length + 4);
    segment[0] = 0xff;
    segment[1] = 0xfe;
    segment.writeUInt16BE(comment.length + 2, 2);
    comment.copy(segment, 4);
    const withComment = Buffer.concat([
      original.subarray(0, 2),
      segment,
      original.subarray(2),
    ]);
    const clean = await parseImageDataUrl(toDataUrl("image/jpeg", withComment));
    assert.ok(!clean.buffer.includes(Buffer.from(marker)));
    assert.equal((await sharp(clean.buffer).metadata()).exif, undefined);
    assert.notDeepEqual(clean.buffer, withComment);
  });

  it("rejects appended scripts, concatenated images and fake final markers", async () => {
    for (const [mime, image] of [
      ["image/png", png],
      ["image/jpeg", jpeg],
      ["image/webp", webp],
    ] as const) {
      for (const suffix of [
        Buffer.from("<script>attack()</script>"),
        image,
        Buffer.from([0xff, 0xd9]),
      ]) {
        await assert.rejects(
          parseImageDataUrl(toDataUrl(mime, Buffer.concat([image, suffix]))),
          BadRequestException,
        );
      }
    }
  });

  it("rejects fake signatures without real pixel data", async () => {
    const fakeJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xda, 0, 2, 0xff, 0xd9,
    ]);
    const fakeWebp = Buffer.from(
      "524946461000000057454250565038200400000000000000",
      "hex",
    );
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/jpeg", fakeJpeg)),
      BadRequestException,
    );
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/webp", fakeWebp)),
      BadRequestException,
    );
  });

  it("rejects truncated files, corrupted PNG CRCs and mismatched MIME types", async () => {
    const corrupt = Buffer.from(png);
    corrupt[29] ^= 1;
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/png", corrupt)),
      BadRequestException,
    );
    for (const [kind, image] of [
      ["png", png],
      ["jpeg", jpeg],
      ["webp", webp],
    ] as const) {
      await assert.rejects(
        parseImageDataUrl(
          toDataUrl(`image/${kind}`, image.subarray(0, image.length - 4)),
        ),
        BadRequestException,
      );
    }
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/png", jpeg)),
      BadRequestException,
    );
  });

  it("rejects SVG, GIF, BMP, ICO, HTML and executable payloads", async () => {
    for (const mime of [
      "image/svg+xml",
      "image/gif",
      "image/bmp",
      "image/x-icon",
      "text/html",
    ]) {
      await assert.rejects(
        parseImageDataUrl(toDataUrl(mime, png)),
        BadRequestException,
      );
    }
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/png", Buffer.from("MZ executable"))),
      BadRequestException,
    );
  });

  it("rejects malformed, noncanonical or concatenated Base64 including trailing newlines", async () => {
    const valid = toDataUrl("image/png", png);
    for (const value of [
      null,
      {},
      "",
      "data:image/png;base64,x",
      `${valid}\n`,
      `${valid}${valid}`,
      `${valid} `,
      "data:image/png;base64,AAAA====",
      "data:image/png;base64,AA_A",
      "data:image/png;name=x;base64,AAAA",
    ]) {
      await assert.rejects(parseImageDataUrl(value), BadRequestException);
    }
  });

  it("enforces encoded size, pixel count and dimension limits", async () => {
    await assert.rejects(
      parseImageDataUrl("x".repeat(MAX_IMAGE_DATA_URL_LENGTH + 1)),
      BadRequestException,
    );
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/png", png), 20),
      BadRequestException,
    );
    for (const [width, height] of [
      [4000, 4000],
      [8193, 1],
    ]) {
      const large = await sharp({
        create: { width, height, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      await assert.rejects(
        parseImageDataUrl(toDataUrl("image/png", large)),
        BadRequestException,
      );
    }
  });

  it("rejects animated WebP", async () => {
    const frames = Buffer.concat([
      Buffer.alloc(2 * 2 * 3, 30),
      Buffer.alloc(2 * 2 * 3, 200),
    ]);
    const animated = await sharp(frames, {
      raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    assert.equal((await sharp(animated).metadata()).pages, 2);
    await assert.rejects(
      parseImageDataUrl(toDataUrl("image/webp", animated)),
      BadRequestException,
    );
  });
});

describe("optional image fields", () => {
  it("preserves missing values and explicit clearing", async () => {
    assert.equal(await parseImageSource(undefined), undefined);
    assert.equal(await parseImageSource(null), null);
    assert.equal(await parseImageSource(""), "");
  });

  it("rejects external URLs and other schemes rather than trusting their extension", async () => {
    for (const value of [
      "https://example.com/logo.png",
      "http://example.com/image.jpg",
      "javascript:alert(1)",
      "file:///image.png",
      "/image.png",
    ]) {
      await assert.rejects(parseImageSource(value), BadRequestException);
    }
  });
});
