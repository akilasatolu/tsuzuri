import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/**
 * build-docs.mjs の E2E テスト: 基本言語の印付きファイルの優先(設計のテスト観点 7-D の1言語の部分)。
 *
 * 実際に `node build-docs.mjs` を子プロセスで動かし、一時フォルダに作ったサイトの出力を確かめる。
 * fixture はテストの中で一時フォルダに作る。
 * このファイルの runBuild は既定の言語を持たない(ビルドごとに LANGUAGES をはっきり指定する)。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_DIR, "..");
const SCRIPT_PATH = path.join(PROJECT_ROOT, ".github/scripts/build-docs.mjs");
const REAL_STYLES_DIR = path.join(PROJECT_ROOT, "styles");

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
  "LLMS_TXT",
  "GITHUB_ACTIONS",
];

function runBuild(cwd, overrides) {
  assert.ok(overrides && overrides.LANGUAGES, "このファイルのビルドは LANGUAGES をはっきり指定する");
  const env = { ...process.env };
  for (const key of CONFIG_ENV_KEYS) delete env[key];
  env.THEME = "none";
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete env[key];
    else env[key] = value;
  }
  return spawnSync(process.execPath, [SCRIPT_PATH], { cwd, env, encoding: "utf-8" });
}

/** files: { "道のり": "中身" } の一時サイトを作る(styles/base.css も置く) */
function makeSite(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-docs-base-marker-"));
  fs.mkdirSync(path.join(dir, "styles"), { recursive: true });
  fs.copyFileSync(path.join(REAL_STYLES_DIR, "base.css"), path.join(dir, "styles", "base.css"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function withSite(files, fn) {
  const dir = makeSite(files);
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const out = (dir, rel) => path.join(dir, "_site", rel);
const readOut = (dir, rel) => fs.readFileSync(out(dir, rel), "utf-8");
const existsOut = (dir, rel) => fs.existsSync(out(dir, rel));
const hrefsOf = (html) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
const navOf = (html) => {
  const m = html.match(/<nav aria-label="[^"]*">[\s\S]*?<\/nav>/);
  assert.ok(m, "ナビがあること");
  return m[0];
};
const countOf = (list, value) => list.filter((v) => v === value).length;
const warnLines = (result) => result.stderr.split("\n").filter((l) => l.trim());

// 1言語 LANGUAGES=en: README.md(GitHub 用。old.md へのリンク)と README.en.md(サイト用)、
// docs/a.md と docs/a.en.md、docs/b.md(印付きの無いページ)
const SITE_D = {
  "README.md": "# GitHub README\n\n[old](old.md)\n",
  "README.en.md": "# Home EN\n\nmarker-readme-en [a](docs/a.md) [b](docs/b.md)\n",
  "old.md": "# Old\n",
  "docs/a.md": "# A plain\n\nmarker-a-plain\n\n## Only plain\n",
  "docs/a.en.md": "# A en\n\nmarker-a-en\n\n## Only en\n",
  "docs/b.md": "# B\n\nmarker-b [x](../README.md) [y](a.md) [z](a.en.md) [h](a.md#only-en)\n",
};

describe("build-docs.mjs :: 基本言語の印付きの優先(1言語)", () => {
  test("README.en.md・docs/a.en.md が印の無い方の代わりに使われ、印の無い方は出ない", () => {
    withSite(SITE_D, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "en", NAV_ENABLED: "true", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);

      assert.match(readOut(dir, "index.html"), /marker-readme-en/);
      assert.match(readOut(dir, "README.html"), /marker-readme-en/);
      assert.doesNotMatch(readOut(dir, "index.html"), /GitHub README/);
      assert.equal(existsOut(dir, "old.html"), false, "README.md の中のリンクはたどらない");
      assert.match(readOut(dir, "docs/a.html"), /marker-a-en/);
      assert.doesNotMatch(readOut(dir, "docs/a.html"), /marker-a-plain/);
      assert.match(readOut(dir, "docs/b.html"), /marker-b/);
      // 印付きの名前の出力先は作らない
      assert.equal(existsOut(dir, "README.en.html"), false);
      assert.equal(existsOut(dir, "docs/a.en.html"), false);

      // ナビ・検索に README・docs/a が1回ずつ
      const nav = hrefsOf(navOf(readOut(dir, "docs/b.html")));
      assert.equal(countOf(nav, "/README.html"), 1);
      assert.equal(countOf(nav, "/docs/a.html"), 1);
      assert.equal(nav.length, 3, nav.join(", "));
      const urls = JSON.parse(readOut(dir, "search-index.json")).map((p) => p.u);
      assert.deepEqual(urls, ["/", "/docs/a.html", "/docs/b.html"]);

      // 使わなかったファイルの一覧(情報のログ)。警告は出ない
      assert.match(
        result.stdout,
        /Not used \(a marked base-language file is used instead\): README\.md → README\.en\.md, docs\/a\.md → docs\/a\.en\.md\n/
      );
      assert.deepEqual(warnLines(result), []);
      assert.match(result.stdout, /^Languages: en \(base: en\)$/m);
    });
  });

  test("印の無い名前・印付きの名前へのリンクがどちらも印を取った URL になり、見出しは印付きの方で調べる", () => {
    withSite(SITE_D, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      const hrefs = hrefsOf(readOut(dir, "docs/b.html"));
      assert.ok(hrefs.includes("/README.html"), hrefs.join(", ")); // ../README.md
      assert.equal(countOf(hrefs, "/docs/a.html"), 2, hrefs.join(", ")); // a.md と a.en.md
      assert.ok(hrefs.includes("/docs/a.html#only-en"), hrefs.join(", "));
    });
    // a.md にだけある見出しへのリンクは切れ扱い(a.en.md の見出しで調べるため)
    withSite({ ...SITE_D, "docs/b.md": "# B\n\n[p](a.md#only-plain)\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "en" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /リンク先のページに見出しが見つからないリンク: 1 件/);
      assert.match(result.stderr, /docs\/a\.en\.md#only-plain \(referenced from docs\/b\.md\)/);
      const strict = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
      assert.equal(strict.status, 1);
    });
  });

  test("印付きだけがある c.en.md への c.md のリンクは切れず /docs/c.html、使わなかったファイルの一覧にも出ない", () => {
    withSite(
      {
        "README.md": "# Home\n\n[c](docs/c.md) [c2](docs/c.en.md)\n",
        "docs/c.en.md": "# C en\n\nmarker-c-en\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(readOut(dir, "docs/c.html"), /marker-c-en/);
        assert.equal(countOf(hrefsOf(readOut(dir, "index.html")), "/docs/c.html"), 2);
        assert.doesNotMatch(result.stdout, /Not used/);
        assert.deepEqual(warnLines(result), []);
      }
    );
  });

  test("フォルダの入口: README.en.md が README.md より優先、index 型は README 型より優先", () => {
    withSite(
      {
        "README.md": "# Home\n\n[g](guide/) [h](guide2/) [i](guide2/index.md)\n",
        "guide/README.md": "# Guide plain\n\nmarker-guide-plain\n",
        "guide/README.en.md": "# Guide en\n\nmarker-guide-en\n",
        "guide2/index.md": "# Guide2 index\n\nmarker-guide2-index\n",
        "guide2/README.en.md": "# Guide2 readme en\n\nmarker-guide2-readme-en\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(readOut(dir, "guide/index.html"), /marker-guide-en/);
        assert.match(readOut(dir, "guide/README.html"), /marker-guide-en/);
        assert.match(readOut(dir, "guide2/index.html"), /marker-guide2-index/);
        assert.match(readOut(dir, "guide2/README.html"), /marker-guide2-readme-en/);
        const hrefs = hrefsOf(readOut(dir, "index.html"));
        assert.ok(hrefs.includes("/guide/") && hrefs.includes("/guide2/"), hrefs.join(", "));
        assert.match(result.stdout, /Not used [^\n]*guide\/README\.md → guide\/README\.en\.md/);
      }
    );
  });

  test("大文字の印 README.EN.md も印付きとして優先される", () => {
    withSite(
      {
        "README.md": "# GitHub README\n\nmarker-plain\n",
        "README.EN.md": "# Home EN\n\nmarker-upper-en\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(readOut(dir, "index.html"), /marker-upper-en/);
        assert.match(readOut(dir, "README.html"), /marker-upper-en/);
        assert.match(result.stdout, /Not used [^\n]*README\.md → README\.EN\.md/);
      }
    );
  });

  test("1言語のフォルダの入口: guide/README.en.md だけでも guide/index.html が出て、リンクは /guide/", () => {
    withSite(
      {
        "README.md": "# Home\n\n[g](guide/)\n",
        "guide/README.en.md": "# Guide en\n\nmarker-guide-en\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en", STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(readOut(dir, "guide/index.html"), /marker-guide-en/);
        assert.match(readOut(dir, "guide/README.html"), /marker-guide-en/);
        const hrefs = hrefsOf(readOut(dir, "index.html"));
        assert.ok(hrefs.includes("/guide/"), hrefs.join(", "));
        assert.ok(!hrefs.some((h) => h.startsWith("http")), "GitHub へのリンクにならない");
      }
    );
  });

  test("起点が印付きだけ: README.en.md だけでもビルドし、ナビのトップはサイト名、sitemap.json の root は README.en.md", () => {
    withSite({ "README.en.md": "marker-root-en-only\n" }, (dir) => {
      const result = runBuild(dir, {
        LANGUAGES: "en",
        NAV_ENABLED: "true",
        SITE_NAME: "My Site",
        SITEMAP_JSON: "true",
        STRICT_LINKS: "true",
      });
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /marker-root-en-only/);
      assert.match(html, /<title>My Site<\/title>/);
      assert.match(navOf(html), /<a href="\/README\.html" aria-current="page">My Site<\/a>/);
      assert.equal(JSON.parse(readOut(dir, "sitemap.json")).root, "README.en.md");
      assert.doesNotMatch(result.stdout, /Not used/, "README.md が無いので一覧に出さない");
    });
  });

  test("起点が両方とも無い → 中止し、新しい文言を出す", () => {
    withSite({ "other.md": "# Other\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "en" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /起点となる README\.md\(または README\.en\.md\)が見つかりません。処理を中止します。/);
      assert.equal(existsOut(dir, "index.html"), false);
    });
    // 基本言語と ROOT_MD に合わせて文言を作る
    withSite({ "docs/README.en.md": "# x\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "ja", ROOT_MD: "docs/README.md" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /起点となる docs\/README\.md\(または docs\/README\.ja\.md\)が見つかりません。/);
    });
  });

  test("README.md と README.en.md が両方ある1言語のサイトで、ナビのトップの表示名とページの <title> が同じ", () => {
    withSite(
      {
        "README.md": "# GitHub Title\n",
        "README.en.md": "no heading here\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "en", NAV_ENABLED: "true", SITE_NAME: "Site Name" });
        assert.equal(result.status, 0, result.stderr);
        const html = readOut(dir, "index.html");
        const title = html.match(/<title>([^<]*)<\/title>/)[1];
        const navTop = navOf(html).match(/<a href="\/README\.html"[^>]*>([^<]*)<\/a>/)[1];
        assert.equal(title, "Site Name");
        assert.equal(navTop, title);
      }
    );
  });

  test("LANGUAGES=ja でも Languages のログが出て、印の無いファイルだけのサイトは今と同じ URL", () => {
    withSite({ "README.md": "# Home\n\n[a](a.md)\n", "a.md": "# A\n" }, (dir) => {
      const result = runBuild(dir, { LANGUAGES: "ja" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /^Languages: ja \(base: ja\)$/m);
      assert.ok(hrefsOf(readOut(dir, "index.html")).includes("/a.html"));
      assert.doesNotMatch(result.stdout, /Not used/);
    });
  });

  test("isDirIndexRel: 印の無い Readme.md の order は使わず、README.ja.md の order は使う", () => {
    // 見つかった順は a → b → c。b/Readme.md(入口とみなさない)と c/README.ja.md(入口)に order: 1
    withSite(
      {
        "README.md": "# Home\n\n[a](a/page.md) [b](b/Readme.md) [c](c/README.ja.md)\n",
        "a/page.md": "# A page\n",
        "b/Readme.md": "---\norder: 1\n---\n# B readme\n",
        "c/README.ja.md": "---\norder: 1\n---\n# C readme ja\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "ja", NAV_ENABLED: "true", STRICT_LINKS: "true" });
        assert.equal(result.status, 0, result.stderr);
        const nav = navOf(readOut(dir, "index.html"));
        const summaries = [...nav.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1]);
        assert.deepEqual(summaries, ["c", "a", "b"]);
        // c/README.ja.md は印を取った c/README.html と、README 型の入口として c/index.html に出る
        assert.ok(existsOut(dir, "c/README.html") && existsOut(dir, "c/index.html"));
      }
    );
    // order の無いサイトでは見つかった順のまま
    withSite(
      {
        "README.md": "# Home\n\n[a](a/page.md) [b](b/Readme.md)\n",
        "a/page.md": "# A page\n",
        "b/Readme.md": "# B readme\n",
      },
      (dir) => {
        const result = runBuild(dir, { LANGUAGES: "ja", NAV_ENABLED: "true" });
        assert.equal(result.status, 0, result.stderr);
        const nav = navOf(readOut(dir, "index.html"));
        assert.deepEqual([...nav.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1]), ["a", "b"]);
      }
    );
  });
});
