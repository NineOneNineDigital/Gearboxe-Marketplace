"use node";

import sharp from "sharp";
import { assertUploadMetadata, MAX_IMAGE_PIXELS } from "./mediaPolicy";

// libvips does not expose APNG frames consistently. Reject its animation
// control chunk explicitly rather than silently keeping only the first frame.
function assertStaticPng(input: Buffer): void {
  let offset = 8;
  while (offset + 12 <= input.length) {
    const size = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    if (size > input.length - offset - 12) throw new Error("Invalid PNG image.");
    if (type === "acTL") throw new Error("Animated photos are not supported.");
    offset += size + 12;
    if (type === "IEND") return;
  }
  throw new Error("Incomplete PNG image.");
}

export async function processImage(
  input: Uint8Array,
  declaredMime: string,
): Promise<{ thumbnail: Uint8Array; detail: Uint8Array }> {
  assertUploadMetadata(declaredMime, input.byteLength);
  const buffer = Buffer.from(input);
  const options = { failOn: "warning" as const, limitInputPixels: MAX_IMAGE_PIXELS };
  try {
    const metadata = await sharp(buffer, options).metadata();
    const actualMime = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[
      metadata.format as "jpeg" | "png" | "webp"
    ];
    if (actualMime !== declaredMime) throw new Error("Photo content does not match its declared type.");
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw new Error("Photos must contain no more than 40 million pixels.");
    }
    if ((metadata.pages ?? 1) !== 1) throw new Error("Animated photos are not supported.");
    if (metadata.format === "png") assertStaticPng(buffer);
    // JPEG decoders can tolerate a missing end marker even with failOn set.
    if (metadata.format === "jpeg" && (buffer.length < 2 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9)) {
      throw new Error("Incomplete JPEG image.");
    }
    // autoOrient consumes EXIF orientation before metadata is stripped by
    // sharp's default WebP output. No original file is published.
    const detail = await sharp(buffer, options)
      .autoOrient()
      .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const thumbnail = await sharp(detail, options)
      .resize({ width: 480, height: 360, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return { thumbnail, detail };
  } catch (error) {
    // Avoid leaking decoder/native implementation details to upload callers.
    const message = error instanceof Error ? error.message : "";
    if (message === "Input image exceeds pixel limit") {
      throw new Error("Photos must contain no more than 40 million pixels.");
    }
    if (/^(Photo content|Photos must contain|Animated photos)/.test(message)) throw error;
    throw new Error("Photo could not be decoded. Upload a complete JPEG, PNG, or WebP image.");
  }
}
