/**
 * image-size.mjs
 *
 * 画像ファイルの縦横の大きさ(ピクセル)を、ファイルの先頭部分から読み取るモジュール。
 * <img> に width・height を付けて、画像の読み込み中にページのレイアウトがずれないようにするために使う。
 * 依存を増やさないよう、PNG・GIF・JPEG・WebP・SVG の形式だけを自前で読む。
 * 読み取れない形式・壊れたファイルは null を返す(呼び出し側は width・height を付けない)。
 */

/**
 * @param {Buffer} buf - 画像ファイルの中身
 * @param {string} ext - 拡張子(小文字。".png" など)
 * @returns {{ width: number, height: number } | null}
 */
export function imageSizeOf(buf, ext) {
  try {
    const size = ext === ".svg" ? svgSize(buf.toString("utf-8")) : rasterSize(buf);
    if (size && size.width > 0 && size.height > 0) return size;
  } catch {
    // 読み取れない場合は大きさを付けない
  }
  return null;
}

function rasterSize(buf) {
  // PNG: 8バイトの目印の後の IHDR に幅・高さ(ビッグエンディアン)
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: "GIF87a" / "GIF89a" の後に幅・高さ(リトルエンディアン)
  if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP: "RIFF" ... "WEBP" の後のチャンクの種類で読み方が違う
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG: SOF マーカー(0xC0〜0xCF のうち DHT・JPG・DAC を除く)に高さ・幅
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1];
      if (marker === 0xff) {
        offset += 1; // 詰め物の 0xFF
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + buf.readUInt16BE(offset + 2);
    }
  }
  return null;
}

// SVG は、ルート要素に単位なし(または px)の width・height が両方書かれているときだけ大きさを返す。
// viewBox だけの SVG は表示される大きさが決まっていないため、付けない(付けると見た目が変わる)。
function svgSize(text) {
  const root = text.match(/<svg\b[^>]*>/i);
  if (!root) return null;
  const attr = (name) => {
    const m = root[0].match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, "i"));
    return m ? Math.round(Number(m[1])) : 0;
  };
  const width = attr("width");
  const height = attr("height");
  return width && height ? { width, height } : null;
}
