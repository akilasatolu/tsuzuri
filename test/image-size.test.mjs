import { test } from "node:test";
import assert from "node:assert/strict";
import { imageSizeOf } from "../.github/scripts/lib/image-size.mjs";

// 各形式の先頭部分だけを組み立てる(大きさの読み取りに必要な部分のみ)
function png(width, height) {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test("PNG・GIF の幅と高さを読む", () => {
  assert.deepEqual(imageSizeOf(png(640, 480), ".png"), { width: 640, height: 480 });
  const gif = Buffer.alloc(13);
  gif.write("GIF89a", 0, "ascii");
  gif.writeUInt16LE(32, 6);
  gif.writeUInt16LE(16, 8);
  assert.deepEqual(imageSizeOf(gif, ".gif"), { width: 32, height: 16 });
});

test("JPEG は SOF マーカーまで読み飛ばして読む", () => {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x02, 0x58, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const jpg = Buffer.from([0xff, 0xd8, ...app0, ...sof0]);
  assert.deepEqual(imageSizeOf(jpg, ".jpg"), { width: 600, height: 300 });
});

test("WebP(VP8X)を読む", () => {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUIntLE(199, 24, 3);
  buf.writeUIntLE(99, 27, 3);
  assert.deepEqual(imageSizeOf(buf, ".webp"), { width: 200, height: 100 });
});

test("SVG は width・height が両方あるときだけ。viewBox だけなら付けない", () => {
  assert.deepEqual(imageSizeOf(Buffer.from('<svg xmlns="x" width="64" height="32px">'), ".svg"), { width: 64, height: 32 });
  assert.equal(imageSizeOf(Buffer.from('<svg viewBox="0 0 64 64">'), ".svg"), null);
  assert.equal(imageSizeOf(Buffer.from('<svg width="100%" height="2em">'), ".svg"), null);
});

test("読めない・壊れたファイルは null", () => {
  assert.equal(imageSizeOf(Buffer.from("fake-png-binary-data"), ".png"), null);
  assert.equal(imageSizeOf(Buffer.alloc(0), ".jpg"), null);
});
