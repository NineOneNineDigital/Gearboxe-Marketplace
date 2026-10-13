import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { assertUploadMetadata, MAX_UPLOAD_BYTES } from "../convex/lib/mediaPolicy.ts";

// The application uses bundler resolution; Node's stripped-TypeScript runner
// needs the file suffix for runtime imports between these server helpers.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
const { processImage } = await import("../convex/lib/imageProcessing.ts");

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
const makeImage = (width = 120, height = 80) => sharp({ create: { width, height, channels: 3, background: "#2478cf" } });

test("upload policy rejects unsupported types, empty files, and invalid or excessive sizes", () => {
  for (const mime of ["image/svg+xml", "image/gif", "application/octet-stream", "image/jpeg; charset=utf-8"]) {
    assert.throws(() => assertUploadMetadata(mime, 100), /JPEG, PNG, or WebP/);
  }
  for (const size of [0, -1, 1.5, NaN, Infinity, MAX_UPLOAD_BYTES + 1]) {
    assert.throws(() => assertUploadMetadata("image/jpeg", size), /10 MiB/);
  }
  assertUploadMetadata("image/webp", MAX_UPLOAD_BYTES);
});

test("optimized images respect EXIF rotation and remove identifying metadata", async () => {
  const original = await makeImage(2400, 1200)
    .withExif({ IFD0: { Artist: "private owner", Model: "private camera" } })
    .withMetadata({ orientation: 6 })
    .jpeg().toBuffer();
  assert.ok((await sharp(original).metadata()).exif);
  const result = await processImage(original, "image/jpeg");
  for (const [name, width, height] of [["detail", 720, 1440], ["thumbnail", 180, 360]]) {
    const metadata = await sharp(result[name]).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    for (const field of ["exif", "icc", "iptc", "xmp", "orientation"]) assert.equal(metadata[field], undefined);
    assert.ok(result[name].byteLength < original.byteLength);
  }
});

test("small images are never enlarged and each accepted format produces WebP variants", async () => {
  for (const [format, mime] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    const result = await processImage(await makeImage()[format]().toBuffer(), mime);
    for (const image of Object.values(result)) {
      const metadata = await sharp(image).metadata();
      assert.equal(metadata.width, 120); assert.equal(metadata.height, 80);
      assert.equal(metadata.format, "webp");
    }
  }
});

test("server validation rejects spoofed MIME, unsupported contents, and incomplete images", async () => {
  const png = await makeImage().png().toBuffer();
  const jpeg = await makeImage().jpeg().toBuffer();
  await assert.rejects(processImage(png, "image/jpeg"), /does not match/);
  for (const input of [Buffer.from("not an image"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), png.subarray(0, png.length - 5), jpeg.subarray(0, Math.floor(jpeg.length / 2))]) {
    await assert.rejects(processImage(input, "image/png"));
  }
  await assert.rejects(processImage(jpeg.subarray(0, Math.floor(jpeg.length / 2)), "image/jpeg"), /could not be decoded/);
  await assert.rejects(processImage(jpeg.subarray(0, jpeg.length - 1), "image/jpeg"), /could not be decoded/);
});

test("oversized pixel headers are rejected before decompression", async () => {
  const png = await makeImage().png().toBuffer();
  png.writeUInt32BE(10000, 16); png.writeUInt32BE(5000, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  await assert.rejects(processImage(png, "image/png"), /40 million pixels/);
});

test("animated WebP and APNG uploads are rejected rather than silently taking one frame", async () => {
  const pixels = Buffer.alloc(20 * 40 * 3);
  pixels.fill(255, 0, 20 * 20 * 3);
  const webp = await sharp(pixels, { raw: { width: 20, height: 40, channels: 3, pageHeight: 20 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(webp).metadata()).pages, 2);
  await assert.rejects(processImage(webp, "image/webp"), /Animated/);
  const png = await makeImage().png().toBuffer();
  const animationChunk = Buffer.alloc(20);
  animationChunk.writeUInt32BE(8, 0); animationChunk.write("acTL", 4);
  animationChunk.writeUInt32BE(2, 8);
  animationChunk.writeUInt32BE(crc32(animationChunk.subarray(4, 16)), 16);
  const apng = Buffer.concat([png.subarray(0, 33), animationChunk, png.subarray(33)]);
  await assert.rejects(processImage(apng, "image/png"), /Animated/);
});
