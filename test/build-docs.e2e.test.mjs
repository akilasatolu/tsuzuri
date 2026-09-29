import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/**
 * build-docs.mjs (main() へ集約されたオーケストレーション層) の E2E テスト。
 *
 * main() は process.cwd() / process.env / process.exit を直接参照するため、
 * import して直接呼び出すのではなく、実際に `node build-docs.mjs` を
 * 子プロセスとして起動し、fs.mkdtempSync で作った一時ディレクトリを
 * cwd として渡すことで、実利用時と同じ経路(CLI実行)を検証する。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_DIR, "..");
const SCRIPT_PATH = path.join(PROJECT_ROOT, ".github/scripts/build-docs.mjs");
const REAL_STYLES_DIR = path.join(PROJECT_ROOT, "styles");
const FIXTURE_SITE = path.join(TEST_DIR, "fixtures", "site-basic");

// build-docs.mjs が参照する環境変数一覧。テスト間の汚染を防ぐため、
// 呼び出しごとに一旦すべて削除してから明示的に指定した値だけを設定する。
const CONFIG_ENV_KEYS = [
  "ROOT_MD",
  "OUT_DIR",
  "STYLE_FILE",
  "BASE_PATH",
  "SITE_ORIGIN",
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
  "GITHUB_ACTIONS",
];

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "build-docs-e2e-"));
}

// README.md / docs/a.md / docs/img.png のシンプルなサイト構成を tmp dir にコピーする。
function copyBasicSite(dir) {
  fs.cpSync(FIXTURE_SITE, dir, { recursive: true, filter: (src) => !src.includes("styles-fixture") });
}

// 実プロジェクトの styles/base.css・styles/wa.css (T-010成果物) を
// tmp dir 内の既定 STYLE_DIR ("styles") にコピーする(=既定THEME="wa"での
// 実運用と同じ構成を再現する)。
function copyRealBaseAndThemeStyles(dir, themeFile = "wa.css") {
  const stylesDir = path.join(dir, "styles");
  fs.mkdirSync(stylesDir, { recursive: true });
  fs.copyFileSync(path.join(REAL_STYLES_DIR, "base.css"), path.join(stylesDir, "base.css"));
  fs.copyFileSync(path.join(REAL_STYLES_DIR, themeFile), path.join(stylesDir, themeFile));
}

// フィクスチャ専用の STYLE_DIR ("styles-fixture") を tmp dir にコピーする。
// マーカーコメントのみの base.css / akari.css を持ち、T-012(styles/akari.css)の
// 完成有無に依存せずテーマカスケードの挙動を検証できる。
function copyFixtureStyleDir(dir) {
  fs.cpSync(path.join(FIXTURE_SITE, "styles-fixture"), path.join(dir, "styles-fixture"), {
    recursive: true,
  });
}

// sitemap.json(SITEMAP_JSON=true のときだけ出力)の内容を検証するテストが多いため、
// E2E では既定で SITEMAP_JSON=true にしておく(未設定時の挙動は個別のテストで確認する)。
function runBuild(cwd, overrides = {}) {
  const env = { ...process.env };
  for (const key of CONFIG_ENV_KEYS) delete env[key];
  env.SITEMAP_JSON = "true";
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [SCRIPT_PATH], { cwd, env, encoding: "utf-8" });
}

// 最後に readOut したビルドの出力先(extractStyleBlock が CSS ファイルを読むため)
let lastOutDir = "";
function readOut(dir, ...segs) {
  lastOutDir = path.join(dir, "_site");
  return fs.readFileSync(path.join(dir, "_site", ...segs), "utf-8");
}

// ページが読み込んでいる共通のCSSファイル(<link rel="stylesheet">)の中身を返す
function extractStyleBlock(html) {
  const m = html.match(/<link rel="stylesheet" href="\/(tsuzuri-[0-9a-f]{10}\.css)">/);
  assert.ok(m, "共通のCSSファイルを読み込んでいること");
  return fs.readFileSync(path.join(lastOutDir, m[1]), "utf-8");
}

describe("build-docs.mjs :: main (E2E)", () => {
  test("最重要回帰テスト: 新規キー全未設定でも旧352行版相当の生成物になる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir); // 既定 THEME=wa 相当

      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);

      // index.html が README.md から生成された内容と一致
      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /<title>Root Page<\/title>/);
      assert.match(indexHtml, /<h1 id="root-page">Root Page<\/h1>/);
      assert.match(indexHtml, /href="\/docs\/a\.html"/);
      assert.match(indexHtml, /src="\/docs\/img\.png"/);

      // ナビ・favicon・canonical など、設定していない要素は出力されない
      assert.doesNotMatch(indexHtml, /<nav/);
      // description を書いていないページも、本文の最初の段落から説明文を作る(v1.6.0〜)
      assert.match(indexHtml, /<meta name="description" content="See A and image img\.">/);
      assert.doesNotMatch(indexHtml, /<link rel="icon"/);
      assert.doesNotMatch(indexHtml, /<link rel="canonical"/);

      // 【v3修正の緩和基準】バイト単位一致ではなく、旧pageTemplateが出力していた
      // 個々のCSS宣言ブロック(=base.css/wa.cssの内容そのもの)が、順序を問わず
      // 連結後の<style>文字列に一字一句そのまま含まれていること。
      const styleBlock = extractStyleBlock(indexHtml);
      const baseCssContent = fs.readFileSync(path.join(REAL_STYLES_DIR, "base.css"), "utf-8");
      const waCssContent = fs.readFileSync(path.join(REAL_STYLES_DIR, "wa.css"), "utf-8");
      assert.ok(styleBlock.includes(baseCssContent), "base.css相当のブロックが含まれること");
      assert.ok(styleBlock.includes(waCssContent), ":root/@media(wa.css相当)のブロックが含まれること");

      // .nojekyll 存在
      assert.equal(readOut(dir, ".nojekyll"), "");

      // sitemap.json: 後方互換フィールド(pageRels/images/hierarchy/missing/root/basePath)が
      // 旧版の該当フィールドと同一内容であること。新規フィールド(pages/theme等)の追加は
      // T-008(sitemap.mjs)側で確定済みの仕様であり、本テストの対象外とする。
      const sitemap = JSON.parse(readOut(dir, "sitemap.json"));
      assert.equal(sitemap.root, "README.md");
      assert.equal(sitemap.basePath, "");
      assert.deepEqual(sitemap.pageRels.sort(), ["README.md", "docs/a.md"].sort());
      assert.deepEqual(sitemap.images, ["docs/img.png"]);
      assert.deepEqual(sitemap.missing, []);
      assert.equal(sitemap.customStyleApplied, false);
      assert.equal(sitemap.theme, "wa");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("THEME=akari実行時、base.css相当とakari.css相当が正しい順序で<style>に含まれる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);

      const result = runBuild(dir, { THEME: "akari", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexHtml = readOut(dir, "index.html");
      const styleBlock = extractStyleBlock(indexHtml);
      assert.ok(styleBlock.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(styleBlock.includes("/*AKARI_FIXTURE_MARKER*/"));
      assert.ok(
        styleBlock.indexOf("/*BASE_FIXTURE_MARKER*/") < styleBlock.indexOf("/*AKARI_FIXTURE_MARKER*/"),
        "baseCss -> themeCss の順で連結されること"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("THEME=none実行時はbase.css相当のみでtheme相当の目印文字列を含まない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);

      const result = runBuild(dir, { THEME: "none", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexHtml = readOut(dir, "index.html");
      const styleBlock = extractStyleBlock(indexHtml);
      assert.ok(styleBlock.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(!styleBlock.includes("/*AKARI_FIXTURE_MARKER*/"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("許可リスト内だがCSSファイル本体が存在しないTHEME→warn+themeCss空でビルド成功", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      // styles-fixture には base.css のみコピーし、akari.css を欠落させる
      const stylesDir = path.join(dir, "styles-fixture");
      fs.mkdirSync(stylesDir, { recursive: true });
      fs.copyFileSync(
        path.join(FIXTURE_SITE, "styles-fixture", "base.css"),
        path.join(stylesDir, "base.css")
      );

      const result = runBuild(dir, { THEME: "akari", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /akari\.css.*見つかりません/);

      const indexHtml = readOut(dir, "index.html");
      const styleBlock = extractStyleBlock(indexHtml);
      assert.ok(styleBlock.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(!styleBlock.includes("/*AKARI_FIXTURE_MARKER*/"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CUSTOM_DOMAIN設定時にCNAMEが正しく生成される", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      const result = runBuild(dir, { CUSTOM_DOMAIN: "docs.example.com" });
      assert.equal(result.status, 0, result.stderr);

      assert.equal(readOut(dir, "CNAME"), "docs.example.com\n");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("FAVICON_FILE不在時、warnしつつビルド成功しicon linkが出力されない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      const result = runBuild(dir, { FAVICON_FILE: "does-not-exist.ico" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /Favicon file not found/);

      const indexHtml = readOut(dir, "index.html");
      assert.doesNotMatch(indexHtml, /<link rel="icon"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("NAV_ENABLED=trueで<nav>が出力され、falseでは出力されない", () => {
    const dirTrue = makeTmpDir();
    const dirFalse = makeTmpDir();
    try {
      copyBasicSite(dirTrue);
      copyRealBaseAndThemeStyles(dirTrue);
      const resultTrue = runBuild(dirTrue, { NAV_ENABLED: "true" });
      assert.equal(resultTrue.status, 0, resultTrue.stderr);
      const indexTrue = readOut(dirTrue, "index.html");
      const aTrue = readOut(dirTrue, "docs", "a.html");
      assert.match(indexTrue, /<nav/);
      assert.match(aTrue, /<nav/);

      copyBasicSite(dirFalse);
      copyRealBaseAndThemeStyles(dirFalse);
      const resultFalse = runBuild(dirFalse); // NAV_ENABLED未設定=デフォルトfalse
      assert.equal(resultFalse.status, 0, resultFalse.stderr);
      const indexFalse = readOut(dirFalse, "index.html");
      assert.doesNotMatch(indexFalse, /<nav/);
    } finally {
      fs.rmSync(dirTrue, { recursive: true, force: true });
      fs.rmSync(dirFalse, { recursive: true, force: true });
    }
  });

  test("ROOT_MDに存在しないファイルを指定→終了コード1・標準エラーにメッセージ", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      const result = runBuild(dir, { ROOT_MD: "NOPE.md" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /NOPE\.md.*見つかりません/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("FAVICON_FILEがサブディレクトリ配下でもimageSetの同名ファイルと出力先が衝突しない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      // サブディレクトリ配下に favicon 本体を配置する
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(dir, "assets", "favicon.png"), "SUBDIR_FAVICON_CONTENT");

      // リポジトリ直下に「同じベースネームだが別ディレクトリ」の画像を配置し、
      // README.md からリンクすることで imageSet 側にも favicon.png を登録する。
      fs.writeFileSync(path.join(dir, "favicon.png"), "ROOT_IMAGE_FAVICON_CONTENT");
      fs.appendFileSync(path.join(dir, "README.md"), "\n\n![rootfav](favicon.png)\n");

      const result = runBuild(dir, { FAVICON_FILE: "assets/favicon.png" });
      assert.equal(result.status, 0, result.stderr);

      // favicon本体はリポジトリルートからの相対パス構造を維持して出力される
      const faviconOut = fs.readFileSync(path.join(dir, "_site", "assets", "favicon.png"), "utf-8");
      assert.equal(faviconOut, "SUBDIR_FAVICON_CONTENT");

      // imageSet側の同名ファイル(リポジトリ直下)は別パスに出力され、上書きされない
      const rootImageOut = fs.readFileSync(path.join(dir, "_site", "favicon.png"), "utf-8");
      assert.equal(rootImageOut, "ROOT_IMAGE_FAVICON_CONTENT");

      // <link rel="icon"> は新しい配置場所(サイト絶対パス)を指す
      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /<link rel="icon" href="\/assets\/favicon\.png">/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("description/ogImage/SITE_ORIGIN設定時、メタタグが正しくHTMLに反映される(ポジティブパス)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      fs.writeFileSync(
        path.join(dir, "README.md"),
        [
          "---",
          "description: This is a sample description for SEO.",
          "ogImage: docs/img.png",
          "---",
          "",
          "# Root Page",
          "",
          "See [A](docs/a.md) and image ![img](docs/img.png).",
          "",
        ].join("\n")
      );

      const result = runBuild(dir, { SITE_ORIGIN: "https://example.com" });
      assert.equal(result.status, 0, result.stderr);

      const indexHtml = readOut(dir, "index.html");
      assert.match(
        indexHtml,
        /<meta name="description" content="This is a sample description for SEO\.">/
      );
      assert.match(
        indexHtml,
        /<meta property="og:description" content="This is a sample description for SEO\.">/
      );
      assert.match(indexHtml, /<meta property="og:title" content="Root Page">/);
      assert.match(indexHtml, /<meta property="og:image" content="https:\/\/example\.com\/docs\/img\.png">/);
      assert.match(
        indexHtml,
        /<link rel="canonical" href="https:\/\/example\.com\/">/
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatterのtheme(組み込みテーマ名)がページ単位で適用される", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);
      // docs/a.md だけ frontmatter で theme: akari を指定する。
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        ["---", "theme: akari", "---", "# Page A", "", "Back to [root](../README.md)."].join("\n")
      );

      // サイト全体は THEME=none(=デフォルトではテーマ層を適用しない)。
      const result = runBuild(dir, { THEME: "none", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexStyle = extractStyleBlock(readOut(dir, "index.html"));
      assert.ok(indexStyle.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(
        !indexStyle.includes("/*AKARI_FIXTURE_MARKER*/"),
        "frontmatter未指定のページはサイト全体のTHEME(none)のまま"
      );

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(aStyle.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(
        aStyle.includes("/*AKARI_FIXTURE_MARKER*/"),
        "frontmatterでtheme: akariを指定したページだけ上書きされる"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatterのtheme(独自CSSファイルへのパス)がページ単位で適用される", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);
      fs.writeFileSync(
        path.join(dir, "my-custom-theme.css"),
        "/*CUSTOM_PATH_THEME_MARKER*/"
      );
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        [
          "---",
          "theme: my-custom-theme.css",
          "---",
          "# Page A",
          "",
          "Back to [root](../README.md).",
        ].join("\n")
      );

      const result = runBuild(dir, { THEME: "none", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexStyle = extractStyleBlock(readOut(dir, "index.html"));
      assert.ok(!indexStyle.includes("/*CUSTOM_PATH_THEME_MARKER*/"));

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(
        aStyle.includes("/*CUSTOM_PATH_THEME_MARKER*/"),
        "リポジトリルートからの相対パスで指定した独自CSSがそのまま読み込まれる"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatterのthemeが組み込みテーマ名にもファイルにも該当しない場合、warnしつつサイト全体のTHEMEにフォールバックする", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        [
          "---",
          "theme: no-such-file.css",
          "---",
          "# Page A",
          "",
          "Back to [root](../README.md).",
        ].join("\n")
      );

      const result = runBuild(dir, { THEME: "akari", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /no-such-file\.css.*見つかりません/);

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(
        aStyle.includes("/*AKARI_FIXTURE_MARKER*/"),
        "解決できないthemeはサイト全体のTHEME(akari)にフォールバックする"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatterでtheme: noneを指定するとそのページだけテーマ層を適用しない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        ["---", "theme: none", "---", "# Page A", "", "Back to [root](../README.md)."].join("\n")
      );

      const result = runBuild(dir, { THEME: "akari", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexStyle = extractStyleBlock(readOut(dir, "index.html"));
      assert.ok(indexStyle.includes("/*AKARI_FIXTURE_MARKER*/"));

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(!aStyle.includes("/*AKARI_FIXTURE_MARKER*/"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("styles/base.css自体が不在→致命的エラーで終了コード1", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      // styles/ ディレクトリを一切用意しない(base.css欠落)

      const result = runBuild(dir);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /base\.css.*見つかりません/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("SITE_NAME設定時、og:site_nameが出力され、ナビの見出しにも使われる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      const result = runBuild(dir, { SITE_NAME: "My Site", NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);

      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /<meta property="og:site_name" content="My Site">/);
      assert.match(indexHtml, /<div class="tsuzuri-nav-head"><p>My Site<\/p>/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ナビはディレクトリ階層に沿い、表示名はfrontmatterのtitle(無ければh1)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        ["---", "title: ページA", "---", "# Page A", "", "Back to [root](../README.md)."].join("\n")
      );

      const result = runBuild(dir, { NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);

      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /<li><a href="\/README\.html" aria-current="page">Root Page<\/a><\/li>/);
      assert.match(indexHtml, /<li><details open><summary>docs<\/summary><ul><li><a href="\/docs\/a\.html">ページA<\/a><\/li><\/ul><\/details><\/li>/);

      const sitemap = JSON.parse(readOut(dir, "sitemap.json"));
      assert.equal(sitemap.tree.children[1].name, "docs");
      assert.equal(sitemap.tree.children[1].children[0].title, "ページA");
      assert.equal(sitemap.pages.find((p) => p.rel === "docs/a.md").title, "ページA");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatterのthemeがリポジトリ外のファイルを指す場合は読み込まずフォールバックする", () => {
    const parent = makeTmpDir();
    const dir = path.join(parent, "repo");
    try {
      fs.mkdirSync(dir);
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);
      fs.writeFileSync(path.join(parent, "secret.css"), "/*SECRET_OUTSIDE_REPO*/");
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        ["---", "theme: ../secret.css", "---", "# Page A"].join("\n")
      );

      const result = runBuild(dir, { THEME: "akari", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /リポジトリの外/);

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(!aStyle.includes("SECRET_OUTSIDE_REPO"));
      assert.ok(aStyle.includes("/*AKARI_FIXTURE_MARKER*/"));
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  test("FAVICON_FILEがリポジトリ外を指す場合は無視し、出力先の外にもコピーしない", () => {
    const parent = makeTmpDir();
    const dir = path.join(parent, "repo");
    try {
      fs.mkdirSync(dir);
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(parent, "icon.png"), "png");

      const result = runBuild(dir, { FAVICON_FILE: "../icon.png" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /FAVICON_FILE.*リポジトリの外/);
      assert.doesNotMatch(readOut(dir, "index.html"), /<link rel="icon"/);
      assert.deepEqual(fs.readdirSync(parent).sort(), ["icon.png", "repo"]);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  test("OUT_DIRがリポジトリ外・リポジトリ直下を指す場合は終了コード1", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      for (const outDir of ["../out", ".", "/tmp"]) {
        const result = runBuild(dir, { OUT_DIR: outDir });
        assert.equal(result.status, 1, `OUT_DIR=${outDir}`);
        assert.match(result.stderr, /OUT_DIR/);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("見出しにidが付き、他ページの見出しへのリンク(#)がそのまま使える", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        "# Root Page\n\n[テーマの説明へ](docs/a.md#テーマ設定) [A](docs/a.md)\n"
      );
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        "# Page A\n\n## テーマ設定\n\n## Usage `theme`\n\n## Usage `theme`\n"
      );

      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);

      assert.match(readOut(dir, "index.html"), /href="\/docs\/a\.html#テーマ設定"/);
      const aHtml = readOut(dir, "docs", "a.html");
      assert.match(aHtml, /<h2 id="テーマ設定">テーマ設定<a class="tsuzuri-anchor" href="#テーマ設定"/);
      assert.match(aHtml, /<h2 id="usage-theme">Usage <code>theme<\/code><a class="tsuzuri-anchor"/);
      assert.match(aHtml, /<h2 id="usage-theme-1">/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("PDF等のリンク先ファイルもコピーされ、ドットファイルはコピーされない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "manual.pdf"), "%PDF");
      fs.writeFileSync(path.join(dir, ".env"), "SECRET=1");
      fs.writeFileSync(
        path.join(dir, "README.md"),
        "# Root Page\n\n[manual](docs/manual.pdf) [env](.env) [missing](nope.zip)\n"
      );

      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readOut(dir, "docs", "manual.pdf"), "%PDF");
      assert.ok(!fs.existsSync(path.join(dir, "_site", ".env")));
      assert.match(result.stderr, /リンク先のファイルが見つかりません: nope\.zip/);
      assert.deepEqual(JSON.parse(readOut(dir, "sitemap.json")).files.sort(), ["docs/manual.pdf", "nope.zip"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("サブディレクトリのREADME.mdはそのディレクトリのindex.htmlとしても出力される", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.mkdirSync(path.join(dir, "guide"));
      fs.writeFileSync(path.join(dir, "guide", "README.md"), "# Guide\n");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root Page\n\n[guide](guide/) [guide readme](guide/README.md)\n");

      const result = runBuild(dir, { SITE_ORIGIN: "https://example.com" });
      assert.equal(result.status, 0, result.stderr);
      // guide/ へのディレクトリリンクもたどれるよう、README.md へのリンクも置いている
      assert.equal(readOut(dir, "guide", "index.html"), readOut(dir, "guide", "README.html"));
      assert.match(readOut(dir, "index.html"), /href="\/guide\/"/);
      assert.match(readOut(dir, "guide", "index.html"), /<link rel="canonical" href="https:\/\/example\.com\/guide\/">/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("404.htmlが生成される(既定の内容。404.mdがあればその内容)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      let result = runBuild(dir, { NAV_ENABLED: "true", BASE_PATH: "/repo" });
      assert.equal(result.status, 0, result.stderr);
      let html = readOut(dir, "404.html");
      assert.match(html, /<title>ページが見つかりません<\/title>/);
      assert.match(html, /<a href="\/repo\/">トップページへ戻る<\/a>/);
      assert.match(html, /<meta name="robots" content="noindex">/);
      assert.match(html, /<nav aria-label="サイト内ページ">/);
      assert.doesNotMatch(html, /rel="canonical"/);

      result = runBuild(dir, { LANG: "en" });
      assert.match(readOut(dir, "404.html"), /<title>Page not found<\/title>/);

      fs.writeFileSync(path.join(dir, "404.md"), "---\ntitle: 迷子\n---\n# 迷子です\n");
      result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      html = readOut(dir, "404.html");
      assert.match(html, /<title>迷子<\/title>/);
      assert.match(html, /迷子です/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("SITE_ORIGIN設定時はsitemap.xmlを出力し(noindexは除く)、ドメイン直下ならrobots.txtも出力する", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\nnoindex: true\n---\n# Page A\n");

      let result = runBuild(dir, { SITE_ORIGIN: "https://owner.github.io", BASE_PATH: "/repo" });
      assert.equal(result.status, 0, result.stderr);
      const xml = readOut(dir, "sitemap.xml");
      assert.match(xml, /<loc>https:\/\/owner\.github\.io\/repo\/<\/loc>/);
      assert.doesNotMatch(xml, /a\.html/);
      assert.ok(!fs.existsSync(path.join(dir, "_site", "robots.txt")), "サブパス配置ではrobots.txtを作らない");

      fs.rmSync(path.join(dir, "_site"), { recursive: true });
      result = runBuild(dir, { SITE_ORIGIN: "https://docs.example.com" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(readOut(dir, "robots.txt"), /Sitemap: https:\/\/docs\.example\.com\/sitemap\.xml/);

      fs.rmSync(path.join(dir, "_site"), { recursive: true });
      result = runBuild(dir);
      assert.ok(!fs.existsSync(path.join(dir, "_site", "sitemap.xml")), "SITE_ORIGIN未設定ならsitemap.xmlは作らない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("og:imageはサイトの絶対URLに変換され、画像もコピーされる(外部URLはそのまま)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.mkdirSync(path.join(dir, "assets"));
      fs.writeFileSync(path.join(dir, "assets", "ogp.png"), "png");
      fs.writeFileSync(path.join(dir, "docs", "card.png"), "png");
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\nogImage: card.png\n---\n# Page A\n");
      fs.mkdirSync(path.join(dir, "ext"));
      fs.writeFileSync(path.join(dir, "ext", "e.md"), "---\nogImage: https://cdn.example.com/x.png\n---\n# E\n");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root Page\n\n[A](docs/a.md) [E](ext/e.md)\n");

      const result = runBuild(dir, {
        SITE_ORIGIN: "https://owner.github.io",
        BASE_PATH: "/repo",
        OGP_DEFAULT_IMAGE: "assets/ogp.png",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(readOut(dir, "index.html"), /<meta property="og:image" content="https:\/\/owner\.github\.io\/repo\/assets\/ogp\.png">/);
      assert.match(readOut(dir, "docs", "a.html"), /<meta property="og:image" content="https:\/\/owner\.github\.io\/repo\/docs\/card\.png">/);
      assert.match(readOut(dir, "ext", "e.html"), /<meta property="og:image" content="https:\/\/cdn\.example\.com\/x\.png">/);
      assert.equal(readOut(dir, "assets", "ogp.png"), "png");
      assert.equal(readOut(dir, "docs", "card.png"), "png");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("STRICT_LINKS=trueのとき、リンク切れがあれば終了コード1(無ければ成功)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);

      let result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);

      fs.writeFileSync(path.join(dir, "README.md"), "# Root Page\n\n[A](docs/a.md) [missing](docs/nope.md) ![x](nope.png)\n");
      result = runBuild(dir);
      assert.equal(result.status, 0, "STRICT_LINKS未設定なら警告だけで成功する");

      result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /STRICT_LINKS=true のため、リンクの問題 2 件/);
      assert.match(result.stderr, /docs\/nope\.md/);
      assert.match(result.stderr, /nope\.png/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("NAV_ENABLED=trueのとき、本文末尾にナビの順で前後のページへのリンクが付く", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\ntitle: ページA\n---\n# Page A\n");

      let result = runBuild(dir, { NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /<a class="tsuzuri-pager-next" rel="next" href="\/docs\/a\.html"><span>次のページ<\/span>ページA<\/a>/);
      assert.doesNotMatch(indexHtml, /rel="prev"/);
      assert.match(readOut(dir, "docs", "a.html"), /rel="prev" href="\/README\.html"/);
      assert.doesNotMatch(readOut(dir, "404.html"), /class="tsuzuri-pager"/);

      result = runBuild(dir);
      assert.doesNotMatch(readOut(dir, "index.html"), /class="tsuzuri-pager"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("SITEMAP_JSON未設定(既定)ではsitemap.jsonを公開サイトに出力しない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      const result = runBuild(dir, { SITEMAP_JSON: "" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(dir, "_site", "index.html")));
      assert.ok(!fs.existsSync(path.join(dir, "_site", "sitemap.json")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("言語名付きのコードブロックはビルド時に色分けされ、言語名なし・未対応の言語はそのまま", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        [
          "# Root Page",
          "",
          "```js",
          'const a = "<b>";',
          "```",
          "",
          "```",
          "plain <text>",
          "```",
          "",
          "```not-a-language",
          "x < y",
          "```",
          "",
        ].join("\n")
      );
      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /<pre><code class="hljs language-js"><span class="hljs-keyword">const<\/span>/);
      assert.match(html, /<span class="hljs-string">&quot;&lt;b&gt;&quot;<\/span>/);
      assert.match(html, /<pre><code>plain &lt;text&gt;\n<\/code><\/pre>/);
      assert.match(html, /<pre><code class="language-not-a-language">x &lt; y\n<\/code><\/pre>/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("NAV_ENABLED=trueのとき、検索用の索引とスクリプトを出力し、ナビに検索欄を置く", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\ntitle: ページA\n---\n# Page A\n\n検索できる本文です。\n");

      let result = runBuild(dir, { NAV_ENABLED: "true", BASE_PATH: "/repo" });
      assert.equal(result.status, 0, result.stderr);
      const index = JSON.parse(readOut(dir, "search-index.json"));
      assert.deepEqual(index.map((p) => p.u).sort(), ["/repo/", "/repo/docs/a.html"]);
      const a = index.find((p) => p.u === "/repo/docs/a.html");
      assert.equal(a.t, "ページA");
      assert.match(a.x, /検索できる本文です。/);
      assert.doesNotMatch(a.x, /前のページ/, "前後ページリンクは索引に含めない");
      assert.ok(readOut(dir, "tsuzuri-search.js").includes("tsuzuri-search"));
      assert.match(readOut(dir, "index.html"), /<div class="tsuzuri-search" data-index="\/repo\/search-index\.json"/);

      fs.rmSync(path.join(dir, "_site"), { recursive: true });
      result = runBuild(dir);
      assert.ok(!fs.existsSync(path.join(dir, "_site", "search-index.json")));
      assert.ok(!fs.existsSync(path.join(dir, "_site", "tsuzuri-search.js")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("GitHubの注意書き・脚注・mermaidを表示できる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        [
          "# Root Page",
          "",
          "> [!WARNING]",
          "> 気をつけてください",
          "",
          "> 普通の引用",
          "",
          "本文[^1] [A](docs/a.md)",
          "",
          "[^1]: 脚注の*内容*",
          "",
          "```mermaid",
          "graph TD; A-->B;",
          "```",
          "",
        ].join("\n")
      );
      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /<div class="markdown-alert markdown-alert-warning"><p class="markdown-alert-title">警告<\/p>\n?<p>気をつけてください<\/p>/);
      assert.match(html, /<blockquote>\n<p>普通の引用<\/p>\n<\/blockquote>/);
      assert.match(html, /<sup><a id="fn-ref-1" href="#fn-1"[^>]*>1<\/a><\/sup>/);
      assert.match(html, /<li id="fn-1">\n<p>脚注の<em>内容<\/em>/);
      assert.match(html, /<pre class="mermaid">graph TD; A--&gt;B;<\/pre>/);
      assert.match(html, /cdn\.jsdelivr\.net\/npm\/mermaid@/);
      assert.doesNotMatch(readOut(dir, "docs", "a.html"), /mermaid@/, "mermaidの無いページにはスクリプトを入れない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("画像は遅延読み込み、h2以下に見出しリンク、NAV_ENABLED時は見出し3つ以上で目次(toc: falseで消せる)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      const body = ["# Page A", "", "![i](img.png)", "", "## One", "", "### One-1", "", "## Two", ""].join("\n");
      fs.writeFileSync(path.join(dir, "docs", "a.md"), body);

      let result = runBuild(dir, { NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      let html = readOut(dir, "docs", "a.html");
      assert.match(html, /<img src="\/docs\/img\.png" alt="i" loading="lazy" decoding="async">/);
      assert.match(html, /<h1 id="page-a">Page A<\/h1>/, "h1にはリンクを付けない");
      assert.match(html, /<h2 id="one">One<a class="tsuzuri-anchor" href="#one" aria-label="「One」へのリンク">#<\/a><\/h2>/);
      assert.match(
        html,
        /<\/h1>\n<nav class="tsuzuri-toc" aria-label="目次"><p>目次<\/p><ul><li><a href="#one">One<\/a><ul><li><a href="#one-1">One-1<\/a><\/li><\/ul><\/li><li><a href="#two">Two<\/a><\/li><\/ul><\/nav>/
      );
      assert.doesNotMatch(JSON.parse(readOut(dir, "search-index.json"))[1].x, /#/, "見出しリンクの#は索引に入れない");

      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\ntoc: false\n---\n" + body);
      result = runBuild(dir, { NAV_ENABLED: "true" });
      assert.doesNotMatch(readOut(dir, "docs", "a.html"), /class="tsuzuri-toc"/);

      result = runBuild(dir);
      assert.doesNotMatch(readOut(dir, "docs", "a.html"), /class="tsuzuri-toc"/, "NAV_ENABLED=falseなら目次は出さない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("LAST_UPDATED=trueのとき、gitの最終コミット日を表示する(gitでなければ表示しない)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      let result = runBuild(dir, { LAST_UPDATED: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(readOut(dir, "index.html"), /class="tsuzuri-updated"/);
      assert.match(result.stderr, /最終更新日を表示しません/);

      const git = (...args) =>
        spawnSync("git", args, {
          cwd: dir,
          encoding: "utf-8",
          env: { ...process.env, GIT_COMMITTER_DATE: "2026-01-02T03:04:05Z", GIT_AUTHOR_DATE: "2026-01-02T03:04:05Z" },
        });
      git("init", "-q");
      git("add", "README.md", "docs");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init");

      result = runBuild(dir, { LAST_UPDATED: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(readOut(dir, "index.html"), /<p class="tsuzuri-updated">最終更新: <time datetime="2026-01-02">2026-01-02<\/time><\/p>/);

      result = runBuild(dir);
      assert.doesNotMatch(readOut(dir, "index.html"), /class="tsuzuri-updated"/, "LAST_UPDATED未設定なら表示しない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("参照リンク・バッジ・単一引用符・山括弧・括弧を含むパス・ディレクトリへのリンクもたどる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      for (const [rel, body] of [
        ["docs/ref.md", "# Ref\n"],
        ["docs/nested.md", "# Nested\n"],
        ["single.md", "# Single\n"],
        ["sp ace.md", "# Space\n"],
        ["p(1).md", "# Paren\n"],
        ["guide/README.md", "# Guide\n"],
        ["code.md", "# Code\n"],
      ]) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
      }
      fs.writeFileSync(
        path.join(dir, "README.md"),
        [
          "# Root Page",
          "",
          "[参照][r1] [![badge](docs/img.png)](docs/nested.md) [s](single.md 'T') [sp](<sp ace.md>)",
          "[paren](p(1).md) [guide](guide/) [none](nodir/)",
          "",
          "`[fake](code.md)`",
          "",
          "[r1]: docs/ref.md",
          "",
        ].join("\n")
      );
      const result = runBuild(dir, { STRICT_LINKS: "" });
      assert.equal(result.status, 0, result.stderr);
      for (const out of ["docs/ref.html", "docs/nested.html", "single.html", "sp ace.html", "p(1).html", "guide/index.html"]) {
        assert.ok(fs.existsSync(path.join(dir, "_site", out)), `${out} が生成されること`);
      }
      assert.ok(!fs.existsSync(path.join(dir, "_site", "code.html")), "インラインコード内の見せかけのリンクはたどらない");
      const sitemap = JSON.parse(readOut(dir, "sitemap.json"));
      assert.deepEqual(sitemap.missing, [{ rel: "nodir/", referencedFrom: "README.md" }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("タイトルは最初のh1の表示テキスト(コードブロック内の#は拾わない)。ROOT_MD=./README.mdでも二重にならない。hrefはエスケープ", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        ["```sh", "# install deps", "```", "", "# Title with **bold** and `code`", ""].join("\n")
      );
      fs.writeFileSync(
        path.join(dir, "README.md"),
        '# Root Page\n\n[A](docs/a.md) [q](https://example.com/?a=1&b="2")\n'
      );
      const result = runBuild(dir, { ROOT_MD: "./README.md", NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(readOut(dir, "docs", "a.html"), /<title>Title with bold and code<\/title>/);
      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /href="https:\/\/example\.com\/\?a=1&amp;b=&quot;2&quot;"/);
      assert.deepEqual(JSON.parse(readOut(dir, "sitemap.json")).pageRels.sort(), ["README.md", "docs/a.md"]);
      assert.equal(indexHtml.match(/href="\/README\.html"/g).length, 1, "ナビに起点ページが1回だけ");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("脚注のあるページが2つ以上あっても、それぞれのページに脚注が出る", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "README.md"), "# Root Page\n\nx[^1] [A](docs/a.md)\n\n[^1]: note A\n");
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "# Page A\n\ny[^1]\n\n[^1]: note B\n");
      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(readOut(dir, "index.html"), /<li id="fn-1">\n<p>note A/);
      assert.match(readOut(dir, "docs", "a.html"), /<li id="fn-1">\n<p>note B/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ROOT_MDがルート以外のとき、/ へのリンクでリポジトリ直下のREADME.mdを公開しない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "index.md"), "# Docs Top\n\n[top](/) [A](a.md)\n");
      // 既定のフィクスチャの a.md は ../README.md へリンクしているので、ここでは外す
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "# Page A\n\n[up](../)\n");
      const result = runBuild(dir, { ROOT_MD: "docs/index.md", NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!fs.existsSync(path.join(dir, "_site", "README.html")), "直下のREADME.mdは公開しない");
      assert.deepEqual(JSON.parse(readOut(dir, "sitemap.json")).pageRels.sort(), ["docs/a.md", "docs/index.md"]);
      assert.match(readOut(dir, "index.html"), /<a href="\/">top<\/a>/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("コードブロック・インラインコード内のHTMLの例は書き換えず、生のHTMLは大文字のタグも書き換える", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        [
          "# Root Page",
          "",
          "```html",
          '<a href="page.md">例</a>',
          "```",
          "",
          '本文 `<img src="logo.png">` と <A HREF="docs/a.md">大文字</A>',
          "",
        ].join("\n")
      );
      const result = runBuild(dir, { BASE_PATH: "/repo" });
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /&quot;page\.md&quot;/, "コードブロック内はそのまま");
      assert.doesNotMatch(html, /page\.html/, "コードブロック内のリンクを書き換えない");
      assert.match(html, /<code>&lt;img src=&quot;logo\.png&quot;&gt;<\/code>/, "インラインコード内はそのまま");
      assert.match(html, /<A HREF="\/repo\/docs\/a\.html">大文字<\/A>/);
      assert.ok(fs.existsSync(path.join(dir, "_site", "docs", "a.html")), "大文字の<A>のリンク先もたどる");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("拡張子の無いパス: READMEのあるディレクトリはサイトへ、サイトに出さないファイルはGitHubへ、無ければリンク切れ", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.mkdirSync(path.join(dir, "guide"));
      fs.writeFileSync(path.join(dir, "guide", "README.md"), "# Guide\n");
      fs.mkdirSync(path.join(dir, "src"));
      fs.writeFileSync(path.join(dir, "src", "main.js"), "");
      fs.writeFileSync(path.join(dir, "LICENSE"), "MIT");
      fs.writeFileSync(path.join(dir, ".env.example"), "A=1");
      fs.writeFileSync(
        path.join(dir, "README.md"),
        "# Root Page\n\n[guide](guide) [src](src/) [MIT](LICENSE) [env](.env.example) [none](nothing)\n"
      );
      const gh = { GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "o/r", GITHUB_SHA: "abc123" };
      let result = runBuild(dir, { ...gh, STRICT_LINKS: "" });
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /<a href="\/guide\/">guide<\/a>/);
      assert.ok(fs.existsSync(path.join(dir, "_site", "guide", "index.html")));
      assert.match(html, /<a href="https:\/\/github\.com\/o\/r\/tree\/abc123\/src">src<\/a>/);
      assert.match(html, /<a href="https:\/\/github\.com\/o\/r\/blob\/abc123\/LICENSE">MIT<\/a>/);
      assert.match(html, /<a href="https:\/\/github\.com\/o\/r\/blob\/abc123\/\.env\.example">env<\/a>/);
      assert.ok(!fs.existsSync(path.join(dir, "_site", "LICENSE")), "サイトにはコピーしない");
      assert.deepEqual(JSON.parse(readOut(dir, "sitemap.json")).missing, [{ rel: "nothing", referencedFrom: "README.md" }]);

      result = runBuild(dir, { ...gh, STRICT_LINKS: "true" });
      assert.equal(result.status, 1, "存在しないリンク先はSTRICT_LINKSで失敗する");

      // GitHub Actions の外(手元)では git の origin と HEAD から GitHub の URL を作る
      fs.writeFileSync(path.join(dir, "README.md"), "# Root Page\n\n[MIT](LICENSE)\n");
      result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 0, "GitHub上のURLが分からなくても、実在するファイルなのでリンク切れにはしない");
      assert.match(result.stderr, /README\.md から LICENSE へのリンク/, "警告に参照元のページを出す");
      const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf-8" });
      git("init", "-q");
      git("remote", "add", "origin", "git@github.com:owner/repo.git");
      git("add", "-A");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init");
      const branch = git("branch", "--show-current").stdout.trim();
      result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(
        readOut(dir, "index.html").includes(`<a href="https://github.com/owner/repo/blob/${branch}/LICENSE">MIT</a>`),
        "手元のビルドでは今のブランチ名で(pushしていないコミットを指さないように)"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ナビ・前後ページの表示名はtitleが無ければh1。404.mdの画像はコピーされる。sitemap.xmlはURLをエンコードしlastmodを付ける", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "with space.md"), "# スペース付き\n");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root Page\n\n[A](docs/a.md) [S](<docs/with space.md>)\n");
      fs.mkdirSync(path.join(dir, "img"));
      fs.writeFileSync(path.join(dir, "img", "nf.png"), "png");
      fs.writeFileSync(path.join(dir, "404.md"), "# 迷子\n\n![nf](img/nf.png)\n");
      const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf-8" });
      git("init", "-q");
      git("add", "-A");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init");

      const result = runBuild(dir, {
        NAV_ENABLED: "true",
        SITE_ORIGIN: "https://o.github.io",
        BASE_PATH: "/r",
        LAST_UPDATED: "true",
      });
      assert.equal(result.status, 0, result.stderr);
      const indexHtml = readOut(dir, "index.html");
      assert.match(indexHtml, /<a href="\/r\/docs\/a\.html">Page A<\/a>/, "ナビの表示名はh1");
      assert.match(indexHtml, /<span>次のページ<\/span>Page A<\/a>/, "前後ページの表示名もh1");
      assert.equal(readOut(dir, "img", "nf.png"), "png", "404.mdの画像をコピーする");
      const xml = readOut(dir, "sitemap.xml");
      assert.match(xml, /<loc>https:\/\/o\.github\.io\/r\/docs\/with%20space\.html<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
      assert.match(readOut(dir, "docs", "with space.html"), /<link rel="canonical" href="https:\/\/o\.github\.io\/r\/docs\/with%20space\.html">/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("日本語の文の途中の改行は取り除き、英語の文の改行は残す", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        "# Root Page\n\n日本語の文を\n途中で改行します。\n続きの文です。\nThis is\nEnglish.\n\nサーバー\nを起動します。ユーザー・\nグループと**強調**\nです。\n\n```\nコード\n内の改行\n```\n"
      );
      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /<p>日本語の文を途中で改行します。続きの文です。\nThis is\nEnglish\.<\/p>/);
      assert.match(html, /<p>サーバーを起動します。ユーザー・グループと<strong>強調<\/strong>です。<\/p>/, "長音・中黒・強調の直後も");
      assert.match(html, /<pre><code>コード\n内の改行\n<\/code><\/pre>/, "コードブロックの中は変えない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ナビがあるページは本文へスキップのリンクを持ち、LANG=enならナビのラベルも英語", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      let result = runBuild(dir, { NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      let html = readOut(dir, "index.html");
      assert.match(html, /<a class="tsuzuri-skip" href="#tsuzuri-main">本文へスキップ<\/a>/);
      assert.match(html, /<main id="tsuzuri-main">/);
      assert.match(html, /<nav aria-label="サイト内ページ">/);
      result = runBuild(dir, { NAV_ENABLED: "true", LANG: "en" });
      html = readOut(dir, "index.html");
      assert.match(html, /<nav aria-label="Site pages">/);
      assert.match(html, />Skip to content<\/a>/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("HTMLの<h1>で始まるREADMEもh1をタイトル・表示名にし、h1が無い起点ページはサイト名。見出しMainとスキップ先のidは重ならない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        '<h1 align="center">\n  <img src="docs/img.png" width="48"><br>\n  MyProj\n</h1>\n\n## Main\n\n[A](docs/a.md)\n'
      );
      let result = runBuild(dir, { NAV_ENABLED: "true", SITE_NAME: "Site" });
      assert.equal(result.status, 0, result.stderr);
      let html = readOut(dir, "index.html");
      assert.match(html, /<title>MyProj<\/title>/);
      assert.match(html, /aria-current="page">MyProj<\/a>/);
      assert.equal(html.match(/id="main"/g).length, 1, "見出しMainのidだけ");
      assert.match(html, /<main id="tsuzuri-main">/);

      fs.writeFileSync(path.join(dir, "README.md"), "本文だけ\n\n[A](docs/a.md)\n");
      result = runBuild(dir, { NAV_ENABLED: "true", SITE_NAME: "Site" });
      html = readOut(dir, "index.html");
      assert.match(html, /<title>Site<\/title>/, "h1が無い起点ページはサイト名");
      assert.match(readOut(dir, "docs", "a.html"), /<title>Page A<\/title>/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test(".で始まるディレクトリのページ・画像は _. で始まるパスに出力する(Pages の成果物に含まれるように)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.mkdirSync(path.join(dir, ".github"));
      fs.writeFileSync(path.join(dir, ".github", "CONTRIBUTING.md"), "# Contributing\n\n![logo](logo.png)\n");
      fs.copyFileSync(path.join(dir, "docs", "img.png"), path.join(dir, ".github", "logo.png"));
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[c](.github/CONTRIBUTING.md) ![l](.github/logo.png)\n");
      const result = runBuild(dir, { STRICT_LINKS: "true", NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /href="\/_\.github\/CONTRIBUTING\.html"/);
      assert.match(html, /src="\/_\.github\/logo\.png"/);
      assert.ok(fs.existsSync(path.join(dir, "_site", "_.github", "logo.png")));
      assert.match(readOut(dir, "_.github", "CONTRIBUTING.html"), /src="\/_\.github\/logo\.png"/);
      assert.ok(!fs.existsSync(path.join(dir, "_site", ".github")), ". で始まるディレクトリは作らない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("リンクしたファイルが生成したページと同じ出力先なら上書きせず、STRICT_LINKSで失敗させる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "index.html"), "<p>hand-written</p>");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[demo](index.html) [A](docs/a.md)\n");
      let result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /出力先が README\.md と重なるためコピーしません/);
      assert.match(readOut(dir, "index.html"), /<h1 id="root">Root<\/h1>/, "生成したページのまま");
      result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /出力先の重複: index\.html/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ファイル名に # や % を含むページへのリンク(本文・ナビ・前後ページ)をエンコードする", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "c#.md"), "# CSharp\n");
      fs.writeFileSync(path.join(dir, "docs", "100%.md"), "# Percent\n");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[c](docs/c%23.md) [p](docs/100%25.md)\n");
      const result = runBuild(dir, { NAV_ENABLED: "true", STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.equal(html.match(/href="\/docs\/c%23\.html"/g).length, 3, "本文・ナビ・次のページ");
      assert.match(html, /<li><a href="\/docs\/100%25\.html">Percent<\/a><\/li>/);
      assert.ok(fs.existsSync(path.join(dir, "_site", "docs", "c#.html")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("手元のビルドでは .github/docs-pages.config を読み、init でコピーしたテーマCSSを使う", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      const vendored = path.join(dir, ".github", "tsuzuri", "styles");
      fs.mkdirSync(vendored, { recursive: true });
      fs.copyFileSync(path.join(REAL_STYLES_DIR, "base.css"), path.join(vendored, "base.css"));
      fs.copyFileSync(path.join(REAL_STYLES_DIR, "akari.css"), path.join(vendored, "akari.css"));
      fs.writeFileSync(
        path.join(dir, ".github", "docs-pages.config"),
        "# c\nTHEME=akari\nSITE_NAME=FromFile\nLANG=en\nNAV_ENABLED=true\n"
      );
      let result = runBuild(dir, { LANG: "ja_JP.UTF-8" });
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stderr, /LANG の値が言語タグとして不正/);
      let html = readOut(dir, "index.html");
      assert.match(html, /<html lang="en">/);
      assert.match(html, /FromFile/);
      assert.ok(extractStyleBlock(html).includes(fs.readFileSync(path.join(REAL_STYLES_DIR, "akari.css"), "utf-8").slice(0, 200)));
      result = runBuild(dir, { SITE_NAME: "FromEnv" });
      html = readOut(dir, "index.html");
      assert.match(html, /FromEnv/, "環境変数を優先する");
      result = runBuild(dir, { GITHUB_ACTIONS: "true", STYLE_DIR: ".github/tsuzuri/styles" });
      assert.match(readOut(dir, "index.html"), /<html lang="ja">/, "Actions では設定ファイルを読まない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("生のHTMLの <video src> の動画もコピーし、<audio> 以外の a で始まるタグは拾わない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "demo.mp4"), "x");
      fs.writeFileSync(
        path.join(dir, "README.md"),
        '# Root\n\n<video src="demo.mp4" controls></video>\n\n<abbr title="x" href="nope.md">a</abbr>\n'
      );
      const result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(dir, "_site", "demo.mp4")));
      assert.match(readOut(dir, "index.html"), /<video src="\/demo\.mp4" controls>/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("手元のビルドでは、リポジトリ直下の styles/ より init でコピーしたテーマCSSを優先する", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "styles", "base.css"), "/* MY APP BASE */");
      const vendored = path.join(dir, ".github", "tsuzuri", "styles");
      fs.mkdirSync(vendored, { recursive: true });
      fs.copyFileSync(path.join(REAL_STYLES_DIR, "base.css"), path.join(vendored, "base.css"));
      fs.copyFileSync(path.join(REAL_STYLES_DIR, "wa.css"), path.join(vendored, "wa.css"));
      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(extractStyleBlock(readOut(dir, "index.html")), /MY APP BASE/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("この設定で作らないファイル名(robots.txt・search-index.json)へのリンクはコピーする", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "robots.txt"), "x");
      fs.writeFileSync(path.join(dir, "search-index.json"), "{}");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[r](robots.txt) [s](search-index.json)\n");
      let result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readOut(dir, "robots.txt"), "x");
      assert.equal(readOut(dir, "search-index.json"), "{}");
      result = runBuild(dir, { STRICT_LINKS: "true", NAV_ENABLED: "true" });
      assert.equal(result.status, 1, "ナビ有効なら search-index.json は生成するので重複");
      assert.match(result.stderr, /出力先の重複: search-index\.json/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatter の styleFile で、そのページだけ独自CSSを差し替える(空のファイルなら当てない)", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "site.css"), "/* SITE CUSTOM */");
      fs.writeFileSync(path.join(dir, "plain.css"), "");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[A](docs/a.md) [B](docs/b.md)\n");
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\nstyleFile: plain.css\n---\n# A\n");
      fs.writeFileSync(path.join(dir, "docs", "b.md"), "---\nstyleFile: nope.css\n---\n# B\n");
      const result = runBuild(dir, { STYLE_FILE: "site.css" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(extractStyleBlock(readOut(dir, "index.html")), /SITE CUSTOM/);
      assert.doesNotMatch(extractStyleBlock(readOut(dir, "docs", "a.html")), /SITE CUSTOM/, "空のファイルを指定したページには当てない");
      assert.match(extractStyleBlock(readOut(dir, "docs", "b.html")), /SITE CUSTOM/, "見つからなければサイト全体のもの");
      assert.match(result.stderr, /styleFile "nope\.css" が見つかりません/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("見出しが無いページ内リンクは警告し、STRICT_LINKS=true ならビルドを失敗させる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        "# Root\n\n## 使い方\n\n[ok](#使い方) [ok2](docs/a.md#page-a) [ok3](#%E4%BD%BF%E3%81%84%E6%96%B9) [fn](#top)\n\n[bad](docs/a.md#nope) [bad2](#missing)\n"
      );
      let result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /見出しが見つからないリンク: 2 件/);
      assert.match(result.stderr, /docs\/a\.md#nope \(referenced from README\.md\)/);
      assert.match(result.stderr, /README\.md#missing/);
      result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /見出しが見つかりません: docs\/a\.md#nope/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("前回 Tsuzuri が出力したディレクトリは空にしてからビルドし、目印の無いディレクトリは消さない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.mkdirSync(path.join(dir, "_site"));
      fs.writeFileSync(path.join(dir, "_site", "keep.txt"), "user file");
      let result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(dir, "_site", "keep.txt")), "目印が無ければ消さない");
      assert.ok(fs.existsSync(path.join(dir, "_site", ".tsuzuri-build")));
      fs.writeFileSync(path.join(dir, "_site", "old.html"), "old");
      result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!fs.existsSync(path.join(dir, "_site", "old.html")), "前回の出力は消える");
      assert.ok(fs.existsSync(path.join(dir, "_site", "index.html")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test(".で始まるディレクトリの PDF・動画はコピーし、設定ファイルはコピーしない。画像に width・height を付ける", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.mkdirSync(path.join(dir, ".github"));
      fs.writeFileSync(path.join(dir, ".github", "manual.pdf"), "pdf");
      fs.writeFileSync(path.join(dir, ".github", "ci.yml"), "secret: x");
      const pngBuf = Buffer.alloc(33);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngBuf, 0);
      pngBuf.write("IHDR", 12, "ascii");
      pngBuf.writeUInt32BE(320, 16);
      pngBuf.writeUInt32BE(200, 20);
      fs.writeFileSync(path.join(dir, "shot.png"), pngBuf);
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[m](.github/manual.pdf) [c](.github/ci.yml) ![s](shot.png)\n");
      const result = runBuild(dir, { STRICT_LINKS: "true" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(dir, "_site", "_.github", "manual.pdf")));
      assert.ok(!fs.existsSync(path.join(dir, "_site", "_.github", "ci.yml")));
      const html = readOut(dir, "index.html");
      assert.match(html, /href="\/_\.github\/manual\.pdf"/);
      assert.match(html, /<img src="\/shot\.png" alt="s" width="320" height="200" loading="lazy"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("コードブロックがあるページはコピーボタンのスクリプトを読み込み、description が無ければ最初の段落から作る", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(
        path.join(dir, "README.md"),
        "# Root\n\n![badge](docs/img.png)\n\n> [!NOTE]\n> 注意\n\nこれは**最初の**段落です。\n\n```sh\necho hi\n```\n\n```mermaid\ngraph TD\n```\n\n[A](docs/a.md)\n"
      );
      const result = runBuild(dir);
      assert.equal(result.status, 0, result.stderr);
      const html = readOut(dir, "index.html");
      assert.match(html, /<script src="\/tsuzuri-copy\.js" defer><\/script>/);
      assert.ok(fs.existsSync(path.join(dir, "_site", "tsuzuri-copy.js")));
      assert.match(html, /<meta name="description" content="badge">/, "画像だけの段落は alt を使う");
      assert.doesNotMatch(readOut(dir, "docs", "a.html"), /<script src="\/tsuzuri-copy\.js"/, "コードの無いページは読み込まない");
      fs.writeFileSync(path.join(dir, "README.md"), "---\ndescription: 手書き\n---\n# Root\n\n> [!NOTE]\n> 注意の本文\n\n本文。\n");
      runBuild(dir);
      assert.match(readOut(dir, "index.html"), /<meta name="description" content="手書き">/);
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n> [!NOTE]\n> 注意の本文\n\n" + "長".repeat(200) + "\n");
      runBuild(dir);
      const auto = readOut(dir, "index.html").match(/<meta name="description" content="([^"]*)">/)[1];
      assert.equal(auto, "注意の本文", "注意書きの見出し(補足)は飛ばす");
      assert.ok(!fs.existsSync(path.join(dir, "_site", "tsuzuri-copy.js")), "コードが無くなれば出力しない");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CSS は内容ごとに1つのファイルに出し、同じ内容のページは同じファイルを読み込む", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      fs.writeFileSync(path.join(dir, "docs", "a.md"), "---\ntheme: none\n---\n# A\n");
      fs.writeFileSync(path.join(dir, "README.md"), "# Root\n\n[A](docs/a.md) [B](docs/b.md)\n");
      fs.writeFileSync(path.join(dir, "docs", "b.md"), "# B\n");
      const result = runBuild(dir, { BASE_PATH: "/repo" });
      assert.equal(result.status, 0, result.stderr);
      const hrefOf = (html) => html.match(/<link rel="stylesheet" href="([^"]+)">/)[1];
      const root = hrefOf(readOut(dir, "index.html"));
      assert.match(root, /^\/repo\/tsuzuri-[0-9a-f]{10}\.css$/);
      assert.equal(hrefOf(readOut(dir, "docs", "b.html")), root, "同じCSSなら同じファイル");
      assert.notEqual(hrefOf(readOut(dir, "docs", "a.html")), root, "theme を変えたページは別のファイル");
      assert.doesNotMatch(readOut(dir, "index.html"), /<style>/);
      const cssFiles = fs.readdirSync(path.join(dir, "_site")).filter((f) => f.endsWith(".css"));
      assert.equal(cssFiles.length, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ナビがあるページはライト/ダーク切り替えのスクリプトを読み込み、無ければ読み込まない", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyRealBaseAndThemeStyles(dir);
      let result = runBuild(dir, { NAV_ENABLED: "true" });
      assert.equal(result.status, 0, result.stderr);
      let html = readOut(dir, "index.html");
      assert.match(html, /<script>try\{const t=localStorage\.getItem\("tsuzuri-theme"\)/);
      assert.match(html, /<script src="\/tsuzuri-theme\.js" defer><\/script>\n<\/head>/);
      assert.ok(fs.existsSync(path.join(dir, "_site", "tsuzuri-theme.js")));
      assert.match(extractStyleBlock(html), /:root\[data-theme="dark"\]/);
      result = runBuild(dir);
      html = readOut(dir, "index.html");
      assert.doesNotMatch(html, /tsuzuri-theme/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
