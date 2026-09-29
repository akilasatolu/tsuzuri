import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadConfig, CONFIG_FILE_KEYS, parseConfigText, withConfigFileDefaults } from "../.github/scripts/lib/config.mjs";

// console.warn を一時的に黙らせつつ呼び出し回数/内容を検査するヘルパー
function withCapturedWarn(fn) {
  const calls = [];
  const original = console.warn;
  console.warn = (...args) => calls.push(args.join(" "));
  try {
    fn(calls);
  } finally {
    console.warn = original;
  }
}

test("全キー未設定+GITHUB_REPOSITORY未設定 → 全デフォルト値", () => {
  const config = loadConfig({});
  assert.equal(config.rootMd, "README.md");
  assert.equal(config.outDir, "_site");
  assert.equal(config.styleFile, ".github/tsuzuri/styles/custom.css");
  assert.equal(config.basePath, "");
  assert.equal(config.siteOrigin, "");
  assert.equal(config.lang, "ja");
  assert.equal(config.navEnabled, false);
  assert.equal(config.faviconFile, "");
  assert.equal(config.siteName, "");
  assert.equal(config.customDomain, "");
  assert.equal(config.ogDefaultImage, "");
  assert.equal(config.theme, "wa");
  assert.equal(config.styleDir, "styles");
});

test("全キー設定済みで正しく反映される", () => {
  const config = loadConfig({
    ROOT_MD: "docs/index.md",
    OUT_DIR: "dist",
    STYLE_FILE: "custom.css",
    BASE_PATH: "my-repo",
    SITE_ORIGIN: "https://example.com",
    LANG: "en",
    NAV_ENABLED: "true",
    FAVICON_FILE: "favicon.ico",
    SITE_NAME: "My Site",
    CUSTOM_DOMAIN: "docs.example.com",
    OGP_DEFAULT_IMAGE: "og.png",
    THEME: "akari",
    STYLE_DIR: "_pkg-src/styles",
  });
  assert.equal(config.rootMd, "docs/index.md");
  assert.equal(config.outDir, "dist");
  assert.equal(config.styleFile, "custom.css");
  assert.equal(config.basePath, "/my-repo");
  assert.equal(config.siteOrigin, "https://example.com");
  assert.equal(config.lang, "en");
  assert.equal(config.navEnabled, true);
  assert.equal(config.faviconFile, "favicon.ico");
  assert.equal(config.siteName, "My Site");
  assert.equal(config.customDomain, "docs.example.com");
  assert.equal(config.ogDefaultImage, "og.png");
  assert.equal(config.theme, "akari");
  assert.equal(config.styleDir, "_pkg-src/styles");
});

test("siteName: SITE_NAME未設定+GITHUB_REPOSITORY=owner/my-repo → my-repo", () => {
  const config = loadConfig({ GITHUB_REPOSITORY: "owner/my-repo" });
  assert.equal(config.siteName, "my-repo");
});

test("siteName: 両方設定時はSITE_NAME優先", () => {
  const config = loadConfig({
    SITE_NAME: "Explicit Name",
    GITHUB_REPOSITORY: "owner/my-repo",
  });
  assert.equal(config.siteName, "Explicit Name");
});

test("siteName: GITHUB_REPOSITORY未設定時は空文字", () => {
  const config = loadConfig({});
  assert.equal(config.siteName, "");
});

test("siteName: GITHUB_REPOSITORYが不正な形式(スラッシュなし)なら空文字", () => {
  const config = loadConfig({ GITHUB_REPOSITORY: "invalid-repo-format" });
  assert.equal(config.siteName, "");
});

test('NAV_ENABLED="TRUE" (大文字) → true', () => {
  const config = loadConfig({ NAV_ENABLED: "TRUE" });
  assert.equal(config.navEnabled, true);
});

test('NAV_ENABLED="yes" → warnしてfalse', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({ NAV_ENABLED: "yes", THEME: "wa" });
    assert.equal(config.navEnabled, false);
    assert.ok(calls.some((c) => c.includes("NAV_ENABLED")));
  });
});

