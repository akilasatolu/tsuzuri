import test from "node:test";
import assert from "node:assert/strict";
import { Marked } from "marked";
import { buildLlmsTxt, sanitizeText, sanitizeUrl } from "../.github/scripts/lib/llms-txt.mjs";

const HOME = "https://example.github.io/repo/";

test("buildLlmsTxt: H1・要約・Docs・Optional の形(末尾は改行1つ)", () => {
  const text = buildLlmsTxt({
    siteName: "My Site",
    homeUrl: HOME,
    summary: "サイトの説明",
    docs: [
      { title: "Top", url: `${HOME}`, description: "トップ" },
      { title: "Guide", url: `${HOME}guide.html`, description: "使い方" },
    ],
    optional: [
      { title: "Hidden", url: `${HOME}hidden.html`, description: "" },
      { title: "日本語", url: `${HOME}ja/` },
    ],
  });
  assert.equal(
    text,
    [
      "# My Site",
      "",
      "> サイトの説明",
      "",
      "## Docs",
      "",
      "- [Top](https://example.github.io/repo/): トップ",
      "- [Guide](https://example.github.io/repo/guide.html): 使い方",
      "",
      "## Optional",
      "",
      "- [Hidden](https://example.github.io/repo/hidden.html)",
      "- [日本語](https://example.github.io/repo/ja/)",
      "",
    ].join("\n")
  );
  assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"));
  assert.ok(!text.startsWith("﻿"));
});

test("buildLlmsTxt: 説明なしの行は ': ' 以降を出さない", () => {
  const text = buildLlmsTxt({ siteName: "S", homeUrl: HOME, docs: [{ title: "A", url: `${HOME}a.html`, description: "  \n " }] });
  assert.ok(text.includes("- [A](https://example.github.io/repo/a.html)\n"));
  assert.ok(!text.includes("a.html):"));
});

test("buildLlmsTxt: 要約が空なら引用ブロックを出さない", () => {
  const text = buildLlmsTxt({ siteName: "S", homeUrl: HOME, summary: " ", docs: [{ title: "A", url: `${HOME}a.html` }] });
  assert.equal(text, "# S\n\n## Docs\n\n- [A](https://example.github.io/repo/a.html)\n");
});

test("buildLlmsTxt: 項目のない節は見出しごと出さない", () => {
  const onlyOptional = buildLlmsTxt({ siteName: "S", homeUrl: HOME, docs: [], optional: [{ title: "B", url: `${HOME}b.html` }] });
  assert.equal(onlyOptional, "# S\n\n## Optional\n\n- [B](https://example.github.io/repo/b.html)\n");
  assert.ok(!onlyOptional.includes("## Docs"));
  const none = buildLlmsTxt({ siteName: "S", homeUrl: HOME, docs: [] });
  assert.equal(none, "# S\n");
});

test("buildLlmsTxt: サイト名が空なら homeUrl を H1 にする", () => {
  assert.equal(buildLlmsTxt({ siteName: " \n", homeUrl: HOME, docs: [] }), `# ${HOME}\n`);
});

test("無害化: 改行・タブは1つの空白にまとめて前後を取る(行や節を作れない)", () => {
  const text = buildLlmsTxt({
    siteName: "A\n\n## Evil\n",
    homeUrl: HOME,
    summary: "line1\r\n\r\n- [x](y)\tline2",
    docs: [{ title: "T\n## H\n- [z](w)", url: `${HOME}t.html`, description: "d1\n\nd2\t\td3" }],
  });
  assert.equal(
    text,
    [
      "# A ## Evil",
      "",
      "> line1 - \\[x\\](y) line2",
      "",
      "## Docs",
      "",
      "- [T ## H - \\[z\\](w)](https://example.github.io/repo/t.html): d1 d2 d3",
      "",
    ].join("\n")
  );
});

test("無害化: \\ [ ] の前に \\ を付ける", () => {
  assert.equal(sanitizeText("a]b[c\\d", 200), "a\\]b\\[c\\\\d");
  assert.equal(sanitizeText("](javascript:alert(1))", 200), "\\](javascript:alert(1))");
});

test("無害化: URL の ( ) を %28 %29 にする", () => {
  assert.equal(sanitizeUrl("https://e.com/a_(b).html"), "https://e.com/a_%28b%29.html");
  const text = buildLlmsTxt({ siteName: "S", homeUrl: HOME, docs: [{ title: "T", url: "https://e.com/x)(y.html" }] });
  assert.ok(text.includes("- [T](https://e.com/x%29%28y.html)\n"));
});

test("無害化: 題名は200文字、説明・要約は300文字で切る(前後の空白を取った後)", () => {
  assert.equal(sanitizeText("a".repeat(250), 200), "a".repeat(200));
  assert.equal(sanitizeText("a".repeat(200), 200), "a".repeat(200));
  const text = buildLlmsTxt({
    siteName: "S",
    homeUrl: HOME,
    summary: "s".repeat(400),
    docs: [{ title: "t".repeat(300), url: `${HOME}t.html`, description: "d".repeat(400) }],
  });
  assert.ok(text.includes(`> ${"s".repeat(300)}\n`));
  assert.ok(text.includes(`- [${"t".repeat(200)}](${HOME}t.html): ${"d".repeat(300)}\n`));
  // 切った位置の空白は残さない
  assert.equal(sanitizeText(`${"a".repeat(199)} b`, 200), "a".repeat(199));
});

