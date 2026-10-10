import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/**
 * build-docs.mjs の E2E テスト: 多言語のサイト(設計のテスト観点 7-A・7-B・7-C。言語切り替えボタンと
 * hreflang は T-015 で足す)。
 *
 * fixture A(test/fixtures/site-i18n-ja)は日本語が基本(LANGUAGES=ja,en)、
 * fixture B(test/fixtures/site-i18n-en)は英語が基本(LANGUAGES=en,ja)。
 * このファイルの runBuild は既定の言語を持たない(ビルドごとに LANGUAGES をはっきり指定する)。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_DIR, "..");
const SCRIPT_PATH = path.join(PROJECT_ROOT, ".github/scripts/build-docs.mjs");
const REAL_STYLES_DIR = path.join(PROJECT_ROOT, "styles");
const FIXTURE_A = path.join(TEST_DIR, "fixtures", "site-i18n-ja");
const FIXTURE_B = path.join(TEST_DIR, "fixtures", "site-i18n-en");

// build-docs.mjs が参照する環境変数。呼び出しごとにすべて消してから、指定した値だけを入れる。
const CONFIG_ENV_KEYS = [
  "ROOT_MD",
  "OUT_DIR",
  "STYLE_FILE",
  "BASE_PATH",
  "SITE_ORIGIN",
  "LANGUAGES",
  "LANG",
  "NAV_ENABLED",
  "FAVICON_FILE",
  "SITE_NAME",
  "CUSTOM_DOMAIN",
  "OGP_DEFAULT_IMAGE",
  "THEME",
  "STYLE_DIR",
  "GITHUB_REPOSITORY",
  "STRICT_LINKS",
  "SITEMAP_JSON",
  "LAST_UPDATED",
  "GITHUB_SERVER_URL",
  "GITHUB_SHA",
  "GITHUB_REF",
  "GITHUB_REF_NAME",
  "EDIT_LINK",
  "REPO_LINK",
  "REPO_VERSION",
  "REPO_LICENSE",
  "GITHUB_ACTIONS",
];

/** overrides には LANGUAGES を必ず書く(null は「環境変数では指定しない」= 設定ファイルの値を使う) */
function runBuild(cwd, overrides) {
  assert.ok(overrides && "LANGUAGES" in overrides, "このファイルのビルドは LANGUAGES をはっきり指定する");
  const env = { ...process.env };
  for (const key of CONFIG_ENV_KEYS) delete env[key];
  env.THEME = "none";
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete env[key];
    else env[key] = value;
  }
  return spawnSync(process.execPath, [SCRIPT_PATH], { cwd, env, encoding: "utf-8" });
}

