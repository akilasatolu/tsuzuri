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
    theme: "wa",
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
  assert.equal(result.theme, "wa");
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
    ["docs/special.md", { content: "本文", meta: { theme: "shu" } }],
    ["docs/custom.md", { content: "本文", meta: { theme: "styles/custom.css" } }],
  ]);
  const result = buildSitemap(baseOpts({ visitedMd }));
  assert.deepEqual(result.pages, [
    { rel: "docs/special.md", title: "docs/special.md", description: null, theme: "shu" },
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
  const resultWa = buildSitemap(baseOpts({ theme: "wa" }));
  assert.equal(resultWa.theme, "wa");

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