test("無害化: サロゲートペア(絵文字)の途中で切らない", () => {
  const cut = sanitizeText("a".repeat(199) + "😀😀", 200);
  assert.equal(cut, "a".repeat(199) + "😀");
  assert.ok(!/[\uD800-\uDBFF]$/.test(cut));
  assert.equal(sanitizeText("😀".repeat(5), 3), "😀😀😀");
  // 対になっていないサロゲートは置き換える(UTF-8 で書いても壊れた文字にならない)
  assert.equal(sanitizeText("a\uD83Db", 10), "a�b");
});

test("無害化: 切る位置で \\ だけが残らない(エスケープの前に切る)", () => {
  assert.equal(sanitizeText("a".repeat(199) + "]]", 200), "a".repeat(199) + "\\]");
  const out = sanitizeText("[".repeat(10), 3);
  assert.equal(out, "\\[\\[\\[");
  assert.ok(!/(^|[^\\])(\\\\)*\\$/.test(out));
});

test("無害化: 題名が空(空白だけ・エスケープ前に空)になったら URL を題名にする", () => {
  const text = buildLlmsTxt({ siteName: "S", homeUrl: HOME, docs: [{ title: " \n\t ", url: `${HOME}p/q.html` }] });
  assert.ok(text.includes("- [https://example.github.io/repo/p/q.html](https://example.github.io/repo/p/q.html)\n"));
});

test("無害化: 長い空白の並びでも処理時間が伸びない", () => {
  const started = performance.now();
  sanitizeText(" ".repeat(2_000_000) + "x" + " ".repeat(2_000_000), 200);
  sanitizeText("\\[]".repeat(500_000), 200);
  assert.ok(performance.now() - started < 2000);
});

test("無害化: 空白以外の制御文字(NEL・U+001C〜U+001E・NUL・ESC・DEL)も1つの空白にまとめる", () => {
  for (const ch of ["\u0085", "\u001C", "\u001D", "\u001E", "\u0000", "\u001B", "\u007F"]) {
    assert.equal(sanitizeText(`nel${ch}## Injected`, 200), "nel ## Injected", JSON.stringify(ch));
  }
  assert.equal(sanitizeText("\u0085\u0000a\u001C\u001D b\u007F", 200), "a b");
  const text = buildLlmsTxt({
    siteName: "S",
    homeUrl: HOME,
    summary: "x\u0085## Injected",
    docs: [{ title: "nel\u0085## Injected", url: `${HOME}a.html`, description: "d\u001C\u001E- [z](w)" }],
  });
  // 行の区切りとして扱う読み手(Python の splitlines() など)でも、行は増えない
  const separators = ["\r", "\v", "\f", "\u001c", "\u001d", "\u001e", "\u0085", "\u2028", "\u2029"];
  assert.ok(!separators.some((sep) => text.includes(sep)));
  assert.ok(!/[\p{Cc}]/u.test(text.replace(/\n/g, "")));
});

test("無害化: URL の制御文字はパーセントエンコードする", () => {
  assert.equal(sanitizeUrl("https://e.com/\u0085a\u0000"), "https://e.com/%85a%00");
});

test("無害化: バッククォートと < をエスケープし、Markdown として読んでもリンクのまま・生の HTML が出ない", () => {
  assert.equal(sanitizeText("a`b<c", 200), "a\\`b\\<c");
  const text = buildLlmsTxt({
    siteName: "S",
    homeUrl: HOME,
    docs: [
      { title: "tick `open", url: `${HOME}a.html`, description: "close ` here" },
      { title: "<b>x</b>", url: `${HOME}b.html`, description: "<script>x</script> と <!-- c --> と <img src=x onerror=y>" },
    ],
  });
  const tokens = new Marked({ gfm: true }).lexer(text);
  const list = tokens.find((t) => t.type === "list");
  assert.equal(list.items.length, 2);
  const kinds = [];
  (function walk(ts) {
    for (const t of ts ?? []) {
      kinds.push(t.type);
      walk(t.tokens);
      walk(t.items);
    }
  })(tokens);
  assert.ok(!kinds.includes("html") && !kinds.includes("codespan"), kinds.join());
  for (const item of list.items) {
    const links = item.tokens[0].tokens.filter((t) => t.type === "link");
    assert.equal(links.length, 1, item.raw);
  }
  const html = new Marked({ gfm: true }).parse(text);
  assert.ok(!/<(script|b|img)\b/.test(html), html);
  assert.match(html, /<a href="https:\/\/example\.github\.io\/repo\/a\.html">tick `open<\/a>: close ` here/);
});