/** fixture(無ければ空)を一時フォルダに写し、extra のファイル({ 道のり: 中身 | null })を足す・消す */
function makeSite(fixture, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-docs-i18n-"));
  if (fixture) fs.cpSync(fixture, dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "styles"), { recursive: true });
  fs.copyFileSync(path.join(REAL_STYLES_DIR, "base.css"), path.join(dir, "styles", "base.css"));
  for (const [rel, content] of Object.entries(extra)) {
    const abs = path.join(dir, rel);
    if (content === null) {
      fs.rmSync(abs, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function withSite(fixture, extra, fn) {
  const dir = makeSite(fixture, extra);
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const outAbs = (dir, rel) => path.join(dir, "_site", rel);
const readOut = (dir, rel) => fs.readFileSync(outAbs(dir, rel), "utf-8");
const existsOut = (dir, rel) => fs.existsSync(outAbs(dir, rel));
const hrefsOf = (html) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
const navOf = (html) => {
  const m = html.match(/<nav aria-label="[^"]*">[\s\S]*?<\/nav>/);
  assert.ok(m, "ナビがあること");
  return m[0];
};
/**
 * 言語切り替えボタン(リンク・メニュー・本文の上の欄)と hreflang の行だけを取り除く。
 * 多言語のページを1言語のページと比べるときや、ナビのページ一覧だけを見るときに使う。
 */
const stripLangParts = (html) =>
  html
    .replace(/<div class="tsuzuri-lang-bar">[\s\S]*?<\/div>\n?/g, "")
    .replace(/<details class="tsuzuri-lang-menu">[\s\S]*?<\/details>/g, "")
    .replace(/<a class="tsuzuri-lang-switch"[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, "");
/** ページの言語切り替えボタンの部分(無ければ "") */
const langSwitchOf = (html) =>
  html.match(/<details class="tsuzuri-lang-menu">[\s\S]*?<\/details>|<a class="tsuzuri-lang-switch"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
const htmlLang = (html) => html.match(/<html lang="([^"]*)"/)[1];
const logOf = (result) => `${result.stdout}\n${result.stderr}`;

/** 出力の中のファイル(出力先からの道のり)をすべて並べる */
function listFiles(root, sub = "") {
  const out = [];
  for (const ent of fs.readdirSync(path.join(root, sub), { withFileTypes: true })) {
    const rel = sub ? `${sub}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...listFiles(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

/**
 * 出力 HTML のサイト内の href・src がすべて、実在のファイルか、フォルダの index.html を指すか確かめる。
 * 指していないものの一覧を返す。
 */
function brokenSiteLinks(dir, basePath = "") {
  const root = path.join(dir, "_site");
  const broken = [];
  for (const rel of listFiles(root).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, rel), "utf-8");
    for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const url = m[1].replace(/&amp;/g, "&");
      if (!url.startsWith("/") || url.startsWith("//")) continue;
      assert.ok(url === basePath || url.startsWith(`${basePath}/`), `${rel}: ${url} が BASE_PATH で始まる`);
      let p = decodeURIComponent(url.slice(basePath.length).split(/[?#]/)[0]).replace(/^\//, "");
      if (p === "" || p.endsWith("/")) p += "index.html";
      if (!fs.existsSync(path.join(root, p))) broken.push(`${rel}: ${url}`);
    }
  }
  return broken;
}

/** 大文字・小文字を区別しないファイルシステムか(一時フォルダで確かめる) */
function caseInsensitiveFs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-docs-i18n-case-"));
  try {
    fs.writeFileSync(path.join(dir, "CaseProbe"), "");
    return fs.existsSync(path.join(dir, "caseprobe"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const CASE_INSENSITIVE = caseInsensitiveFs();

const A_ENV = { LANGUAGES: "ja,en", NAV_ENABLED: "true" };

describe("build-docs.mjs :: 多言語 A(LANGUAGES=ja,en)", () => {
  test("出力のファイル: 言語ごとの URL に書き出し、画像は1つだけ", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      const result = runBuild(dir, { ...A_ENV, STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      for (const rel of [
        "index.html",
        "README.html",
        "en/index.html",
        "en/README.html",
        "docs/a.html",
        "en/docs/a.html",
        "docs/b.html",
        "guide/index.html",
        "en/guide/index.html",
        "en/docs/en-only.html",
        "ref/index.html",
        "en/ref/index.html",
        "search-index.json",
        "en/search-index.json",
        "images/x.png",
      ]) {
        assert.ok(existsOut(dir, rel), `${rel} が出力される`);
      }
      assert.equal(existsOut(dir, "en/images/x.png"), false);
      assert.equal(existsOut(dir, "en/docs/b.html"), false, "翻訳の無いページは英語の URL に出さない");
      assert.equal(existsOut(dir, "README.en.html"), false);
      assert.equal(listFiles(path.join(dir, "_site")).filter((f) => f.endsWith(".png")).length, 1);
      assert.match(readOut(dir, "docs/a.html"), /ページA/);
      assert.match(readOut(dir, "en/docs/a.html"), /Page A/);
      assert.match(readOut(dir, "en/index.html"), /<h1[^>]*>Documents/);
      assert.match(readOut(dir, "en/guide/index.html"), /The guide entry page/);
      assert.match(readOut(dir, "en/ref/index.html"), /index\.en\.md/);
      // ログ: 言語ごとのページ数と翻訳の無いページ
      assert.match(result.stdout, /^Languages: ja,en \(base: ja\)$/m);
      assert.match(result.stdout, /^ {2}ja: 5 pages$/m);
      assert.match(result.stdout, /^ {2}en: 5 pages$/m);
      assert.match(result.stdout, /Not translated into en: 1 \(docs\/b\.md\)/);
      assert.deepEqual(brokenSiteLinks(dir), []);
    });
  });

  test("基本言語のページは LANGUAGES=ja の1言語のときと同じ場所に、同じ中身で出る", () => {
    withSite(FIXTURE_A, {}, (multi) => {
      withSite(FIXTURE_A, {}, (single) => {
        assert.equal(runBuild(multi, A_ENV).status, 0);
        assert.equal(runBuild(single, { LANGUAGES: "ja", NAV_ENABLED: "true" }).status, 0);
        for (const rel of [
          "index.html",
          "README.html",
          "docs/a.html",
          "docs/b.html",
          "guide/index.html",
          "ref/index.html",
          "search-index.json",
        ]) {
          // 言語切り替えボタンだけが違う(1言語のページには無い)
          const multiOut = readOut(multi, rel);
          assert.equal(rel.endsWith(".html") ? stripLangParts(multiOut) : multiOut, readOut(single, rel), rel);
        }
      });
    });
  });

  test("<html lang> と画面の文言はページの言語", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, A_ENV).status, 0);
      const ja = readOut(dir, "docs/a.html");
      const en = readOut(dir, "en/docs/a.html");
      assert.equal(htmlLang(ja), "ja");
      assert.equal(htmlLang(en), "en");
      assert.equal(htmlLang(readOut(dir, "en/index.html")), "en");
      // スキップ・目次・前後・ナビ
      assert.match(en, />Skip to content</);
      assert.match(en, />Contents</);
      assert.match(en, /<span>Previous<\/span>/);
      assert.match(en, /<span>Next<\/span>/);
      assert.match(en, /aria-label="Site pages"/);
      assert.match(ja, />本文へスキップ</);
      assert.match(ja, />目次</);
      assert.match(ja, /<span>前のページ<\/span>/);
      // 脚注・注意書き
      assert.match(en, />Footnotes</);
      assert.match(en, />Warning</);
      const enTop = readOut(dir, "en/index.html");
      assert.match(enTop, />Footnotes</);
      assert.match(enTop, />Note</);
      const jaTop = readOut(dir, "index.html");
      assert.match(jaTop, />脚注</);
      assert.match(jaTop, />補足</);
    });
  });

  test("ナビ: その言語のページだけ。並びは基本言語の順で、基本言語の版の無いページは後ろ", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, A_ENV).status, 0);
      const enNav = hrefsOf(navOf(stripLangParts(readOut(dir, "en/docs/a.html"))));
      assert.deepEqual(enNav, [
        "/en/README.html",
        "/en/docs/a.html",
        "/en/docs/en-only.html",
        "/en/guide/README.html",
        "/en/ref/index.html",
      ]);
      const jaNav = hrefsOf(navOf(stripLangParts(readOut(dir, "docs/a.html"))));
      assert.deepEqual(jaNav, ["/README.html", "/docs/a.html", "/docs/b.html", "/guide/README.html", "/ref/index.html"]);
    });
    // order を書くと並び替わる
    withSite(FIXTURE_A, { "docs/en-only.en.md": "---\norder: 1\n---\n# English only\n" }, (dir) => {
      assert.equal(runBuild(dir, A_ENV).status, 0);
      const enNav = hrefsOf(navOf(stripLangParts(readOut(dir, "en/docs/a.html"))));
      assert.ok(enNav.indexOf("/en/docs/en-only.html") < enNav.indexOf("/en/docs/a.html"), enNav.join(", "));
    });
  });

  test("前後のページ・検索は言語ごと", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, A_ENV).status, 0);
      const en = readOut(dir, "en/docs/a.html");
      assert.match(en, /data-index="\/en\/search-index\.json"/);
      assert.match(readOut(dir, "docs/a.html"), /data-index="\/search-index\.json"/);
      const pager = en.match(/<nav class="tsuzuri-pager"[\s\S]*?<\/nav>/)[0];
      assert.deepEqual(hrefsOf(pager), ["/en/README.html", "/en/docs/en-only.html"]);
      const enUrls = JSON.parse(readOut(dir, "en/search-index.json")).map((p) => p.u);
      // index 型の入口(ref/index.en.md)は1言語のときと同じく自分の URL(/en/ref/index.html)
      assert.deepEqual(enUrls.sort(), ["/en/", "/en/docs/a.html", "/en/docs/en-only.html", "/en/guide/", "/en/ref/index.html"]);
      const jaUrls = JSON.parse(readOut(dir, "search-index.json")).map((p) => p.u);
      assert.ok(jaUrls.every((u) => !u.startsWith("/en/")), jaUrls.join(", "));
      assert.equal(jaUrls.length, 5);
    });
  });

  for (const basePath of ["", "/repo"]) {
    test(`本文のリンクはリンク元の言語で決まる(BASE_PATH=${basePath || "なし"})`, () => {
      withSite(FIXTURE_A, {}, (dir) => {
        const result = runBuild(dir, { ...A_ENV, BASE_PATH: basePath, STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        const b = basePath;
        const main = (html) => html.slice(html.indexOf("<main"));
        const en = main(readOut(dir, "en/docs/a.html"));
        const enHrefs = hrefsOf(en);
        for (const want of [`${b}/en/guide/`, `${b}/en/`, `${b}/en/docs/a.html`, `${b}/docs/b.html`, `${b}/en/ref/`]) {
          assert.ok(enHrefs.includes(want), `${want} が en のページにある: ${enHrefs.join(", ")}`);
        }
        assert.match(en, new RegExp(`<img src="${b}/images/x\\.png"`));
        const ja = hrefsOf(main(readOut(dir, "docs/a.html")));
        for (const want of [`${b}/guide/`, `${b}/`, `${b}/docs/b.html`, `${b}/ref/`]) {
          assert.ok(ja.includes(want), `${want} が ja のページにある: ${ja.join(", ")}`);
        }
        assert.ok(!ja.some((h) => h.startsWith(`${b}/en/`)), ja.join(", "));
        assert.deepEqual(brokenSiteLinks(dir, basePath), []);
      });
    });

    test(`404: 基本言語が先頭、次に en。戻るリンクに BASE_PATH が付く(BASE_PATH=${basePath || "なし"})`, () => {
      withSite(FIXTURE_A, {}, (dir) => {
        assert.equal(runBuild(dir, { ...A_ENV, BASE_PATH: basePath }).status, 0);
        const html = readOut(dir, "404.html");
        const ja = html.indexOf('<div lang="ja">');
        const en = html.indexOf('<div lang="en">');
        assert.ok(ja >= 0 && en > ja, "ja のかたまりが先、en が次");
        assert.match(html.slice(ja, en), /ページが見つかりません/);
        assert.match(html.slice(en), /Page not found/);
        const hrefs = hrefsOf(html.slice(html.indexOf("<main")));
        assert.ok(hrefs.includes(`${basePath}/`), hrefs.join(", "));
        assert.ok(hrefs.includes(`${basePath}/en/`), hrefs.join(", "));
        assert.equal(htmlLang(html), "ja");
        // URL の言語の案内だけを見せるスクリプト(BASE_PATH を取り除いて判定する)
        assert.match(html, /<head>[\s\S]*const m=\{"en":"en"\}[\s\S]*<\/head>/);
        assert.ok(html.includes(`const b=${JSON.stringify(basePath)}`));
      });
    });
  }

  test("404: 1言語のサイトには言語を切り替えるスクリプトを入れない", () => {
    withSite(null, { "README.md": "# Home\n" }, (dir) => {
      assert.equal(runBuild(dir, { LANGUAGES: "ja" }).status, 0);
      assert.doesNotMatch(readOut(dir, "404.html"), /main:has\(/);
    });
  });

  test("sitemap.xml に両言語のページ、sitemap.json に言語の情報", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      const result = runBuild(dir, { ...A_ENV, SITE_ORIGIN: "https://example.com", SITEMAP_JSON: "true" });
      assert.equal(result.status, 0, result.stderr);
      const xml = readOut(dir, "sitemap.xml");
      for (const loc of ["https://example.com/", "https://example.com/en/", "https://example.com/en/docs/a.html", "https://example.com/docs/b.html"]) {
        assert.ok(xml.includes(`<loc>${loc}</loc>`), loc);
      }
      const json = JSON.parse(readOut(dir, "sitemap.json"));
      assert.deepEqual(json.languages, ["ja", "en"]);
      assert.equal(json.lang, "ja");
      assert.equal(json.root, "README.md");
      assert.equal(json.pages.find((p) => p.rel === "docs/a.en.md").lang, "en");
      assert.equal(json.pages.find((p) => p.rel === "docs/a.md").lang, "ja");
      assert.deepEqual(Object.keys(json.trees), ["ja", "en"]);
      assert.deepEqual(json.tree, json.trees.ja, "tree は基本言語の木");
      // canonical は自分の URL
      assert.match(readOut(dir, "en/docs/a.html"), /<link rel="canonical" href="https:\/\/example\.com\/en\/docs\/a\.html">/);
    });
  });
});

describe("build-docs.mjs :: 多言語 B(LANGUAGES=en,ja)", () => {
  test("日本語が /ja/ の下、英語が今の場所", () => {
    withSite(FIXTURE_B, {}, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "en,ja", NAV_ENABLED: "true", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      for (const rel of ["index.html", "README.html", "docs/a.html", "docs/b.html", "guide/index.html", "ja/index.html", "ja/README.html", "ja/docs/a.html", "ja/guide/index.html", "ja/search-index.json"]) {
        assert.ok(existsOut(dir, rel), rel);
      }
      assert.equal(htmlLang(readOut(dir, "docs/a.html")), "en");
      assert.equal(htmlLang(readOut(dir, "ja/docs/a.html")), "ja");
      assert.match(readOut(dir, "index.html"), /English is the base language/);
      assert.match(readOut(dir, "ja/index.html"), /日本語版のトップです/);
      const jaHrefs = hrefsOf(readOut(dir, "ja/docs/a.html").split("<main")[1]);
      assert.ok(jaHrefs.includes("/ja/") && jaHrefs.includes("/ja/guide/") && jaHrefs.includes("/docs/b.html"), jaHrefs.join(", "));
      const enHrefs = hrefsOf(readOut(dir, "docs/a.html").split("<main")[1]);
      assert.ok(enHrefs.includes("/") && enHrefs.includes("/guide/"), enHrefs.join(", "));
      assert.deepEqual(brokenSiteLinks(dir), []);
      const html404 = readOut(dir, "404.html");
      assert.ok(html404.indexOf('<div lang="en">') < html404.indexOf('<div lang="ja">'));
    });
  });

  test("基本言語の印付きの優先(多言語): README.md は出さず、README.en.md・README.ja.md がトップ", () => {
    withSite(
      null,
      {
        "README.md": "# 日本語の README\n\nmarker-plain-readme [a](docs/a.md)\n",
        "README.en.md": "# Home EN\n\nmarker-home-en [a](docs/a.md)\n",
        "README.ja.md": "# ホーム\n\nmarker-home-ja [a](docs/a.ja.md)\n",
        "docs/a.md": "# A plain\n\nmarker-plain-a\n",
        "docs/a.en.md": "# A en\n\nmarker-a-en\n",
        "docs/a.ja.md": "# A ja\n\nmarker-a-ja\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en,ja", STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(readOut(dir, "index.html"), /marker-home-en/);
        assert.match(readOut(dir, "ja/index.html"), /marker-home-ja/);
        assert.match(readOut(dir, "docs/a.html"), /marker-a-en/);
        assert.match(readOut(dir, "ja/docs/a.html"), /marker-a-ja/);
        const outputs = listFiles(path.join(dir, "_site")).map((f) => fs.readFileSync(outAbs(dir, f), "utf-8"));
        assert.ok(!outputs.some((text) => /marker-plain-(readme|a)/.test(text)), "印の無い README.md・docs/a.md は出さない");
        // 使わなかったファイルの一覧に、印の無い README.md・docs/a.md が出る(翻訳集めで選ばれなかったものも)
        const notUsed = result.stdout.match(/^Not used [^\n]*$/m)?.[0] ?? "";
        assert.match(notUsed, /README\.md → README\.en\.md/);
        assert.match(notUsed, /docs\/a\.md → docs\/a\.en\.md/);
      }
    );
  });
});

describe("build-docs.mjs :: 多言語 C(異常系・言語の追加)", () => {
  test("README.en.md が無い → 警告、ビルドは成功(STRICT_LINKS=true でも)", () => {
    withSite(FIXTURE_A, { "README.en.md": null }, (dir) => {
      const result = runBuild(dir, { ...A_ENV, STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(
        result.stderr,
        /\[build-docs\] English\(en\)のトップページ\(README\.en\.md\)が見つかりません。翻訳の無いページの言語切り替えボタンには English を出しません。/
      );
      assert.equal(existsOut(dir, "en/index.html"), false);
      assert.ok(existsOut(dir, "en/docs/a.html"));
      // トップの無い言語は 404 の案内に入れない
      assert.equal(readOut(dir, "404.html").includes('<div lang="en">'), false);
    });
  });

  test("本物の en/docs/a.md → 先頭のフォルダの警告と重複の警告、STRICT_LINKS=true で失敗", () => {
    const extra = {
      "README.md": fs.readFileSync(path.join(FIXTURE_A, "README.md"), "utf-8") + "\n[本物の en](en/docs/a.md)\n",
      "en/docs/a.md": "# 本物の en フォルダ\n",
    };
    withSite(FIXTURE_A, extra, (dir) => {
      const result = runBuild(dir, A_ENV);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /多言語のURL\(\/en\/\)と同じ名前のフォルダ en のページがあります。出力先が重なるおそれがあります。/);
      assert.match(result.stderr, /出力先 en\/docs\/a\.html が重複しています/);
      const strict = runBuild(dir, { ...A_ENV, STRICT_LINKS: "true" });
      assert.equal(strict.status, 1);
      assert.match(strict.stderr, /出力先の重複: en\/docs\/a\.html/);
    });
  });

  test("翻訳の重複(大文字・小文字を区別するファイルシステム): docs/a.en.md と docs/a.EN.md", (t) => {
    const extra = {
      "README.md": fs.readFileSync(path.join(FIXTURE_A, "README.md"), "utf-8") + "\n[upper](docs/a.EN.md)\n",
      "docs/a.EN.md": "# Page A upper\n\nmarker-upper\n",
    };
    withSite(FIXTURE_A, extra, (dir) => {
      const names = fs.readdirSync(path.join(dir, "docs"));
      if (!(names.includes("a.en.md") && names.includes("a.EN.md"))) {
        t.skip("大文字・小文字を区別しないファイルシステムでは両方を作れない");
        return;
      }
      const result = runBuild(dir, A_ENV);
      assert.equal(result.status, 0, result.stderr);
      const m = result.stderr.match(/\[build-docs\] (docs\/a\.(?:en|EN)\.md) は (docs\/a\.(?:en|EN)\.md) と同じページの同じ言語版のため使いません。/);
      assert.ok(m, result.stderr);
      const kept = m[2];
      const html = readOut(dir, "en/docs/a.html");
      if (kept === "docs/a.EN.md") assert.match(html, /marker-upper/);
      else assert.doesNotMatch(html, /marker-upper/);
      const nav = hrefsOf(navOf(stripLangParts(html)));
      assert.equal(nav.filter((h) => h === "/en/docs/a.html").length, 1);
      const urls = JSON.parse(readOut(dir, "en/search-index.json")).map((p) => p.u);
      assert.equal(urls.filter((u) => u === "/en/docs/a.html").length, 1);
      const strict = runBuild(dir, { ...A_ENV, STRICT_LINKS: "true" });
      assert.equal(strict.status, 1);
      assert.match(strict.stderr, /翻訳の重複: docs\/a\.(?:en|EN)\.md/);
    });
  });

  test("大文字・小文字を区別しないファイルシステム: README.pt-BR.md だけ → pt-br/index.html、重複の警告なし", (t) => {
    if (!CASE_INSENSITIVE) {
      t.skip("大文字・小文字を区別するファイルシステムでは確かめない(crawler の単体テストで確かめる)");
      return;
    }
    withSite(FIXTURE_A, { "README.pt-BR.md": "# Início\n\nmarker-pt\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "ja,en,pt-BR", NAV_ENABLED: "true", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "pt-br/index.html");
      assert.match(html, /marker-pt/);
      assert.equal(htmlLang(html), "pt-BR");
      assert.doesNotMatch(logOf(result), /同じページの同じ言語版/);
      const nav = hrefsOf(navOf(stripLangParts(html)));
      assert.deepEqual(nav, ["/pt-br/README.html"]);
    });
  });

  test("設定ファイルに LANG=ja と LANGUAGES=ja,en → 廃止の警告、結果は A と同じ", () => {
    withSite(FIXTURE_A, { ".github/docs-pages.config": "LANG=ja\nLANGUAGES=ja,en\nNAV_ENABLED=true\n" }, (withFile) => {
      withSite(FIXTURE_A, {}, (plain) => {
        const result = runBuild(withFile, { LANGUAGES: null });
        assert.equal(result.status, 0, result.stderr);
        assert.match(logOf(result), /\[config\] LANG は廃止しました。/);
        assert.equal(runBuild(plain, A_ENV).status, 0);
        const files = listFiles(path.join(plain, "_site"));
        assert.deepEqual(listFiles(path.join(withFile, "_site")), files);
        for (const rel of files) assert.equal(readOut(withFile, rel), readOut(plain, rel), rel);
      });
    });
  });
});

describe("build-docs.mjs :: 404 とフォルダへのリンクの見出し(1言語。T-012 の変化の確かめ)", () => {
  test("LANGUAGES=en で 404.md と 404.en.md が両方ある → 404.en.md を使う", () => {
    withSite(
      null,
      { "README.md": "# Home\n", "404.md": "# Plain 404\n\nmarker-404-plain\n", "404.en.md": "# En 404\n\nmarker-404-en\n" },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en" });
        assert.equal(result.status, 0, result.stderr);
        const html = readOut(dir, "404.html");
        assert.match(html, /marker-404-en/);
        assert.doesNotMatch(html, /marker-404-plain/);
      }
    );
  });

  test("集めたページ(404.en.md)が 404.html に書かれるときは既定の 404 を作らず、重複にならない", () => {
    withSite(null, { "README.md": "# Home\n\n[nf](404.en.md)\n", "404.en.md": "# Custom\n\nmarker-404-linked\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(readOut(dir, "404.html"), /marker-404-linked/);
      assert.doesNotMatch(logOf(result), /重複/);
    });
  });

  test("フォルダへのリンクの見出しは index 型の入口(実際に /dir/ で出るページ)で調べる", () => {
    withSite(
      null,
      {
        "README.md": "# Home\n\n[d](d/) [i](d/index.md) [r](d/README.md) [x](d/#idx-only) [y](d/#readme-only)\n",
        "d/index.md": "# Index\n\n## Idx only\n",
        "d/README.md": "# Readme\n\n## Readme only\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "ja" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stderr, /リンク先のページに見出しが見つからないリンク: 1 件/);
        assert.match(result.stderr, /d\/index\.md#readme-only/);
        assert.doesNotMatch(result.stderr, /#idx-only/);
        assert.match(readOut(dir, "d/index.html"), /Idx only/);
      }
    );
  });
});

describe("build-docs.mjs :: 言語切り替えボタンと hreflang", () => {
  for (const basePath of ["", "/repo"]) {
    test(`ボタンの行き先: 翻訳があればその版、無ければその言語のトップ(BASE_PATH=${basePath || "なし"})`, () => {
      withSite(FIXTURE_A, {}, (dir) => {
        const result = runBuild(dir, { ...A_ENV, BASE_PATH: basePath, STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        const b = basePath;
        const a = langSwitchOf(readOut(dir, "docs/a.html"));
        assert.match(a, new RegExp(`href="${b}/en/docs/a\\.html" hreflang="en"`));
        assert.doesNotMatch(a, /data-untranslated/);
        assert.match(a, /<span lang="en">English<\/span>/);
        const back = langSwitchOf(readOut(dir, "en/docs/a.html"));
        assert.match(back, new RegExp(`href="${b}/docs/a\\.html" hreflang="ja"`));
        const bPage = langSwitchOf(readOut(dir, "docs/b.html"));
        assert.match(bPage, new RegExp(`href="${b}/en/" hreflang="en" data-untranslated`));
        const enOnly = langSwitchOf(readOut(dir, "en/docs/en-only.html"));
        assert.match(enOnly, new RegExp(`href="${b}/" hreflang="ja" data-untranslated`));
        // トップどうし
        assert.match(langSwitchOf(readOut(dir, "index.html")), new RegExp(`href="${b}/en/"`));
        assert.match(langSwitchOf(readOut(dir, "en/index.html")), new RegExp(`href="${b}/"`));
        // ボタンのリンクも含めて、サイト内のリンクがすべて実在する
        assert.deepEqual(brokenSiteLinks(dir, basePath), []);
      });
    });
  }

  test("ボタンはナビの見出しの中で、サイト名の後・「メニュー」の前", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, { ...A_ENV, SITE_NAME: "Tsuzuri" }).status, 0);
      const head = readOut(dir, "docs/a.html").match(/<div class="tsuzuri-nav-head">[\s\S]*?<\/div>/)[0];
      const name = head.indexOf("<p>Tsuzuri</p>");
      const sw = head.indexOf('<a class="tsuzuri-lang-switch"');
      const menu = head.indexOf('<label for="tsuzuri-nav-toggle"');
      assert.ok(name >= 0 && sw > name && menu > sw, head);
      // ナビがあるときは本文の上の欄を使わない
      assert.doesNotMatch(readOut(dir, "docs/a.html"), /tsuzuri-lang-bar/);
    });
  });

  test("NAV_ENABLED=false: <main> の直後に本文の上の欄", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, { LANGUAGES: "ja,en" }).status, 0);
      const html = readOut(dir, "docs/a.html");
      assert.match(html, /<main[^>]*>\n<div class="tsuzuri-lang-bar"><a class="tsuzuri-lang-switch" href="\/en\/docs\/a\.html"/);
      assert.doesNotMatch(html, /<nav aria-label/);
    });
  });

  test("README.en.md が無い → 翻訳の無いページにはボタンを出さない(翻訳のあるページには出す)", () => {
    withSite(FIXTURE_A, { "README.en.md": null }, (dir) => {
      assert.equal(runBuild(dir, A_ENV).status, 0);
      assert.equal(langSwitchOf(readOut(dir, "docs/b.html")), "");
      assert.equal(langSwitchOf(readOut(dir, "index.html")), "");
      assert.match(langSwitchOf(readOut(dir, "docs/a.html")), /href="\/en\/docs\/a\.html"/);
    });
  });

  test("3言語: ボタンがメニュー(<details>)になり、今の言語に aria-current", () => {
    withSite(FIXTURE_A, { "README.pt-BR.md": "# Início\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "ja,en,pt-BR", NAV_ENABLED: "true", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      const menu = langSwitchOf(readOut(dir, "docs/a.html"));
      assert.match(menu, /^<details class="tsuzuri-lang-menu"><summary class="tsuzuri-lang-switch"/);
      const links = [...menu.matchAll(/<a href="([^"]*)" hreflang="([^"]*)"([^>]*)>/g)].map((m) => [m[1], m[2], m[3]]);
      assert.deepEqual(
        links.map(([href, tag]) => [href, tag]),
        [["/docs/a.html", "ja"], ["/en/docs/a.html", "en"], ["/pt-br/", "pt-BR"]]
      );
      assert.match(links[0][2], /aria-current="true"/);
      assert.match(links[2][2], /data-untranslated/);
      assert.deepEqual(brokenSiteLinks(dir), []);
    });
  });

  test("hreflang: SITE_ORIGIN があり、noindex でない言語版が2つ以上のときだけ", () => {
    const origin = "https://example.com";
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, { ...A_ENV, SITE_ORIGIN: origin }).status, 0);
      const want = [
        `<link rel="alternate" hreflang="ja" href="${origin}/docs/a.html">`,
        `<link rel="alternate" hreflang="en" href="${origin}/en/docs/a.html">`,
        `<link rel="alternate" hreflang="x-default" href="${origin}/docs/a.html">`,
      ].join("\n");
      for (const rel of ["docs/a.html", "en/docs/a.html"]) {
        const html = readOut(dir, rel);
        assert.ok(html.includes(want), `${rel} に hreflang の3行`);
        assert.ok(html.indexOf('rel="canonical"') < html.indexOf('rel="alternate"'), "canonical の後");
      }
      assert.doesNotMatch(readOut(dir, "docs/b.html"), /rel="alternate"/);
      assert.doesNotMatch(readOut(dir, "404.html"), /rel="alternate"/);
      assert.doesNotMatch(readOut(dir, "docs/a.html"), /og:locale/);
    });
    // 片方が noindex → どちらにも出ない
    withSite(FIXTURE_A, { "docs/a.en.md": "---\nnoindex: true\n---\n# Page A\n" }, (dir) => {
      assert.equal(runBuild(dir, { ...A_ENV, SITE_ORIGIN: origin }).status, 0);
      assert.doesNotMatch(readOut(dir, "docs/a.html"), /rel="alternate"/);
      assert.doesNotMatch(readOut(dir, "en/docs/a.html"), /rel="alternate"/);
    });
    // SITE_ORIGIN なし → 出ない
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, A_ENV).status, 0);
      assert.doesNotMatch(readOut(dir, "docs/a.html"), /rel="alternate"/);
    });
  });

  test("基本言語の印付き(LANGUAGES=en,ja): ボタンが README.en.md ⇔ README.ja.md をつなぐ", () => {
    withSite(
      null,
      {
        "README.md": "# 日本語の README\n",
        "README.en.md": "# Home EN\n",
        "README.ja.md": "# ホーム\n",
      },
      (dir) => {
        assert.equal(runBuild(dir, { LANGUAGES: "en,ja", NAV_ENABLED: "true" }).status, 0);
        assert.match(langSwitchOf(readOut(dir, "index.html")), /href="\/ja\/" hreflang="ja"/);
        assert.doesNotMatch(langSwitchOf(readOut(dir, "index.html")), /data-untranslated/);
        assert.match(langSwitchOf(readOut(dir, "ja/index.html")), /href="\/" hreflang="en"/);
      }
    );
  });

  test("404 と1言語のサイトにはボタンも hreflang も無い", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      assert.equal(runBuild(dir, { ...A_ENV, SITE_ORIGIN: "https://example.com" }).status, 0);
      assert.doesNotMatch(readOut(dir, "404.html"), /tsuzuri-lang-(switch|menu|bar)/);
    });
    withSite(FIXTURE_A, {}, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "ja", NAV_ENABLED: "true", SITE_ORIGIN: "https://example.com" });
      assert.equal(result.status, 0, result.stderr);
      for (const rel of listFiles(path.join(dir, "_site")).filter((f) => f.endsWith(".html"))) {
        const html = readOut(dir, rel);
        assert.doesNotMatch(html, /tsuzuri-lang-(switch|menu|bar)|rel="alternate"/, rel);
      }
    });
  });

  test("ログ: ページ数が1なら単数形", () => {
    withSite(null, { "README.md": "# Home\n", "README.en.md": "# Home\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "ja,en" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^ {2}ja: 1 page$/m);
      assert.match(result.stdout, /^ {2}en: 1 page$/m);
    });
  });
});

describe("build-docs.mjs :: hreflang と SITE_ORIGIN(レビューの気づき)", () => {
  test("hreflang の URL に BASE_PATH が付く", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      const origin = "https://example.com";
      assert.equal(runBuild(dir, { ...A_ENV, SITE_ORIGIN: origin, BASE_PATH: "/repo" }).status, 0);
      const want = [
        `<link rel="alternate" hreflang="ja" href="${origin}/repo/docs/a.html">`,
        `<link rel="alternate" hreflang="en" href="${origin}/repo/en/docs/a.html">`,
        `<link rel="alternate" hreflang="x-default" href="${origin}/repo/docs/a.html">`,
      ].join("\n");
      for (const rel of ["docs/a.html", "en/docs/a.html"]) assert.ok(readOut(dir, rel).includes(want), rel);
      // トップどうし(フォルダの URL)
      const top = readOut(dir, "en/index.html");
      assert.ok(top.includes(`<link rel="alternate" hreflang="ja" href="${origin}/repo/">`), "ja のトップ");
      assert.ok(top.includes(`<link rel="alternate" hreflang="en" href="${origin}/repo/en/">`), "en のトップ");
    });
  });

  test("SITE_ORIGIN 付きでも、基本言語のページは1言語のときと同じ(canonical・og:url を含む)", () => {
    const env = { NAV_ENABLED: "true", SITE_ORIGIN: "https://example.com" };
    withSite(FIXTURE_A, {}, (multi) => {
      withSite(FIXTURE_A, {}, (single) => {
        assert.equal(runBuild(multi, { ...env, LANGUAGES: "ja,en" }).status, 0);
        assert.equal(runBuild(single, { ...env, LANGUAGES: "ja" }).status, 0);
        for (const rel of ["index.html", "README.html", "docs/a.html", "docs/b.html", "guide/index.html", "ref/index.html"]) {
          const singleOut = readOut(single, rel);
          assert.match(singleOut, /<link rel="canonical" href="https:\/\/example\.com\//, `${rel} に canonical`);
          assert.match(singleOut, /<meta property="og:url" content="https:\/\/example\.com\//, `${rel} に og:url`);
          assert.equal(stripLangParts(readOut(multi, rel)), singleOut, rel);
        }
      });
    });
  });
});

describe("build-docs.mjs :: リポジトリ情報(多言語)", () => {
  test("文言はページの言語。値は全言語で同じ", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      const gh = { GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "o/r", GITHUB_SHA: "abc" };
      assert.equal(runBuild(dir, { ...A_ENV, ...gh, REPO_LINK: "true", REPO_VERSION: "v1", REPO_LICENSE: "MIT" }).status, 0);
      assert.ok(readOut(dir, "en/index.html").includes('>GitHub repository</a> · <span class="tsuzuri-repo-version">Version: v1</span> · <span class="tsuzuri-repo-license">License: MIT</span>'));
      assert.ok(readOut(dir, "index.html").includes('>GitHub リポジトリ</a> · <span class="tsuzuri-repo-version">バージョン: v1</span> · <span class="tsuzuri-repo-license">ライセンス: MIT</span>'));
    });
  });
});

describe("build-docs.mjs :: 編集リンク(多言語)", () => {
  test("翻訳のページは翻訳のファイル(*.en.md)を編集する。文言はページの言語", () => {
    withSite(FIXTURE_A, {}, (dir) => {
      const gh = {
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "o/r",
        GITHUB_SHA: "abc",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
      };
      assert.equal(runBuild(dir, { ...A_ENV, ...gh, EDIT_LINK: "true" }).status, 0);
      assert.ok(readOut(dir, "en/index.html").includes('href="https://github.com/o/r/edit/main/README.en.md">Edit this page on GitHub</a>'));
      assert.ok(readOut(dir, "index.html").includes('href="https://github.com/o/r/edit/main/README.md">このページを GitHub で編集</a>'));
    });
  });
});

