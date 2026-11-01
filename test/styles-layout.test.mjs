import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ナビの横の本文が、長い表や折り返さない長いコード行で列からはみ出さない(ナビに重ならない)ことを確かめる。
// 本文の max-width を列の幅までに抑える指定が、default.css から消えていないかを見る。
// あわせて、狭い画面のナビと本文の幅の指定と、表のセルが潰れないよう最小幅を付ける指定(base.css)も見る。

const STYLES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "styles");
// パッケージに入っているカスタムスタイル(styles/ に置いてあるのは default.css だけ。ほかはギャラリーで配る利用者の管理)
const THEMES = ["default"];
// 左右の余白(24px ずつ)を引いた列の幅までに抑える指定
const FIXED = "max-width: min(var(--content-width), 100% - 48px); justify-self: center; }";
// 直す前の指定(列の幅を見ていない)
const UNFIXED = "max-width: var(--content-width); justify-self: center";

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
});

// 狭い画面で、本文の左右に余白を残して中央に置く(ナビとも揃える)指定
const NARROW_ALIGNED =
  "body > nav, body > main { max-width: min(var(--content-width), 100% - 32px); margin-left: auto; margin-right: auto; }";

describe("狭い画面のナビと本文の幅の CSS", () => {
  for (const theme of THEMES) {
    test(`${theme}.css: ナビと本文を同じ幅にして中央に揃えている`, () => {
      assert.equal(countOf(readCss(theme), NARROW_ALIGNED), 1);
    });
  }
});

// 表のセルが潰れないよう、最小幅を付ける指定(ベース。すべてのスタイルに効く)
const CELL_MIN_WIDTH = "main th, main td { min-width: 10em; }";

describe("表のセルの最小幅の CSS", () => {
  test("base.css: 表のセルに最小幅を付けている", () => {
    assert.equal(countOf(readCss("base"), CELL_MIN_WIDTH), 1);
  });
});

describe("styles/README.md", () => {
  test("default と、ベース(base.css)・カスタムスタイルの使い方が載っている", () => {
    const readme = fs.readFileSync(path.join(STYLES_DIR, "README.md"), "utf-8");
    for (const word of ["default", "base.css", "THEME"]) {
      assert.ok(readme.includes(word), `styles/README.md に ${word} が載っていない`);
    }
    assert.ok(readme.includes("`default.css`"), "styles/README.md に default.css が載っていない");
  });
});
