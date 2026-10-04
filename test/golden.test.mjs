import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/**
 * ゴールデンテスト: 多言語対応の前のコードで作ったサイトの出力をまるごと保存しておき、
 * 今のコードの出力と1文字ずつ比べる(言語を1つだけ設定した人の出力が変わらないことの確かめ)。
 *
 * 使い方:
 *   - 保存: UPDATE_GOLDEN=1 node --test test/golden.test.mjs
 *       保存は多言語対応の前のコード(T-001)でだけ行う。以後は保存し直さないこと。
 *       新しいコードで保存し直すと、変更後の出力どうしを比べることになり、比べる意味が無くなる。
 *   - 普段(npm test): 比較時の設定(LANGUAGES)でビルドして比べる(T-005 から常に有効)。
 *   - GOLDEN_COMPARE=saved node --test test/golden.test.mjs
 *       保存時の設定(LANG)でビルドして比べる。T-005 より前のタスクの確かめに使っていた。
 *       T-005 で LANG を廃止した(読まずに無視する)ので、今のコードではこの比べ方は一致しない
 *       (LANG=ja の設定も既定の en で作られるため)。
 *
 * 補助の関数は、ほかのテストファイルと共有せずにこのファイルの中に持つ
 * (test/ の下の .js / .mjs は node --test がすべてテストとして実行するため)。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_DIR, "..");
const SCRIPT_PATH = path.join(PROJECT_ROOT, ".github/scripts/build-docs.mjs");
const REAL_STYLES_DIR = path.join(PROJECT_ROOT, "styles");
const FIXTURE_SITE = path.join(TEST_DIR, "fixtures", "site-golden");
const GOLDEN_DIR = path.join(TEST_DIR, "fixtures", "golden");
const STYLES_BEFORE_DIR = path.join(GOLDEN_DIR, "styles-before");

const THEMES = ["material", "glass", "neumorphism", "editorial", "minimal", "blueprint", "nineties"];

// 設定の表。保存・2通りの比較(saved / 普段)が同じ表を使う。
//   saved:   保存時(多言語対応の前のコード)の環境変数
//   compare: 比較時(変更後のコード)の環境変数
const ORIGIN_ENV = { SITE_ORIGIN: "https://example.github.io", BASE_PATH: "/repo" };
const GOLDEN_CONFIGS = [
  { name: "ja", saved: { LANG: "ja" }, compare: { LANGUAGES: "ja" } },
  { name: "ja-nav", saved: { LANG: "ja", NAV_ENABLED: "true" }, compare: { LANGUAGES: "ja", NAV_ENABLED: "true" } },
  { name: "en-nav", saved: { LANG: "en", NAV_ENABLED: "true" }, compare: { LANGUAGES: "en", NAV_ENABLED: "true" } },
  { name: "default", saved: { LANG: "en" }, compare: {} },
  { name: "origin", saved: { LANG: "ja", ...ORIGIN_ENV }, compare: { LANGUAGES: "ja", ...ORIGIN_ENV } },
  { name: "fr", saved: { LANG: "fr" }, compare: { LANGUAGES: "fr" } },
  ...THEMES.map((theme) => ({
    name: `theme-${theme}`,
    saved: { LANG: "ja", THEME: theme },
    compare: { LANGUAGES: "ja", THEME: theme },
  })),
];

// 設定に関わる環境変数。子プロセスを起動する前にすべて消してから、指定した値だけを入れる。
// GITHUB_ で始まるもの、GIT_ で始まるもの(GIT_DIR など。手元の git の状態が出力に入らないように)も消す。
const CONFIG_ENV_KEYS = [
  "ROOT_MD",
  "OUT_DIR",
  "STYLE_FILE",
  "BASE_PATH",
  "SITE_ORIGIN",
  "LANG",
  "LANGUAGES",
  "NAV_ENABLED",
  "FAVICON_FILE",
  "SITE_NAME",
  "CUSTOM_DOMAIN",
  "OGP_DEFAULT_IMAGE",
  "THEME",
  "STYLE_DIR",
  "STRICT_LINKS",
  "SITEMAP_JSON",
  "LAST_UPDATED",
];

// 言語の切り替えボタンの CSS のかたまりの目印(T-016 はこれと同じ文字で書く)
const LANG_BLOCK_START = "/* ---------- 言語の切り替え ここから";
const LANG_BLOCK_END = "/* ---------- 言語の切り替え ここまで ---------- */";
const LANG_BLOCK_RE = /\n\/\* -{10} 言語の切り替え ここから[\s\S]*?\/\* -{10} 言語の切り替え ここまで -{10} \*\/\n/g;

