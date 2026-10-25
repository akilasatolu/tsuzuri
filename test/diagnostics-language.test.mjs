import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ビルドスクリプトの診断メッセージ(警告・エラー・ログ)は英語に統一している(日本語のメッセージは持たない)。
// 英語にし忘れた文言が入らないよう、コメントを除いたコードの行に日本語がないことを確かめる。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CJK = /[぀-ヿ一-鿿]/;

const FILES = [
  ".github/scripts/build-docs.mjs",
  ".github/scripts/lib/config.mjs",
  ".github/scripts/lib/frontmatter.mjs",
];

/**
 * 1行から、行末の // コメントを取り除く。文字列("・'・`)の中の // は残す。
 * 行全体がコメント(// ・ * ・ /*)の行は空にする。
 */
function stripComment(line) {
  const trimmed = line.trim();
  if (/^(\/\/|\*|\/\*)/.test(trimmed)) return "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "/" && line[i + 1] === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

test("stripComment: 行末のコメントは取り除き、文字列の中の // と日本語は残す", () => {
  assert.equal(stripComment("const a = 1; // 日本語のコメント").trim(), "const a = 1;");
  assert.equal(stripComment("  // 全体がコメント").trim(), "");
  assert.equal(stripComment("   * JSDoc の行").trim(), "");
  assert.match(stripComment('warn("https://example.com 日本語");'), CJK);
  assert.match(stripComment("warn(`日本語 ${x}`); // コメント"), CJK);
  assert.doesNotMatch(stripComment("warn(`ok ${x}`); // 日本語のコメント"), CJK);
});

for (const rel of FILES) {
  test(`${rel}: コメントを除いたコードに日本語がない(診断メッセージは英語)`, () => {
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    const found = [];
    lines.forEach((line, i) => {
      if (CJK.test(stripComment(line))) found.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
    assert.deepEqual(found, []);
  });
}
