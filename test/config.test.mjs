import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadConfig, CONFIG_FILE_KEYS, parseConfigText, withConfigFileDefaults, resolveLanguages } from "../.github/scripts/lib/config.mjs";

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
  assert.equal(config.lang, "en");
  assert.deepEqual(config.languages, ["en"]);
  assert.equal(config.navEnabled, false);
  assert.equal(config.faviconFile, "");
  assert.equal(config.siteName, "");
  assert.equal(config.customDomain, "");
  assert.equal(config.ogDefaultImage, "");
  assert.equal(config.theme, "material");
  assert.equal(config.styleDir, "styles");
});

test("全キー設定済みで正しく反映される", () => {
  const config = loadConfig({
    ROOT_MD: "docs/index.md",
    OUT_DIR: "dist",
    STYLE_FILE: "custom.css",
    BASE_PATH: "my-repo",
    SITE_ORIGIN: "https://example.com",
    LANGUAGES: "en",
    NAV_ENABLED: "true",
    FAVICON_FILE: "favicon.ico",
    SITE_NAME: "My Site",
    CUSTOM_DOMAIN: "docs.example.com",
    OGP_DEFAULT_IMAGE: "og.png",
    THEME: "nineties",
    STYLE_DIR: "_pkg-src/styles",
  });
  assert.equal(config.rootMd, "docs/index.md");
  assert.equal(config.outDir, "dist");
  assert.equal(config.styleFile, "custom.css");
  assert.equal(config.basePath, "/my-repo");
  assert.equal(config.siteOrigin, "https://example.com");
  assert.equal(config.lang, "en");
  assert.deepEqual(config.languages, ["en"]);
  assert.equal(config.navEnabled, true);
  assert.equal(config.faviconFile, "favicon.ico");
  assert.equal(config.siteName, "My Site");
  assert.equal(config.customDomain, "docs.example.com");
  assert.equal(config.ogDefaultImage, "og.png");
  assert.equal(config.theme, "nineties");
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
    const config = loadConfig({ NAV_ENABLED: "yes", THEME: "material" });
    assert.equal(config.navEnabled, false);
    assert.ok(calls.some((c) => c.includes("NAV_ENABLED")));
  });
});

test('CUSTOM_DOMAIN="https://example.com/path" → warnして空文字', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({
      CUSTOM_DOMAIN: "https://example.com/path",
      NAV_ENABLED: "false",
      THEME: "material",
    });
    assert.equal(config.customDomain, "");
    assert.ok(calls.some((c) => c.includes("CUSTOM_DOMAIN")));
  });
});

test('LANGUAGES="" → ["en"]、lang は "en"', () => {
  const config = loadConfig({ LANGUAGES: "" });
  assert.equal(config.lang, "en");
  assert.deepEqual(config.languages, ["en"]);
});

test('THEME="nineties" → 正常反映', () => {
  const config = loadConfig({ THEME: "nineties" });
  assert.equal(config.theme, "nineties");
});

test('THEME="Sumi" (大文字小文字違い) → warnして"material"', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({ THEME: "Sumi", NAV_ENABLED: "false" });
    assert.equal(config.theme, "material");
    assert.ok(calls.some((c) => c.includes("THEME")));
  });
});