// CSS から「言語の切り替え」のかたまり(前の改行1つ+始まりの行〜終わりの行+後の改行1つ)をすべて取り除く。
// 最短一致で1かたまりずつ取るので、かたまりの間にある CSS(テーマの本体など)は残る。
function stripLangSwitchBlocks(css) {
  return css.replace(LANG_BLOCK_RE, "");
}

const CSS_HASH_RE = /tsuzuri-[0-9a-f]{10}\.css/g;
// 中身を比べないファイル(あることだけ確かめる)
const EXISTENCE_ONLY = new Set(["tsuzuri-copy.js", "tsuzuri-theme.js"]);
const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"]);

// .js のファイルは保存するときに名前の後ろに .txt を足す(node --test と ESLint の対象にしないため)
function toSavedName(rel) {
  return /\.[cm]?js$/.test(rel) ? `${rel}.txt` : rel;
}
function normalizeName(rel) {
  return toSavedName(rel).replace(CSS_HASH_RE, "tsuzuri-HASH.css");
}

// ディレクトリの下の全ファイルを、"/" 区切りの相対パスで並べて返す
function listFiles(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(abs, ent.name), childRel);
      else out.push(childRel);
    }
  };
  walk(dir, "");
  return out.sort();
}

// { 比べるときの名前: 実際の相対パス } を作る。
// 置き換え後の名前が重なったファイル(例: CSS が2つできた)は上書きせず、label を付けて problems に足す。
function indexByNormalizedName(dir, label, problems) {
  const map = new Map();
  for (const rel of listFiles(dir)) {
    const name = normalizeName(rel);
    if (map.has(name)) {
      problems.push(`${label}で比べるときの名前が重なるファイル: ${map.get(name)} と ${rel}(どちらも ${name})`);
      continue;
    }
    map.set(name, rel);
  }
  return map;
}

// 2つの文字列が最初に違う位置のあたりを、失敗の文言用に取り出す
function describeFirstDiff(expected, actual) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
  const from = Math.max(0, i - 40);
  return `${i} 文字目から違う\n    保存: ${JSON.stringify(expected.slice(from, i + 40))}\n    今回: ${JSON.stringify(actual.slice(from, i + 40))}`;
}

/**
 * 保存した出力(expectedDir)と今回の出力(actualDir)を比べ、違いの一覧(文字列の配列)を返す。
 * 空の配列なら一致。
 *   - CSS ファイル名のハッシュ部分は tsuzuri-HASH.css に置き換えてから、ファイル名と中身を比べる
 *   - tsuzuri-copy.js / tsuzuri-theme.js は、あることだけ確かめる
 *   - CSS は、今回の中身から「言語の切り替え」のかたまりを取り除いたものが保存した中身と一致すること
 */