test('CUSTOM_DOMAIN="https://example.com/path" → warnして空文字', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({
      CUSTOM_DOMAIN: "https://example.com/path",
      NAV_ENABLED: "false",
      THEME: "wa",
    });
    assert.equal(config.customDomain, "");
    assert.ok(calls.some((c) => c.includes("CUSTOM_DOMAIN")));
  });
});

test('LANG="" → "ja" にフォールバック', () => {
  const config = loadConfig({ LANG: "" });
  assert.equal(config.lang, "ja");
});

test('THEME="akari" → 正常反映', () => {
  const config = loadConfig({ THEME: "akari" });
  assert.equal(config.theme, "akari");
});

test('THEME="Sumi" (大文字小文字違い) → warnして"wa"', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({ THEME: "Sumi", NAV_ENABLED: "false" });
    assert.equal(config.theme, "wa");
    assert.ok(calls.some((c) => c.includes("THEME")));
  });
});

test('THEME="sepia" (許可リスト外) → warnして"wa"', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({ THEME: "sepia", NAV_ENABLED: "false" });
    assert.equal(config.theme, "wa");
    assert.ok(calls.some((c) => c.includes("THEME")));
  });
});

test('THEME="none" → 正常反映(バリデーション通過、THEME起因のwarnなし)', () => {
  withCapturedWarn((calls) => {
    // NAV_ENABLEDは本テストの関心事ではないため明示的に有効値を渡し、
    // THEME検証のみに着目してwarnが出ないことを確認する
    const config = loadConfig({ THEME: "none", NAV_ENABLED: "false" });
    assert.equal(config.theme, "none");
    assert.ok(!calls.some((c) => c.includes("THEME")));
  });
});

test("STYLE_DIR未設定 → デフォルト styles", () => {
  const config = loadConfig({});
  assert.equal(config.styleDir, "styles");
});

test("STYLE_DIR設定済み(_pkg-src/styles) → そのまま反映されパス検証されない", () => {
  withCapturedWarn((calls) => {
    // 通常なら不正パスとみなされそうな値でも、styleDirは信頼できる内部値として
    // 検証されずそのまま通ることを確認する(STYLE_DIRに起因するwarnが出ないこと)
    const config = loadConfig({
      STYLE_DIR: "../outside/styles",
      NAV_ENABLED: "false",
      THEME: "wa",
    });
    assert.equal(config.styleDir, "../outside/styles");
    assert.ok(!calls.some((c) => c.includes("STYLE_DIR")));
  });
});

test("回帰テスト: 旧4キーのみの設定オブジェクトで新規キーが全てデフォルト値になる", () => {
  const config = loadConfig({
    ROOT_MD: "README.md",
    OUT_DIR: "_site",
    STYLE_FILE: ".github/docs-pages.style.css",
    BASE_PATH: "",
  });
  assert.equal(config.lang, "ja");
  assert.equal(config.navEnabled, false);
  assert.equal(config.faviconFile, "");
  assert.equal(config.siteName, "");
  assert.equal(config.customDomain, "");
  assert.equal(config.ogDefaultImage, "");
  assert.equal(config.theme, "wa");
  assert.equal(config.styleDir, "styles");
});

test("loadConfig は例外を投げない(不正値だらけの入力)", () => {
  assert.doesNotThrow(() => {
    withCapturedWarn(() => {
      loadConfig({
        NAV_ENABLED: "maybe",
        CUSTOM_DOMAIN: "not a host!!",
        THEME: "unknown-theme",
        GITHUB_REPOSITORY: "malformed",
      });
    });
  });
});

test("NAV_ENABLED・THEME・LANGを省略(未設定・空文字)してもwarnは出ない", () => {
  withCapturedWarn((calls) => {
    const unset = loadConfig({});
    const empty = loadConfig({ NAV_ENABLED: "", THEME: "  ", LANG: "" });
    for (const config of [unset, empty]) {
      assert.equal(config.navEnabled, false);
      assert.equal(config.theme, "wa");
      assert.equal(config.lang, "ja");
    }
    assert.deepEqual(calls, []);
  });
});

test('LANG="en-US" などBCP 47形式の言語タグはそのまま使う', () => {
  assert.equal(loadConfig({ LANG: "en-US" }).lang, "en-US");
  assert.equal(loadConfig({ LANG: "zh-Hant-TW" }).lang, "zh-Hant-TW");
});

