import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { Marked } from "marked";
import markedFootnote from "marked-footnote";

import { emojiExtension, splitEmoji, hasEmojiToken, emojiNamesAsText } from "../.github/scripts/lib/emoji.mjs";
import { buildEmojiData, OUTPUT } from "../scripts/build-emoji-data.mjs";

// 本番と同じ組み合わせ(GFM + 脚注 + 絵文字)
function render(src) {
  const marked = new Marked({ gfm: true });
  marked.use(markedFootnote());
  marked.use(emojiExtension());
  return marked.parse(src).trim();
}

describe("変換される場所", () => {
  test("本文・強調・リンクの文字", () => {
    assert.equal(render("a :tada: b"), "<p>a 🎉 b</p>");
    assert.equal(render("**x :+1:** *y :smile:*"), "<p><strong>x 👍</strong> <em>y 😄</em></p>");
    assert.equal(render("[l :tada:](a.md)"), '<p><a href="a.md">l 🎉</a></p>');
  });

  test("語の途中も変換される(仕様)", () => {
    assert.equal(render("a:tada:b"), "<p>a🎉b</p>");
    assert.match(render("root:x:0"), /root❌0/);
  });

  test("表・リスト・引用", () => {
    const table = render("| :tada: | b |\n|---|---|\n| :x: | c |");
    assert.match(table, /<th>🎉<\/th>/);
    assert.match(table, /<td>❌<\/td>/);
    assert.match(render("- a :tada:\n  - b :x:\n"), /a 🎉[\s\S]*b ❌/);
    assert.match(render("1. a :tada:\n"), /a 🎉/);
    assert.match(render("> q :tada:\n"), /<blockquote>\s*<p>q 🎉<\/p>/);
  });

  test("脚注の中", () => {
    const html = render("x[^1]\n\n[^1]: foot :tada:\n");
    assert.match(html, /foot 🎉/);
  });

  test("コード用以外のインラインのHTMLタグの間", () => {
    assert.equal(render("<span>:x:</span>"), "<p><span>❌</span></p>");
  });

  test("\\* の後ろ・&amp; を含む文字も、marked の通常のエスケープと同じ結果になる", () => {
    assert.equal(render("\\*:tada: &amp; :x:"), "<p>*🎉 &amp; ❌</p>");
    assert.equal(render("a < b :tada: & c"), "<p>a &lt; b 🎉 &amp; c</p>");
  });

  test("閉じタグの後ろは変換される", () => {
    assert.equal(render("<tt>:x:</tt> :x:"), "<p><tt>:x:</tt> ❌</p>");
    assert.equal(render("<samp>:x:</samp> :x:"), "<p><samp>:x:</samp> ❌</p>");
  });

  test("閉じていない <tt> は、次の段落には持ち越さない", () => {
    assert.equal(render("<tt>:x: unclosed\n\nnext :x:"), "<p><tt>:x: unclosed</p>\n<p>next ❌</p>");
  });
});

