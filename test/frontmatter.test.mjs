import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../.github/scripts/lib/frontmatter.mjs";

test("frontmatterなしの場合はmeta={}、bodyは元の内容のまま", () => {
  const raw = "# Title\n\n本文です。\n";
  const result = parseFrontmatter(raw);
  assert.deepEqual(result.meta, {});
  assert.equal(result.body, raw);
});

test("全キー指定時に正しくパースされ、bodyからブロックが除去される", () => {
  const raw = [
    "---",
    "title: サンプルページ",
    "description: これは説明文です",
    "ogImage: /images/og.png",
    "ogType: article",
    "lang: en",
    "noindex: true",
    "---",
    "# 本文見出し",
    "",
    "本文の内容。",
    "",
  ].join("\n");

  const result = parseFrontmatter(raw);

  assert.deepEqual(result.meta, {
    title: "サンプルページ",
    description: "これは説明文です",
    ogImage: "/images/og.png",
    ogType: "article",
    lang: "en",
    noindex: true,
  });
  assert.equal(result.body, "# 本文見出し\n\n本文の内容。\n");
});

test("空のfrontmatterブロック(---\\n---\\n)の場合はmeta={}", () => {
  const raw = "---\n---\n本文\n";
  const result = parseFrontmatter(raw);
  assert.deepEqual(result.meta, {});
  assert.equal(result.body, "本文\n");
});

test("終端の---が見つからない場合はwarnし、meta={}かつbodyは元の内容全体のまま(fail-open)", () => {
  const raw = "---\ntitle: 終端なし\n本文だけがずっと続く\n";
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnCalls.push(args);
  try {
    const result = parseFrontmatter(raw);
    assert.deepEqual(result.meta, {});
    assert.equal(result.body, raw);
    assert.equal(warnCalls.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test("noindexは'true'/'false'/'TRUE'(大文字)の3パターンを正しく真偽値化する", () => {
  const trueCase = parseFrontmatter("---\nnoindex: true\n---\n本文\n");
  assert.equal(trueCase.meta.noindex, true);

  const falseCase = parseFrontmatter("---\nnoindex: false\n---\n本文\n");
  assert.equal(falseCase.meta.noindex, false);

  const upperCase = parseFrontmatter("---\nnoindex: TRUE\n---\n本文\n");
  assert.equal(upperCase.meta.noindex, true);
});

test("未知のキー(foo: bar)はmeta.fooに文字列のまま保持される", () => {
  const raw = "---\nfoo: bar\n---\n本文\n";
  const result = parseFrontmatter(raw);
  assert.equal(result.meta.foo, "bar");
});

test("lang: en指定時にmeta.lang === 'en'としてパースされる(保持のみ確認。HTML出力への非反映はhtml-renderer側のテストで確認)", () => {
  const raw = "---\nlang: en\n---\n本文\n";
  const result = parseFrontmatter(raw);
  assert.equal(result.meta.lang, "en");
});

test("改行コードがCRLFでもfrontmatterを認識する", () => {
  const raw = "---\r\ntitle: Windows\r\nnoindex: true\r\n---\r\n# 本文\r\n";
  const result = parseFrontmatter(raw);
  assert.deepEqual(result.meta, { title: "Windows", noindex: true });
  assert.equal(result.body, "# 本文\n");
});

test("先頭にBOMが付いていてもfrontmatterを認識する", () => {
  const raw = "\uFEFF---\ntitle: BOM付き\n---\n本文\n";
  const result = parseFrontmatter(raw);
  assert.deepEqual(result.meta, { title: "BOM付き" });
  assert.equal(result.body, "本文\n");
});

test("値全体が対応する引用符で囲まれていれば外す(片側だけ・途中の引用符はそのまま)", () => {
  const raw = [
    "---",
    'title: "My Site: Home"',
    "description: 'シングル'",
    "ogType: \"article",
    'lang: say "hi"',
    'noindex: "true"',
    "---",
    "本文",
  ].join("\n");
  assert.deepEqual(parseFrontmatter(raw).meta, {
    title: "My Site: Home",
    description: "シングル",
    ogType: '"article',
    lang: 'say "hi"',
    noindex: true,
  });
});
