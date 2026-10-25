import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ナビの横の本文が、長い表や折り返さない長いコード行で列からはみ出さない(ナビに重ならない)ことを確かめる。
// 本文の max-width を列の幅までに抑える指定が、default.css から消えていないかを見る。

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

describe("styles/README.md", () => {
  test("default と、ベース(base.css)・カスタムスタイルの使い方が載っている", () => {
    const readme = fs.readFileSync(path.join(STYLES_DIR, "README.md"), "utf-8");
    for (const word of ["default", "base.css", "THEME"]) {
      assert.ok(readme.includes(word), `styles/README.md に ${word} が載っていない`);
    }
    assert.ok(readme.includes("`default.css`"), "styles/README.md に default.css が載っていない");
  });
});
