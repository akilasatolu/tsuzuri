import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { slugify, createSlugger, htmlToText } from "../.github/scripts/lib/slugger.mjs";

describe("slugify(GitHub互換)", () => {
  test("小文字化し、空白をハイフンにする", () => {
    assert.equal(slugify("Getting Started"), "getting-started");
  });
  test("記号は取り除き、ハイフンとアンダースコアは残す", () => {
    assert.equal(slugify("What's new? (v2.0)"), "whats-new-v20");
    assert.equal(slugify("snake_case-name"), "snake_case-name");
  });
  test("日本語や全角括弧を含む見出し", () => {
    assert.equal(slugify("テーマ・スタイル(Theming)"), "テーマスタイルtheming");
    assert.equal(slugify("組み込みテーマ一覧"), "組み込みテーマ一覧");
  });
  test("前後の空白は除き、連続した空白はそれぞれハイフンになる", () => {
    assert.equal(slugify("  a  b "), "a--b");
  });
});

describe("createSlugger", () => {
  test("同じページで重複した見出しには -1, -2 を付ける", () => {
    const s = createSlugger();
    assert.equal(s.slug("FAQ"), "faq");
    assert.equal(s.slug("FAQ"), "faq-1");
    assert.equal(s.slug("FAQ"), "faq-2");
  });
  test("既に使われた連番と衝突しない", () => {
    const s = createSlugger();
    assert.equal(s.slug("a-1"), "a-1");
    assert.equal(s.slug("a"), "a");
    assert.equal(s.slug("a"), "a-2");
  });
});

describe("htmlToText", () => {
  test("タグを除き、基本的な文字参照を戻す", () => {
    assert.equal(htmlToText("<code>theme</code> &amp; <em>title</em>"), "theme & title");
  });
});
