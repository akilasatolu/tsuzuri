import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemap, buildSitemapXml } from "../.github/scripts/lib/sitemap.mjs";

function baseOpts(overrides = {}) {
  const visitedMd = new Map([
    ["README.md", { content: "# Top\n", meta: { title: "Top Page", description: "top desc" } }],
    ["docs/setup.md", { content: "# Setup\n", meta: { title: "Setup" } }],
  ]);
  return {
    root: "README.md",
    basePath: "",
    styleFile: ".github/docs-pages.style.css",
    customStyleApplied: false,
    visitedMd,
    imageSet: new Set(["images/logo.png"]),
    hierarchy: { "README.md": [] },
    missing: [],
    rejected: [],
    lang: "ja",
    siteName: "tsuzuri",
    siteOrigin: "https://example.com",
    customDomain: null,
    theme: "material",
    ...overrides,
  };
}

test("新規フィールド(lang/siteName/siteOrigin/customDomain/theme)が正しく出力される", () => {
  const result = buildSitemap(
    baseOpts({ customDomain: "docs.example.com" })
  );
  assert.equal(result.lang, "ja");
  assert.equal(result.siteName, "tsuzuri");
  assert.equal(result.siteOrigin, "https://example.com");
  assert.equal(result.customDomain, "docs.example.com");
  assert.equal(result.theme, "material");
});

test("pages[].title / pages[].description が正しく出力される (meta優先)", () => {
  const result = buildSitemap(baseOpts());
  assert.deepEqual(result.pages, [
    { rel: "README.md", title: "Top Page", description: "top desc", theme: null },
    { rel: "docs/setup.md", title: "Setup", description: null, theme: null },
  ]);
});

test("meta.titleが無い場合はrelをフォールバックとして使う", () => {
  const visitedMd = new Map([["notes.md", { content: "本文のみ", meta: {} }]]);
  const result = buildSitemap(baseOpts({ visitedMd }));
  assert.deepEqual(result.pages, [
    { rel: "notes.md", title: "notes.md", description: null, theme: null },
  ]);
});

test("meta.themeがあればpages[].themeにそのまま反映される", () => {
  const visitedMd = new Map([
    ["docs/special.md", { content: "本文", meta: { theme: "glass" } }],
    ["docs/custom.md", { content: "本文", meta: { theme: "styles/custom.css" } }],
  ]);
  const result = buildSitemap(baseOpts({ visitedMd }));
  assert.deepEqual(result.pages, [
    { rel: "docs/special.md", title: "docs/special.md", description: null, theme: "glass" },
    { rel: "docs/custom.md", title: "docs/custom.md", description: null, theme: "styles/custom.css" },
  ]);
});

test("pageRelsが旧pages(文字列配列)と同一内容であること(後方互換)", () => {
  const opts = baseOpts();
  const result = buildSitemap(opts);
  assert.deepEqual(result.pageRels, ["README.md", "docs/setup.md"]);
  assert.deepEqual(result.pageRels, [...opts.visitedMd.keys()]);
});

test("customDomain未設定時はnullに統一される(undefined渡し)", () => {
  const opts = baseOpts();
  delete opts.customDomain;
  const result = buildSitemap(opts);
  assert.equal(result.customDomain, null);
});

test("customDomain未設定時はnullに統一される(null明示渡し)", () => {
  const result = buildSitemap(baseOpts({ customDomain: null }));
  assert.equal(result.customDomain, null);
});

test("themeフィールドがconfig.loadConfig()で解決された最終テーマ名(noneを含む)と一致する", () => {
  const resultWa = buildSitemap(baseOpts({ theme: "material" }));
  assert.equal(resultWa.theme, "material");

  const resultNone = buildSitemap(baseOpts({ theme: "none" }));
  assert.equal(resultNone.theme, "none");
});

test("既存フィールド(root/basePath/styleFile/customStyleApplied/images/hierarchy/missing)が維持される", () => {
  const result = buildSitemap(baseOpts({ customStyleApplied: true }));
  assert.equal(result.root, "README.md");
  assert.equal(result.basePath, "");
  assert.equal(result.styleFile, ".github/docs-pages.style.css");
  assert.equal(result.customStyleApplied, true);
  assert.deepEqual(result.images, ["images/logo.png"]);
  assert.deepEqual(result.hierarchy, { "README.md": [] });
  assert.deepEqual(result.missing, []);
});

test("rejectedがそのまま配列として出力される(未指定時は空配列)", () => {
  const rejected = [
    { rel: "../../etc/passwd", referencedFrom: "README.md", reason: "path-traversal" },
  ];
  const result = buildSitemap(baseOpts({ rejected }));
  assert.deepEqual(result.rejected, rejected);

  const opts2 = baseOpts();
  delete opts2.rejected;
  const result2 = buildSitemap(opts2);
  assert.deepEqual(result2.rejected, []);
});

test("buildSitemapXml: sitemaps.org形式で、URLはXMLエスケープされる", () => {
  const xml = buildSitemapXml(["https://example.com/", "https://example.com/a.html?x=1&y=2"]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<url><loc>https:\/\/example\.com\/<\/loc><\/url>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/a\.html\?x=1&amp;y=2<\/loc>/);
  assert.match(xml, /<\/urlset>\n$/);
});