test('THEME="sepia" (許可リスト外) → warnして"material"', () => {
  withCapturedWarn((calls) => {
    const config = loadConfig({ THEME: "sepia", NAV_ENABLED: "false" });
    assert.equal(config.theme, "material");
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
      THEME: "material",
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
  assert.equal(config.lang, "en");
  assert.equal(config.navEnabled, false);
  assert.equal(config.faviconFile, "");
  assert.equal(config.siteName, "");
  assert.equal(config.customDomain, "");
  assert.equal(config.ogDefaultImage, "");
  assert.equal(config.theme, "material");
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

test("NAV_ENABLED・THEME・LANGUAGESを省略(未設定・空文字)してもwarnは出ない", () => {
  withCapturedWarn((calls) => {
    const unset = loadConfig({});
    const empty = loadConfig({ NAV_ENABLED: "", THEME: "  ", LANGUAGES: "" });
    const blank = loadConfig({ LANGUAGES: " , ,," });
    for (const config of [unset, empty, blank]) {
      assert.equal(config.navEnabled, false);
      assert.equal(config.theme, "material");
      assert.equal(config.lang, "en");
      assert.deepEqual(config.languages, ["en"]);
    }
    assert.deepEqual(calls, []);
  });
});

test('LANGUAGES="en-US" などBCP 47形式の言語タグはそのまま使う', () => {
  assert.deepEqual(loadConfig({ LANGUAGES: "en-US" }).languages, ["en-US"]);
  assert.deepEqual(loadConfig({ LANGUAGES: "zh-Hant-TW" }).languages, ["zh-Hant-TW"]);
});

test("LANGUAGES: 1つ・複数・前後の空白・空要素。先頭が lang(基本言語)", () => {
  withCapturedWarn((calls) => {
    assert.deepEqual(loadConfig({ LANGUAGES: "ja" }).languages, ["ja"]);
    assert.equal(loadConfig({ LANGUAGES: "ja" }).lang, "ja");
    for (const raw of ["ja,en", " ja , en ", "ja,,en", ",ja,en,"]) {
      const config = loadConfig({ LANGUAGES: raw });
      assert.deepEqual(config.languages, ["ja", "en"], raw);
      assert.equal(config.lang, "ja", raw);
    }
    const enJa = loadConfig({ LANGUAGES: "en,ja" });
    assert.deepEqual(enJa.languages, ["en", "ja"]);
    assert.equal(enJa.lang, "en");
    assert.deepEqual(calls, []);
  });
});

test('resolveLanguages: 不正なタグは警告して捨てる("en,en_US" → ["en"])', () => {
  withCapturedWarn((calls) => {
    assert.deepEqual(resolveLanguages("en,en_US"), ["en"]);
    assert.deepEqual(calls, ['[config] LANGUAGES の "en_US" は言語タグとして不正なため無視します。']);
  });
});

test('resolveLanguages: 大文字小文字を区別せず重複は警告して捨てる("en,EN" → ["en"])', () => {
  withCapturedWarn((calls) => {
    assert.deepEqual(resolveLanguages("en,EN"), ["en"]);
    assert.deepEqual(calls, ['[config] LANGUAGES の "EN" が重複しているため無視します。']);
  });
});

test('resolveLanguages: 全部不正("en_US") → ["en"]+警告2つ(不正・全部不正)', () => {
  withCapturedWarn((calls) => {
    assert.deepEqual(resolveLanguages("en_US"), ["en"]);
    assert.deepEqual(calls, [
      '[config] LANGUAGES の "en_US" は言語タグとして不正なため無視します。',
      '[config] LANGUAGES に正しい言語タグがありません。"en" にします。',
    ]);
  });
});

test('resolveLanguages: undefined・空文字は警告なしで ["en"]', () => {
  withCapturedWarn((calls) => {
    assert.deepEqual(resolveLanguages(undefined), ["en"]);
    assert.deepEqual(resolveLanguages(""), ["en"]);
    assert.deepEqual(calls, []);
  });
});

test("環境変数 LANG(OS の値・言語タグ)は languages に影響しない", () => {
  withCapturedWarn((calls) => {
    for (const LANG of ["ja_JP.UTF-8", "ja"]) {
      assert.deepEqual(loadConfig({ LANG }).languages, ["en"], LANG);
      assert.equal(loadConfig({ LANG }).lang, "en", LANG);
      assert.deepEqual(loadConfig({ LANG, LANGUAGES: "fr" }).languages, ["fr"], LANG);
    }
    assert.deepEqual(calls, []);
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
  const values = parseConfigText("\uFEFF# comment\r\nTHEME = nineties \r\n\nUNKNOWN=x\nSITE_NAME=A=B\nNAV_ENABLED=true");
  assert.deepEqual(values, { THEME: "nineties", SITE_NAME: "A=B", NAV_ENABLED: "true" });
});

test("parseConfigText: LANG の行は廃止の警告を1回だけ出して無視し、LANGUAGES は読む", () => {
  withCapturedWarn((calls) => {
    assert.deepEqual(parseConfigText("LANG=ja\n"), {});
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0],
      "[config] LANG は廃止しました。LANGUAGES に書いてください(例: LANGUAGES=ja。先頭が基本言語)。この行は無視します。"
    );
  });
  withCapturedWarn((calls) => {
    assert.deepEqual(parseConfigText("LANG=ja\nLANG=en\n"), {});
    assert.equal(calls.length, 1, "LANG が2行あっても警告は1回");
  });
  withCapturedWarn((calls) => {
    assert.deepEqual(parseConfigText("LANGUAGES=ja,en\n"), { LANGUAGES: "ja,en" });
    assert.deepEqual(calls, []);
  });
  withCapturedWarn((calls) => {
    const values = parseConfigText("LANG=ja\nLANGUAGES=en\n");
    assert.deepEqual(values, { LANGUAGES: "en" }, "両方あれば LANGUAGES を使う");
    assert.deepEqual(loadConfig(values).languages, ["en"]);
    assert.equal(calls.length, 1);
  });
});

test("withConfigFileDefaults: 環境変数を優先し、無いキーは設定ファイルの値にする", () => {
  const file = { THEME: "nineties", LANGUAGES: "en", NAV_ENABLED: "true" };
  const env = withConfigFileDefaults({ THEME: "glass", LANG: "ja_JP.UTF-8" }, file);
  assert.equal(env.THEME, "glass");
  assert.equal(env.LANGUAGES, "en");
  assert.equal(env.LANG, "ja_JP.UTF-8", "OS の LANG はそのまま(読まれない)");
  assert.equal(env.NAV_ENABLED, "true");
  assert.equal(withConfigFileDefaults({ LANGUAGES: "ja" }, file).LANGUAGES, "ja", "環境変数を優先");
  const actions = { GITHUB_ACTIONS: "true" };
  assert.equal(withConfigFileDefaults(actions, file), actions, "GitHub Actions では何もしない");
});

test("CONFIG_FILE_KEYS はワークフローの Load config が受け付けるキーと同じ", () => {
  const yml = fs.readFileSync(new URL("../templates/.github/workflows/docs-pages.yml", import.meta.url), "utf-8");
  const m = yml.match(/^\s*((?:[A-Z_]+\|)+[A-Z_]+)\)\s*$/m);
  assert.ok(m, "Load config の case 文");
  assert.deepEqual(m[1].split("|").sort(), [...CONFIG_FILE_KEYS].sort());
});

test("ワークフローの Build の env: CONFIG_FILE_KEYS のうち TRIGGER_BRANCH 以外がすべてあり、LANG が無い", () => {
  const yml = fs.readFileSync(new URL("../templates/.github/workflows/docs-pages.yml", import.meta.url), "utf-8");
  const m = yml.match(/- name: Build\n(?: {8}.*\n)*? {8}env:\n((?: {10}.*\n)+)/);
  assert.ok(m, "Build ステップの env");
  const envKeys = [...m[1].matchAll(/^ {10}([A-Z_]+):/gm)].map((x) => x[1]);
  for (const key of CONFIG_FILE_KEYS.filter((k) => k !== "TRIGGER_BRANCH")) {
    assert.ok(envKeys.includes(key), `Build の env に ${key} がある`);
  }
  assert.ok(!envKeys.includes("LANG"), "Build の env に LANG が無い");
  assert.match(m[1], /^ {10}LANGUAGES: \$\{\{ env\.LANGUAGES \}\}$/m);
});

test("ワークフローの Load config: LANG の行には廃止の警告を出す(許可リストより前)", () => {
  const yml = fs.readFileSync(new URL("../templates/.github/workflows/docs-pages.yml", import.meta.url), "utf-8");
  const warnLine = yml.indexOf(
    'LANG) echo "::warning::LANG は廃止しました。LANGUAGES に書いてください(例: LANGUAGES=ja。先頭が基本言語)。この行は無視します" ;;'
  );
  assert.ok(warnLine >= 0, "LANG) の廃止の警告の行");
  assert.ok(warnLine < yml.indexOf("TRIGGER_BRANCH|ROOT_MD|"), "許可リストより前");
});

test('THEME="glass"(月) → 正常反映', () => {
  assert.equal(loadConfig({ THEME: "glass" }).theme, "glass");
});

test("CONFIG_FILE_KEYS: LANG は無く、LANGUAGES がある", () => {
  assert.ok(!CONFIG_FILE_KEYS.includes("LANG"));
  assert.ok(CONFIG_FILE_KEYS.includes("LANGUAGES"));
});