function compareOutputDirs(expectedDir, actualDir) {
  const problems = [];
  const expected = indexByNormalizedName(expectedDir, "保存した出力", problems);
  const actual = indexByNormalizedName(actualDir, "今回の出力", problems);
  for (const name of expected.keys()) {
    if (!actual.has(name)) problems.push(`今回の出力に無いファイル: ${name}`);
  }
  for (const name of actual.keys()) {
    if (!expected.has(name)) problems.push(`今回の出力に増えたファイル: ${name}`);
  }
  for (const [name, expectedRel] of expected) {
    const actualRel = actual.get(name);
    if (actualRel === undefined) continue;
    const baseName = path.posix.basename(actualRel);
    if (EXISTENCE_ONLY.has(baseName)) continue;
    const expBuf = fs.readFileSync(path.join(expectedDir, expectedRel));
    const actBuf = fs.readFileSync(path.join(actualDir, actualRel));
    if (BINARY_EXT.has(path.posix.extname(baseName).toLowerCase())) {
      if (!expBuf.equals(actBuf)) problems.push(`中身が違うファイル: ${name}(バイナリ)`);
      continue;
    }
    let exp = expBuf.toString("utf-8").replace(CSS_HASH_RE, "tsuzuri-HASH.css");
    let act = actBuf.toString("utf-8").replace(CSS_HASH_RE, "tsuzuri-HASH.css");
    if (baseName.endsWith(".css")) act = stripLangSwitchBlocks(act);
    if (exp !== act) problems.push(`中身が違うファイル: ${name}: ${describeFirstDiff(exp, act)}`);
  }
  return problems;
}

function assertSameOutput(expectedDir, actualDir, label) {
  const problems = compareOutputDirs(expectedDir, actualDir);
  assert.ok(problems.length === 0, `${label}: 保存した出力と違います(${problems.length} 件)\n  - ${problems.join("\n  - ")}`);
}

function makeTmpDir(prefix = "golden-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// fixture と本物の styles/(base.css と全テーマ)を一時フォルダに写してビルドし、出力先を返す
function buildSite(dir, overrides) {
  return runGoldenBuild(dir, overrides).outDir;
}

// buildSite と同じ。configText を渡すと .github/docs-pages.config に書いてからビルドし、
// 出力先と子プロセスの結果(警告の確かめ用)を返す
function runGoldenBuild(dir, overrides, configText) {
  fs.cpSync(FIXTURE_SITE, dir, { recursive: true });
  if (configText !== undefined) {
    fs.mkdirSync(path.join(dir, ".github"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".github", "docs-pages.config"), configText);
  }
  fs.cpSync(REAL_STYLES_DIR, path.join(dir, "styles"), { recursive: true });
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (CONFIG_ENV_KEYS.includes(key) || key.startsWith("GITHUB_") || key.startsWith("GIT_")) delete env[key];
  }
  env.SITEMAP_JSON = "true";
  env.LAST_UPDATED = "false";
  Object.assign(env, overrides);
  const result = spawnSync(process.execPath, [SCRIPT_PATH], { cwd: dir, env, encoding: "utf-8" });
  assert.equal(result.status, 0, `ビルドが失敗しました\n${result.stdout}\n${result.stderr}`);
  return { outDir: path.join(dir, "_site"), result };
}