test("buildSitemapXml: lastmod 付きの項目は <lastmod> を出力する", () => {
  const xml = buildSitemapXml([{ loc: "https://example.com/a.html", lastmod: "2026-09-27" }, "https://example.com/b.html"]);
  assert.match(xml, /<url><loc>https:\/\/example\.com\/a\.html<\/loc><lastmod>2026-09-27<\/lastmod><\/url>/);
  assert.match(xml, /<url><loc>https:\/\/example\.com\/b\.html<\/loc><\/url>/);
});

// ---- 多言語の情報(T-011) ----

const LANG_KEYS = ["languages", "trees"];

test("多言語: languages・langOf・trees を省略すると今と同じ形(言語の情報を足さない)", () => {
  const result = buildSitemap(baseOpts());
  for (const k of LANG_KEYS) assert.equal(Object.hasOwn(result, k), false, k);
  for (const p of result.pages) assert.equal(Object.hasOwn(p, "lang"), false);
});

test("多言語: 言語が1つ(languages=[ja])なら省略時と JSON が1文字も変わらない", () => {
  const plain = JSON.stringify(buildSitemap(baseOpts()), null, 2);
  const one = JSON.stringify(
    buildSitemap(baseOpts({ languages: ["ja"], langOf: () => "ja", trees: new Map([["ja", { rel: "README.md" }]]) })),
    null,
    2
  );
  assert.equal(one, plain);
});

test("多言語: 空の languages も1言語と同じ扱い", () => {
  const plain = JSON.stringify(buildSitemap(baseOpts()));
  assert.equal(JSON.stringify(buildSitemap(baseOpts({ languages: [] }))), plain);
});

function multiOpts(overrides = {}) {
  const visitedMd = new Map([
    ["README.md", { content: "# Top\n", meta: { title: "Top" } }],
    ["README.en.md", { content: "# Top\n", meta: { title: "Top (en)" } }],
    ["docs/a.md", { content: "# A\n", meta: { title: "A" } }],
  ]);
  return baseOpts({
    visitedMd,
    languages: ["ja", "en"],
    langOf: (rel) => (/\.en\.md$/.test(rel) ? "en" : "ja"),
    trees: new Map([
      ["en", { rel: "README.en.md", children: [] }],
      ["ja", { rel: "README.md", children: [{ rel: "docs/a.md", children: [] }] }],
    ]),
    ...overrides,
  });
}

test("多言語: 2言語なら languages・pages[].lang・trees が入り、lang は基本言語のまま", () => {
  const result = buildSitemap(multiOpts());
  assert.equal(result.lang, "ja");
  assert.deepEqual(result.languages, ["ja", "en"]);
  assert.deepEqual(
    result.pages.map((p) => [p.rel, p.lang]),
    [["README.md", "ja"], ["README.en.md", "en"], ["docs/a.md", "ja"]]
  );
  assert.deepEqual(result.trees, {
    ja: { rel: "README.md", children: [{ rel: "docs/a.md", children: [] }] },
    en: { rel: "README.en.md", children: [] },
  });
  // 既存のフィールドはそのまま
  assert.deepEqual(result.pageRels, ["README.md", "README.en.md", "docs/a.md"]);
});

test("多言語: キーの並びが固定(JSON の文字列で比べられる)", () => {
  const result = buildSitemap(multiOpts());
  const plainKeys = Object.keys(buildSitemap(baseOpts()));
  assert.deepEqual(Object.keys(result), [...plainKeys, "languages", "trees"]);
  assert.deepEqual(Object.keys(result.pages[0]), ["rel", "title", "description", "theme", "lang"]);
  // trees のキーは languages の順(渡した Map の順に左右されない)
  assert.deepEqual(Object.keys(result.trees), ["ja", "en"]);
  // 同じ入力なら JSON が同じ
  assert.equal(JSON.stringify(result), JSON.stringify(buildSitemap(multiOpts())));
});

test("多言語: trees は普通のオブジェクトでも受け取れ、無い言語は null", () => {
  const result = buildSitemap(multiOpts({ languages: ["ja", "en", "fr"], trees: { ja: { rel: "README.md" } } }));
  assert.deepEqual(result.trees, { ja: { rel: "README.md" }, en: null, fr: null });
  const noTrees = buildSitemap(multiOpts({ trees: undefined }));
  assert.deepEqual(noTrees.trees, { ja: null, en: null });
});

test("多言語: langOf を省略すると各ページの lang は基本言語", () => {
  const result = buildSitemap(multiOpts({ langOf: undefined }));
  assert.deepEqual(result.pages.map((p) => p.lang), ["ja", "ja", "ja"]);
});

test("多言語: 渡した languages の配列を書き換えても結果は変わらない(コピーを持つ)", () => {
  const languages = ["ja", "en"];
  const result = buildSitemap(multiOpts({ languages }));
  languages.push("fr");
  assert.deepEqual(result.languages, ["ja", "en"]);
});
