import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { htmlToSearchText, buildSearchIndex, SEARCH_SCRIPT, MAX_TEXT_LENGTH } from "../.github/scripts/lib/search.mjs";

describe("htmlToSearchText", () => {
  test("タグ・script・styleを除き、文字参照を戻し、空白をまとめる", () => {
    const html = "<h1 id=\"a\">見出し</h1>\n<p>本文 &amp; <code>code</code></p><script>alert(1)</script><style>p{}</style>";
    assert.equal(htmlToSearchText(html), "見出し 本文 & code");
  });
  test("長い本文は上限の文字数で切る", () => {
    assert.equal(htmlToSearchText("あ".repeat(MAX_TEXT_LENGTH + 10)).length, MAX_TEXT_LENGTH);
  });
});

describe("buildSearchIndex", () => {
  test("タイトル(t)・URL(u)・本文テキスト(x)の配列にする", () => {
    assert.deepEqual(buildSearchIndex([{ title: "FAQ", url: "/repo/docs/faq.html", html: "<p>質問</p>" }]), [
      { t: "FAQ", u: "/repo/docs/faq.html", x: "質問" },
    ]);
  });
});

describe("SEARCH_SCRIPT", () => {
  test("構文として正しいJavaScriptである", () => {
    assert.doesNotThrow(() => new Function(SEARCH_SCRIPT));
  });
  test("結果の表示は textContent を使い、HTMLとして解釈しない(索引の内容によるXSSを防ぐ)", () => {
    assert.match(SEARCH_SCRIPT, /textContent/);
    assert.doesNotMatch(SEARCH_SCRIPT, /innerHTML/);
  });
});

test("SEARCH_SCRIPT: 結果の一覧は aria-live で読み上げられ、Escで閉じられる", () => {
  assert.match(SEARCH_SCRIPT, /aria-live", "polite"/);
  assert.match(SEARCH_SCRIPT, /event\.key === "Escape"/);
});

test("コピーボタン・ライト/ダーク切り替えのスクリプトも構文エラーが無い", async () => {
  const { COPY_SCRIPT } = await import("../.github/scripts/lib/copy-button.mjs");
  const { THEME_SCRIPT, THEME_HEAD_SCRIPT } = await import("../.github/scripts/lib/theme-toggle.mjs");
  assert.doesNotThrow(() => new Function(COPY_SCRIPT));
  assert.doesNotThrow(() => new Function(THEME_SCRIPT));
  assert.doesNotThrow(() => new Function(THEME_HEAD_SCRIPT.replace(/^<script>|<\/script>$/g, "")));
});
