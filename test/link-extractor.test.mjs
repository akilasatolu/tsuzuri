import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  extractMarkdownSyntaxLinks,
  extractRawHtmlLinks,
  stripCodeSpans,
  extractLinks,
} from "../.github/scripts/lib/link-extractor.mjs";

describe("extractMarkdownSyntaxLinks", () => {
  test("通常のリンクを抽出できる", () => {
    assert.deepEqual(extractMarkdownSyntaxLinks("[text](docs/setup.md)"), [
      "docs/setup.md",
    ]);
  });

  test("画像リンク(!付き)を抽出できる", () => {
    assert.deepEqual(extractMarkdownSyntaxLinks("![alt](images/logo.png)"), [
      "images/logo.png",
    ]);
  });

  test("titleつきリンクはtitle部分を含めずhrefのみ抽出する", () => {
    assert.deepEqual(
      extractMarkdownSyntaxLinks('[text](docs/setup.md "セットアップ")'),
      ["docs/setup.md"]
    );
  });

  test("1行に複数リンクがあってもすべて抽出する", () => {
    assert.deepEqual(
      extractMarkdownSyntaxLinks(
        "[a](a.md) と [b](b.md) と ![img](c.png) がある"
      ),
      ["a.md", "b.md", "c.png"]
    );
  });

  test("リンク構文でない文字列は誤検出しない", () => {
    assert.deepEqual(
      extractMarkdownSyntaxLinks("これは [ただの角括弧] と (丸括弧) です。"),
      []
    );
  });
});

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

describe("stripCodeSpans", () => {
  test("フェンス付きコードブロック(```)内の見せかけのリンクが除去後に消えている", () => {
    const md = ["前置き", "```", "[fake](evil.md)", "```", "後書き"].join(
      "\n"
    );
    const stripped = stripCodeSpans(md);
    assert.equal(extractMarkdownSyntaxLinks(stripped).length, 0);
  });

  test("フェンス付きコードブロック(~~~)内の見せかけのリンクが除去後に消えている", () => {
    const md = ["前置き", "~~~", "[fake](evil.md)", "~~~", "後書き"].join(
      "\n"
    );
    const stripped = stripCodeSpans(md);
    assert.equal(extractMarkdownSyntaxLinks(stripped).length, 0);
  });

  test("インラインコード内の見せかけのリンクも除去後に消えている", () => {
    const md = "本文中に `[fake](evil.md)` というインラインコードがある";
    const stripped = stripCodeSpans(md);
    assert.equal(extractMarkdownSyntaxLinks(stripped).length, 0);
  });

  test("コードブロック外の正規リンクには影響しない", () => {
    const md = [
      "[real](real.md)",
      "```",
      "[fake](evil.md)",
      "```",
      "[real2](real2.md)",
    ].join("\n");
    const stripped = stripCodeSpans(md);
    assert.deepEqual(extractMarkdownSyntaxLinks(stripped), [
      "real.md",
      "real2.md",
    ]);
  });

  test("行数を変えずに除去する(フェンスブロック)", () => {
    const md = ["a", "```", "b", "c", "```", "d"].join("\n");
    const stripped = stripCodeSpans(md);
    assert.equal(stripped.split("\n").length, md.split("\n").length);
  });

  test("行数を変えずに除去する(インラインコード)", () => {
    const md = "x `code` y";
    const stripped = stripCodeSpans(md);
    assert.equal(stripped.split("\n").length, 1);
  });

  test("既知の限界: ネストしたバッククォートは非対応", () => {
    // `` `code with `nested` backtick` `` のような、内部に単純なバッククォートを
    // エスケープとして含む記法(CommonMarkのネストしたコードスパン規則)には対応しない。
    // 素朴な /`[^`\n]*`/ 置換のため、最初に閉じるバッククォートまでで
    // 1つのコードスパンとみなされ、後半の "backtick`" 部分が地の文として残ってしまう。
    const md = "``code with `nested` backtick``";
    const stripped = stripCodeSpans(md);
    // 期待される「完全なコードスパン除去」ではなく、部分的にしか除去されないことを固定する。
    assert.notEqual(stripped.trim(), "");
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