describe("変換されない場所", () => {
  test("コードスパン・コードブロック", () => {
    assert.equal(render("`:tada:`"), "<p><code>:tada:</code></p>");
    assert.match(render("```\n:tada:\n```"), /<code>:tada:\n<\/code>/);
    assert.match(render("    :tada:\n"), /<code>:tada:\n<\/code>/);
  });

  test("インラインの <code>・<kbd>・<pre>・<script> の中", () => {
    for (const tag of ["code", "kbd", "pre", "script"]) {
      assert.equal(render(`a <${tag}>:x:</${tag}> b :x:`), `<p>a <${tag}>:x:</${tag}> b ❌</p>`, tag);
    }
    assert.equal(render("<CODE>:x:</CODE> :x:"), "<p><CODE>:x:</CODE> ❌</p>");
  });

  test("インラインの <tt>・<samp>・<style> の中(強調・リンクの文字も)", () => {
    assert.equal(render("<tt>:x: **:x:** [l :x:](a.md)</tt> :x:"), '<p><tt>:x: <strong>:x:</strong> <a href="a.md">l :x:</a></tt> ❌</p>');
    assert.equal(render("<samp>:x:</samp>"), "<p><samp>:x:</samp></p>");
    assert.equal(render("a <style>a:x:b{}</style> :x:"), "<p>a <style>a:x:b{}</style> ❌</p>");
    assert.equal(render("<TT>:x:</TT> :x:"), "<p><TT>:x:</TT> ❌</p>");
  });

  test("表のセルの中の <code>・<tt>・<kbd>", () => {
    const html = render("| <code>:x:</code> | <tt>:x:</tt> :x: |\n|---|---|\n| <kbd>:x:</kbd> | <CODE>:x:</CODE> <TT>:x:</TT> |");
    assert.match(html, /<th><code>:x:<\/code><\/th>/);
    assert.match(html, /<th><tt>:x:<\/tt> ❌<\/th>/);
    assert.match(html, /<td><kbd>:x:<\/kbd><\/td>/);
    assert.match(html, /<td><CODE>:x:<\/CODE> <TT>:x:<\/TT><\/td>/);
  });

  test("ブロックのHTMLの中", () => {
    const html = render("<details>\n<summary>sum :tada:</summary>\n\nbody :tada:\n\n</details>");
    assert.match(html, /<summary>sum :tada:<\/summary>/);
    assert.match(html, /<p>body 🎉<\/p>/);
  });

  test("URLをそのまま書いたリンク(表示も href も)", () => {
    assert.equal(render("https://example.com/a:tada:b"), '<p><a href="https://example.com/a:tada:b">https://example.com/a:tada:b</a></p>');
    assert.equal(render("<https://example.com/a:tada:b>"), '<p><a href="https://example.com/a:tada:b">https://example.com/a:tada:b</a></p>');
  });

  test("画像の alt", () => {
    assert.equal(render("![alt :tada:](a.png)"), '<p><img src="a.png" alt="alt :tada:"></p>');
  });

  test("\\:tada:・大文字・未知の名前・:shipit:・時刻", () => {
    assert.equal(render("\\:tada:"), "<p>:tada:</p>");
    assert.equal(render(":TADA:"), "<p>:TADA:</p>");
    assert.equal(render(":nope: :shipit:"), "<p>:nope: :shipit:</p>");
    assert.equal(render("10:30:45"), "<p>10:30:45</p>");
  });

  test("脚注の中のコード", () => {
    assert.match(render("x[^1]\n\n[^1]: `:tada:` <code>:x:</code>\n"), /<code>:tada:<\/code> <code>:x:<\/code>/);
  });
});

describe("splitEmoji", () => {
  test("コロンが無ければ null", () => {
    assert.equal(splitEmoji("no colon"), null);
    assert.equal(splitEmoji("::"), null);
  });

  test("文字列と絵文字に分ける", () => {
    assert.deepEqual(splitEmoji("a :tada: b"), ["a ", { name: "tada", emoji: "🎉" }, " b"]);
  });

  test("表に無い名前の閉じ側のコロンは、次のショートコードの開き側として使える", () => {
    assert.deepEqual(splitEmoji(":nope:tada:"), [":nope", { name: "tada", emoji: "🎉" }]);
    assert.deepEqual(splitEmoji(":nope:tada::x:"), [":nope", { name: "tada", emoji: "🎉" }, { name: "x", emoji: "❌" }]);
  });

  test("Object.prototype の名前は変換しない", () => {
    assert.equal(splitEmoji(":constructor: :toString:"), null);
  });
});

describe("見出しの id 用", () => {
  test("emojiNamesAsText は元の文字のトークンに戻し、元の列は変えない", () => {
    const ext = emojiExtension();
    const tokens = ext.hooks.processAllTokens(new Marked().lexer("# Demo :tada: **b :x:**"));
    const heading = tokens[0].tokens;
    assert.equal(hasEmojiToken(heading), true);
    const restored = emojiNamesAsText(heading);
    assert.equal(hasEmojiToken(restored), false);
    assert.equal(restored.map((t) => t.raw).join(""), "Demo :tada: **b :x:**");
    assert.equal(hasEmojiToken(heading), true, "元の列は変わらない");
  });
});

describe("構造と性能", () => {
  test("walkTokens・tokenizer・start を使わない", () => {
    const ext = emojiExtension();
    assert.equal("walkTokens" in ext, false);
    assert.equal(typeof ext.hooks.processAllTokens, "function");
    for (const e of ext.extensions) {
      assert.equal("tokenizer" in e, false);
      assert.equal("start" in e, false);
    }
  });

  test("コードスパンと文字が交互に2万5千個並ぶ段落でも、処理時間が2乗に伸びない", () => {
    const marked = new Marked({ gfm: true });
    marked.use(emojiExtension());
    const src = "`a` 10:30 ".repeat(25000);
    const t0 = Date.now();
    marked.parse(src);
    const ms = Date.now() - t0;
    assert.ok(ms < 2000, `${ms}ms かかった`);
  });
});

describe("emoji-data.mjs", () => {
  test("gemoji から作り直したものと一致する(違うときは node scripts/build-emoji-data.mjs を実行して差分をコミットする)", () => {
    assert.equal(fs.readFileSync(OUTPUT, "utf-8"), buildEmojiData());
  });
});
