import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_THEMES } from "../.github/scripts/lib/config.mjs";

// ナビの横の本文が、長い表や折り返さない長いコード行で列からはみ出さない(ナビに重ならない)ことを確かめる。
// 本文の max-width を列の幅までに抑える指定が、8テーマの CSS から消えていないかを見る。

const STYLES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "styles");
const THEMES = ALLOWED_THEMES.filter((t) => t !== "none"); // 組み込みテーマ(CSSがあるもの)
// 左右の余白(24px ずつ)を引いた列の幅までに抑える指定
const FIXED = "max-width: min(var(--content-width), 100% - 48px); justify-self: center; }";
// 直す前の指定(列の幅を見ていない)
const UNFIXED = "max-width: var(--content-width); justify-self: center";
// 左右の余白を 0 に上書きしているテーマの指定
const NO_MARGIN_THEMES = ["editorial", "minimal"];
const NO_MARGIN_FIXED = "body:has(> nav) > main { margin: 0 auto; max-width: min(var(--content-width), 100%); }";

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

function readCss(theme) {
  return fs.readFileSync(path.join(STYLES_DIR, `${theme}.css`), "utf8");
}

describe("ナビの横の本文の幅の CSS", () => {
  for (const theme of THEMES) {
    test(`${theme}.css: 本文の max-width を列の幅までに抑えている`, () => {
      const css = readCss(theme);
      assert.equal(countOf(css, FIXED), 1);
      assert.equal(countOf(css, UNFIXED), 0);
    });
  }

  for (const theme of NO_MARGIN_THEMES) {
    test(`${theme}.css: 左右の余白を 0 にした本文も列の幅までに抑えている`, () => {
      assert.equal(countOf(readCss(theme), NO_MARGIN_FIXED), 1);
    });
  }
});

describe("styles/README.md", () => {
  test("組み込みテーマ(と none)がすべて載っている", () => {
    const readme = fs.readFileSync(path.join(STYLES_DIR, "README.md"), "utf-8");
    for (const theme of ALLOWED_THEMES) {
      assert.ok(readme.includes(`\`${theme}\``), `styles/README.md に ${theme} が載っていない`);
    }
  });
});
