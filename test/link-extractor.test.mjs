import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  extractRawHtmlLinks,
  extractLinks,
  firstHeadingText,
} from "../.github/scripts/lib/link-extractor.mjs";

describe("extractRawHtmlLinks", () => {
  test("<img src=...> を抽出できる", () => {
    assert.deepEqual(
      extractRawHtmlLinks('<img src="images/logo.png" alt="logo">'),
      ["images/logo.png"]
    );
  });

  test("<a href=...> を抽出できる", () => {
    assert.deepEqual(
      extractRawHtmlLinks('<a href="docs/setup.md">setup</a>'),
      ["docs/setup.md"]
    );
  });

  test("属性の順序が入れ替わっていても抽出できる", () => {
    assert.deepEqual(
      extractRawHtmlLinks('<img alt="logo" src="images/logo.png" width="48">'),
      ["images/logo.png"]
    );
  });

  test("自己終端タグ(/>)でも抽出できる", () => {
    assert.deepEqual(
      extractRawHtmlLinks('<img src="images/logo.png" />'),
      ["images/logo.png"]
    );
  });
});

describe("extractLinks: コードの中の見せかけのリンクはたどらない", () => {
  test("フェンス付きコードブロック(``` と ~~~)・インラインコードの中は拾わない", () => {
    for (const md of [
      ["前置き", "```", "[fake](evil.md)", "```", "後書き"].join("\n"),
      ["前置き", "~~~", "[fake](evil.md)", "~~~", "後書き"].join("\n"),
      "本文中に `[fake](evil.md)` というインラインコードがある",
      "``code with `[fake](evil.md)` backtick``",
    ]) {
      assert.deepEqual(extractLinks(md), [], md);
    }
  });

  test("コードブロックの外の通常のリンクは拾う", () => {
    const md = ["[real](real.md)", "```", "[fake](evil.md)", "```", "[real2](real2.md)"].join("\n");
    assert.deepEqual(extractLinks(md), ["real.md", "real2.md"]);
  });
});

describe("extractLinks(描画と同じ marked の解釈)", () => {
  test("参照リンク・バッジ・生のHTML・脚注の中のリンクを拾い、コードの中は拾わない", () => {
    const md = [
      "[a][r] [![b](img.png)](nested.md) <a href=\"raw.md\">raw</a>",
      "",
      "```",
      "[fake](fake.md)",
      "```",
      "",
      "本文[^1]",
      "",
      "[r]: ref.md",
      "[^1]: [脚注内](fn.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(md).sort(), ["fn.md", "img.png", "nested.md", "raw.md", "ref.md"].sort());
  });
});

test("extractLinks: 脚注のある本文を続けて処理しても例外にならない", () => {
  assert.deepEqual(extractLinks("x[^1]\n\n[^1]: [a](a.md)\n"), ["a.md"]);
  assert.deepEqual(extractLinks("y[^1]\n\n[^1]: [b](b.md)\n"), ["b.md"]);
});

test("firstHeadingText: # 見出し・setext・生のHTMLの<h1>から表示テキストを取り、コード内の#は無視する", () => {
  assert.equal(firstHeadingText("```sh\n# comment\n```\n\n# Title **bold** `code`\n"), "Title bold code");
  assert.equal(firstHeadingText("Setext\n===\n"), "Setext");
  assert.equal(firstHeadingText('<h1 align="center">\n  <img src="a.png"> My &amp; Proj\n</h1>\n'), "My & Proj");
  assert.equal(firstHeadingText("## h2 only\n"), "");
});