// 出力をまるごと保存する(.js は名前の後ろに .txt を足す)
function saveOutput(outDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  for (const rel of listFiles(outDir)) {
    const dest = path.join(destDir, ...toSavedName(rel).split("/"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(outDir, ...rel.split("/")), dest);
  }
}

const UPDATE = process.env.UPDATE_GOLDEN === "1";
const SAVED_MODE = process.env.GOLDEN_COMPARE === "saved";
const COMPARE_SKIP = UPDATE ? "UPDATE_GOLDEN=1 で保存中のため比べない" : false;

describe("ゴールデン: 保存", { skip: UPDATE ? false : "UPDATE_GOLDEN=1 のときだけ保存する" }, () => {
  // 注意: 保存は多言語対応の前のコード(T-001)でだけ行う。以後は保存し直さない。
  test("styles/ の今の中身を styles-before/ に写す", () => {
    fs.rmSync(STYLES_BEFORE_DIR, { recursive: true, force: true });
    fs.mkdirSync(STYLES_BEFORE_DIR, { recursive: true });
    for (const file of ["base.css", ...THEMES.map((t) => `${t}.css`)]) {
      fs.copyFileSync(path.join(REAL_STYLES_DIR, file), path.join(STYLES_BEFORE_DIR, file));
    }
  });
  for (const config of GOLDEN_CONFIGS) {
    test(`${config.name} の出力を保存する`, () => {
      const dir = makeTmpDir();
      try {
        saveOutput(buildSite(dir, config.saved), path.join(GOLDEN_DIR, config.name));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("ゴールデン: 保存した出力と比べる", { skip: COMPARE_SKIP }, () => {
  for (const config of GOLDEN_CONFIGS) {
    test(`${config.name}(${SAVED_MODE ? "保存時の設定" : "比較時の設定"})`, () => {
      const expectedDir = path.join(GOLDEN_DIR, config.name);
      assert.ok(fs.existsSync(expectedDir), `保存した出力がありません: ${expectedDir}`);
      const dir = makeTmpDir();
      try {
        const outDir = buildSite(dir, SAVED_MODE ? config.saved : config.compare);
        assertSameOutput(expectedDir, outDir, config.name);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("ゴールデン: 廃止した LANG", { skip: COMPARE_SKIP || (SAVED_MODE ? "GOLDEN_COMPARE=saved では比べない" : false) }, () => {
  // 意図した変更の確かめ: 設定ファイルに LANG=ja だけを書いても読まれず、既定(en)の出力になる
  test("設定ファイルに LANG=ja だけを書くと default と同じ出力になり、廃止の警告が出る", () => {
    const dir = makeTmpDir();
    try {
      const { outDir, result } = runGoldenBuild(dir, {}, "LANG=ja\n");
      assertSameOutput(path.join(GOLDEN_DIR, "default"), outDir, "LANG=ja だけの設定ファイル");
      const warnings = `${result.stdout}\n${result.stderr}`.match(/\[config\] LANG は廃止しました。/g) ?? [];
      assert.equal(warnings.length, 1, `廃止の警告が1回出ること\n${result.stderr}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ゴールデン: ソースの CSS", { skip: UPDATE ? "UPDATE_GOLDEN=1 で保存中" : false }, () => {
  for (const file of ["base.css", ...THEMES.map((t) => `${t}.css`)]) {
    test(`styles/${file} は保存時の中身で始まり、言語の切り替えのかたまりを除くと一致する`, () => {
      const before = fs.readFileSync(path.join(STYLES_BEFORE_DIR, file), "utf-8");
      const now = fs.readFileSync(path.join(REAL_STYLES_DIR, file), "utf-8");
      assert.ok(now.startsWith(before), `styles/${file} が保存時の中身で始まっていません`);
      assert.equal(stripLangSwitchBlocks(now), before);
    });
  }
});

describe("ゴールデン: 比べ方の部品", () => {
  const block = `${LANG_BLOCK_START}(説明) ---------- */\n.tsuzuri-lang { color: red; }\n${LANG_BLOCK_END}\n`;

  test("stripLangSwitchBlocks: かたまりが0個なら何も変えない", () => {
    const css = "body { margin: 0; }\n";
    assert.equal(stripLangSwitchBlocks(css), css);
  });

  test("stripLangSwitchBlocks: かたまりが1個(base.css の後ろだけ)なら元に戻る", () => {
    const base = "body { margin: 0; }\n";
    assert.equal(stripLangSwitchBlocks(`${base}\n${block}`), base);
  });

  test("stripLangSwitchBlocks: かたまりが2個(base とテーマ)なら両方取り、間のテーマ本体は残す", () => {
    const base = "body { margin: 0; }\n";
    const theme = ":root { --c: blue; }\n";
    assert.equal(stripLangSwitchBlocks(`${base}\n${block}${theme}\n${block}`), base + theme);
  });

  describe("compareOutputDirs の失敗の文言", () => {
    const setup = () => {
      const root = makeTmpDir("golden-cmp-");
      const exp = path.join(root, "exp");
      const act = path.join(root, "act");
      for (const d of [exp, act]) {
        fs.mkdirSync(path.join(d, "docs"), { recursive: true });
        fs.writeFileSync(path.join(d, "index.html"), '<link href="/tsuzuri-0123456789.css">\n<p>hello</p>\n');
        fs.writeFileSync(path.join(d, "docs", "a.html"), "<p>a</p>\n");
      }
      fs.writeFileSync(path.join(exp, "tsuzuri-search.js.txt"), "search();\n");
      fs.writeFileSync(path.join(act, "tsuzuri-search.js"), "search();\n");
      fs.writeFileSync(path.join(exp, "tsuzuri-0123456789.css"), "body{}\n");
      fs.writeFileSync(path.join(act, "tsuzuri-abcdefabcd.css"), `body{}\n\n${block}`);
      fs.writeFileSync(path.join(exp, "tsuzuri-copy.js.txt"), "old\n");
      fs.writeFileSync(path.join(act, "tsuzuri-copy.js"), "new\n");
      return { root, exp, act };
    };

    test("同じなら違いは0件(ハッシュ・.js.txt・CSS のかたまり・copy.js の中身は無視)", () => {
      const { root, exp, act } = setup();
      try {
        // 今回の出力の HTML 側のハッシュも変える
        fs.writeFileSync(path.join(act, "index.html"), '<link href="/tsuzuri-abcdefabcd.css">\n<p>hello</p>\n');
        assert.deepEqual(compareOutputDirs(exp, act), []);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test("ファイルが1つ多いと、そのファイル名が出る", () => {
      const { root, exp, act } = setup();
      try {
        fs.writeFileSync(path.join(act, "docs", "extra.html"), "x");
        const problems = compareOutputDirs(exp, act);
        assert.deepEqual(problems, ["今回の出力に増えたファイル: docs/extra.html"]);
        assert.throws(() => assertSameOutput(exp, act, "t"), /docs\/extra\.html/);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test("ファイルが1つ少ないと、そのファイル名が出る", () => {
      const { root, exp, act } = setup();
      try {
        fs.rmSync(path.join(act, "docs", "a.html"));
        assert.deepEqual(compareOutputDirs(exp, act), ["今回の出力に無いファイル: docs/a.html"]);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test("1文字違うと、そのファイル名と違う位置が出る", () => {
      const { root, exp, act } = setup();
      try {
        fs.writeFileSync(path.join(act, "docs", "a.html"), "<p>b</p>\n");
        const problems = compareOutputDirs(exp, act);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /^中身が違うファイル: docs\/a\.html: 3 文字目から違う/);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test("CSS が2つできて比べるときの名前が重なると、両方のファイル名が違いとして出る", () => {
      const { root, exp, act } = setup();
      try {
        fs.writeFileSync(path.join(act, "tsuzuri-ffffffffff.css"), "extra{}\n");
        const problems = compareOutputDirs(exp, act);
        assert.deepEqual(problems, [
          "今回の出力で比べるときの名前が重なるファイル: tsuzuri-abcdefabcd.css と tsuzuri-ffffffffff.css(どちらも tsuzuri-HASH.css)",
        ]);
        assert.throws(() => assertSameOutput(exp, act, "t"), /tsuzuri-ffffffffff\.css/);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    test("CSS がかたまり以外で違うと、CSS のファイル名が出る", () => {
      const { root, exp, act } = setup();
      try {
        fs.writeFileSync(path.join(act, "tsuzuri-abcdefabcd.css"), `body{ }\n\n${block}`);
        const problems = compareOutputDirs(exp, act);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /^中身が違うファイル: tsuzuri-HASH\.css:/);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