test('LANG="en_US.UTF-8"(OSのロケール値) → warnして"ja"', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({ LANG: "en_US.UTF-8" });
    assert.equal(config.lang, "ja");
    assert.ok(calls.some((c) => c.includes("LANG")));
  });
});

test("STRICT_LINKS: true/false(大文字小文字区別なし)、省略は警告なしでfalse、不正値はwarnしてfalse", () => {
  withCapturedWarn((calls) => {
    assert.equal(loadConfig({ STRICT_LINKS: "true" }).strictLinks, true);
    assert.equal(loadConfig({ STRICT_LINKS: "TRUE" }).strictLinks, true);
    assert.equal(loadConfig({ STRICT_LINKS: "false" }).strictLinks, false);
    assert.equal(loadConfig({}).strictLinks, false);
    assert.equal(loadConfig({ STRICT_LINKS: "" }).strictLinks, false);
    assert.equal(calls.length, 0);
    assert.equal(loadConfig({ STRICT_LINKS: "yes" }).strictLinks, false);
    assert.ok(calls.some((c) => c.includes("STRICT_LINKS")));
  });
});

test("SITEMAP_JSON: 既定はfalse(省略時は警告なし)、trueで出力", () => {
  withCapturedWarn((calls) => {
    assert.equal(loadConfig({}).sitemapJson, false);
    assert.equal(loadConfig({ SITEMAP_JSON: "true" }).sitemapJson, true);
    assert.equal(calls.length, 0);
  });
});

test("LAST_UPDATED: 既定はfalse、trueで有効", () => {
  assert.equal(loadConfig({}).lastUpdated, false);
  assert.equal(loadConfig({ LAST_UPDATED: "true" }).lastUpdated, true);
});

test("ROOT_MD: ./ や \\ を含む書き方も、リンクから解決したパスと同じ表記に正規化する", () => {
  assert.equal(loadConfig({ ROOT_MD: "./README.md" }).rootMd, "README.md");
  assert.equal(loadConfig({ ROOT_MD: "docs\\index.md" }).rootMd, "docs/index.md");
  assert.equal(loadConfig({ ROOT_MD: "./docs/../README.md" }).rootMd, "README.md");
  assert.equal(loadConfig({ ROOT_MD: "/README.md" }).rootMd, "README.md");
});

test("parseConfigText: コメント・空行・未知のキーを読み飛ばし、値の前後の空白を取る", () => {
  const values = parseConfigText("\uFEFF# comment\r\nTHEME = akari \r\n\nUNKNOWN=x\nSITE_NAME=A=B\nNAV_ENABLED=true");
  assert.deepEqual(values, { THEME: "akari", SITE_NAME: "A=B", NAV_ENABLED: "true" });
});

test("withConfigFileDefaults: 環境変数を優先し、OSのLANG(言語タグでない)は設定ファイルの値にする", () => {
  const file = { THEME: "akari", LANG: "en", NAV_ENABLED: "true" };
  const env = withConfigFileDefaults({ THEME: "umi", LANG: "ja_JP.UTF-8" }, file);
  assert.equal(env.THEME, "umi");
  assert.equal(env.LANG, "en");
  assert.equal(env.NAV_ENABLED, "true");
  assert.equal(withConfigFileDefaults({ LANG: "ja" }, file).LANG, "ja", "言語タグなら環境変数を優先");
  const actions = { GITHUB_ACTIONS: "true" };
  assert.equal(withConfigFileDefaults(actions, file), actions, "GitHub Actions では何もしない");
});

test("CONFIG_FILE_KEYS はワークフローの Load config が受け付けるキーと同じ", () => {
  const yml = fs.readFileSync(new URL("../templates/.github/workflows/docs-pages.yml", import.meta.url), "utf-8");
  const m = yml.match(/^\s*((?:[A-Z_]+\|)+[A-Z_]+)\)\s*$/m);
  assert.ok(m, "Load config の case 文");
  assert.deepEqual(m[1].split("|").sort(), [...CONFIG_FILE_KEYS].sort());
});

test('THEME="tsuki"(月) → 正常反映', () => {
  assert.equal(loadConfig({ THEME: "tsuki" }).theme, "tsuki");
});
