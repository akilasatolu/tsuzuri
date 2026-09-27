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
// マーカーコメントのみの base.css / sumi.css を持ち、T-012(styles/sumi.css)の
// 完成有無に依存せずテーマカスケードの挙動を検証できる。
function copyFixtureStyleDir(dir) {
  fs.cpSync(path.join(FIXTURE_SITE, "styles-fixture"), path.join(dir, "styles-fixture"), {
    recursive: true,
  });
}

function runBuild(cwd, overrides = {}) {
  const env = { ...process.env };
  for (const key of CONFIG_ENV_KEYS) delete env[key];
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [SCRIPT_PATH], { cwd, env, encoding: "utf-8" });
}

function readOut(dir, ...segs) {
  return fs.readFileSync(path.join(dir, "_site", ...segs), "utf-8");
}

function extractStyleBlock(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(m, "<style> ブロックが見つかること");
  return m[1];
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
      assert.match(indexHtml, /<h1>Root Page<\/h1>/);
      assert.match(indexHtml, /href="\/docs\/a\.html"/);
      assert.match(indexHtml, /src="\/docs\/img\.png"/);

      // navHtml="" ・ metaTagsHtml="" (=旧版が出力していなかった要素は出力されない)
      assert.doesNotMatch(indexHtml, /<nav/);
      assert.doesNotMatch(indexHtml, /og:title/);
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

  test("THEME=sumi実行時、base.css相当とsumi.css相当が正しい順序で<style>に含まれる", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      copyFixtureStyleDir(dir);

      const result = runBuild(dir, { THEME: "sumi", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexHtml = readOut(dir, "index.html");
      const styleBlock = extractStyleBlock(indexHtml);
      assert.ok(styleBlock.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(styleBlock.includes("/*SUMI_FIXTURE_MARKER*/"));
      assert.ok(
        styleBlock.indexOf("/*BASE_FIXTURE_MARKER*/") < styleBlock.indexOf("/*SUMI_FIXTURE_MARKER*/"),
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
      assert.ok(!styleBlock.includes("/*SUMI_FIXTURE_MARKER*/"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("許可リスト内だがCSSファイル本体が存在しないTHEME→warn+themeCss空でビルド成功", () => {
    const dir = makeTmpDir();
    try {
      copyBasicSite(dir);
      // styles-fixture には base.css のみコピーし、sumi.css を欠落させる
      const stylesDir = path.join(dir, "styles-fixture");
      fs.mkdirSync(stylesDir, { recursive: true });
      fs.copyFileSync(
        path.join(FIXTURE_SITE, "styles-fixture", "base.css"),
        path.join(stylesDir, "base.css")
      );

      const result = runBuild(dir, { THEME: "sumi", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /sumi\.css.*見つかりません/);

      const indexHtml = readOut(dir, "index.html");
      const styleBlock = extractStyleBlock(indexHtml);
      assert.ok(styleBlock.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(!styleBlock.includes("/*SUMI_FIXTURE_MARKER*/"));
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
      assert.match(indexHtml, /<meta property="og:image" content="docs\/img\.png">/);
      assert.match(
        indexHtml,
        /<link rel="canonical" href="https:\/\/example\.com\/README\.html">/
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
      // docs/a.md だけ frontmatter で theme: sumi を指定する。
      fs.writeFileSync(
        path.join(dir, "docs", "a.md"),
        ["---", "theme: sumi", "---", "# Page A", "", "Back to [root](../README.md)."].join("\n")
      );

      // サイト全体は THEME=none(=デフォルトではテーマ層を適用しない)。
      const result = runBuild(dir, { THEME: "none", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexStyle = extractStyleBlock(readOut(dir, "index.html"));
      assert.ok(indexStyle.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(
        !indexStyle.includes("/*SUMI_FIXTURE_MARKER*/"),
        "frontmatter未指定のページはサイト全体のTHEME(none)のまま"
      );

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(aStyle.includes("/*BASE_FIXTURE_MARKER*/"));
      assert.ok(
        aStyle.includes("/*SUMI_FIXTURE_MARKER*/"),
        "frontmatterでtheme: sumiを指定したページだけ上書きされる"
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

      const result = runBuild(dir, { THEME: "sumi", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /no-such-file\.css.*見つかりません/);

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(
        aStyle.includes("/*SUMI_FIXTURE_MARKER*/"),
        "解決できないthemeはサイト全体のTHEME(sumi)にフォールバックする"
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

      const result = runBuild(dir, { THEME: "sumi", STYLE_DIR: "styles-fixture" });
      assert.equal(result.status, 0, result.stderr);

      const indexStyle = extractStyleBlock(readOut(dir, "index.html"));
      assert.ok(indexStyle.includes("/*SUMI_FIXTURE_MARKER*/"));

      const aStyle = extractStyleBlock(readOut(dir, "docs", "a.html"));
      assert.ok(!aStyle.includes("/*SUMI_FIXTURE_MARKER*/"));
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
});
