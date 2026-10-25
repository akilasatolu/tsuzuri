import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CLI_LANGS,
  DEFAULT_CLI_LANG,
  MESSAGES,
  isCliLang,
  setCliLang,
  getCliLang,
  detectLangFromArgv,
  t,
} from "../bin/messages.mjs";

const BIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "bin");
const CJK = /[぀-ヿ一-鿿]/;
const varsOf = (text) => [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).sort();

// 他のテストに言語の状態を残さない
function withLang(lang, fn) {
  setCliLang(lang);
  try {
    return fn();
  } finally {
    setCliLang(DEFAULT_CLI_LANG);
  }
}

test("カタログ: 言語は en と ja で、既定は en", () => {
  assert.deepEqual(CLI_LANGS, ["en", "ja"]);
  assert.equal(DEFAULT_CLI_LANG, "en");
  assert.deepEqual(Object.keys(MESSAGES).sort(), ["en", "ja"]);
  assert.equal(getCliLang(), "en");
});

test("カタログ: en と ja のキーの集合が一致する", () => {
  const en = Object.keys(MESSAGES.en).sort();
  const ja = Object.keys(MESSAGES.ja).sort();
  assert.deepEqual(ja.filter((k) => !en.includes(k)), [], "ja にだけあるキー");
  assert.deepEqual(en.filter((k) => !ja.includes(k)), [], "en にだけあるキー");
  assert.ok(en.length > 50);
});

test("カタログ: 各キーの {変数} の名前の集合が en と ja で一致する", () => {
  for (const key of Object.keys(MESSAGES.en)) {
    assert.deepEqual(varsOf(MESSAGES.ja[key]), varsOf(MESSAGES.en[key]), key);
  }
});

test("カタログ: 値は空でなく、en の値に日本語(ひらがな・カタカナ・漢字)がない", () => {
  for (const lang of CLI_LANGS) {
    for (const [key, value] of Object.entries(MESSAGES[lang])) {
      assert.equal(typeof value, "string", `${lang}.${key}`);
      assert.ok(value.length > 0, `${lang}.${key} が空`);
    }
  }
  for (const [key, value] of Object.entries(MESSAGES.en)) {
    assert.doesNotMatch(value, CJK, `en.${key}`);
  }
});

test("カタログ: シェルの設定ファイルに書く方法(zshrc・bashrc・export・alias など)を案内する文言がない", () => {
  const banned = /zshrc|bashrc|bash_profile|zprofile|\.profile|\bexport \S|\balias \S/;
  for (const lang of CLI_LANGS) {
    for (const [key, value] of Object.entries(MESSAGES[lang])) {
      assert.doesNotMatch(value, banned, `${lang}.${key}`);
    }
  }
});

test("t: {name} を vars で置き換え、vars に無い名前はそのまま残す", () => {
  assert.equal(t("log.created", { path: "a/b.txt" }), "✔ a/b.txt created");
  assert.equal(t("log.created", { path: "a/b.txt" }, "ja"), "✔ a/b.txt を作成しました");
  assert.equal(t("log.created", {}), "✔ {path} created");
  // 値の中の {…} は、さらには置き換えない
  assert.equal(t("log.created", { path: "{path}" }), "✔ {path} created");
});

test("t: 現在の言語(setCliLang)に従い、第3引数で上書きできる", () => {
  assert.match(t("update.done"), /Update complete/);
  withLang("ja", () => {
    assert.equal(getCliLang(), "ja");
    assert.match(t("update.done"), /更新が完了しました/);
    assert.match(t("update.done", {}, "en"), /Update complete/);
  });
  assert.equal(getCliLang(), "en");
});

test("t: 未知のキーは Error。setCliLang の不正な言語は RangeError", () => {
  assert.throws(() => t("no.such.key"), /Unknown message key: no\.such\.key/);
  assert.throws(() => setCliLang("fr"), RangeError);
  assert.throws(() => setCliLang("JA"), RangeError);
  assert.throws(() => setCliLang(undefined), RangeError);
  assert.equal(getCliLang(), "en");
});

test("isCliLang: en と ja の小文字の完全一致だけ", () => {
  assert.equal(isCliLang("en"), true);
  assert.equal(isCliLang("ja"), true);
  for (const value of ["EN", "JA", "ja-JP", "en-US", "fr", "", undefined, null, 1]) {
    assert.equal(isCliLang(value), false, String(value));
  }
});

test("detectLangFromArgv: 最後に現れた --lang の値を見る。en か ja でなければ en", () => {
  const cases = [
    [[], "en"],
    [["init", "-y"], "en"],
    [["--lang", "ja"], "ja"],
    [["--lang=ja"], "ja"],
    [["--lang", "en"], "en"],
    [["-y", "--lang", "ja", "--force"], "ja"],
    [["--lang", "fr"], "en"],
    [["--lang=fr"], "en"],
    [["--lang", "JA"], "en"],
    [["--lang", "ja-JP"], "en"],
    [["--lang"], "en"],
    [["--lang", "--yes"], "en"],
    [["--lang", "ja", "--lang", "fr"], "en"],
    [["--lang", "fr", "--lang", "ja"], "ja"],
    [["--lang=ja", "--lang", "en"], "en"],
    [["--lang", "ja", "--lang"], "en"],
    [["--", "--lang", "ja"], "en"],
    [["--bogus", "--lang", "ja"], "ja"],
  ];
  for (const [argv, expected] of cases) {
    assert.equal(detectLangFromArgv(argv), expected, JSON.stringify(argv));
  }
});

test("bin/cli.mjs と bin/preview.mjs の t(\"…\") のキーは、すべてカタログにあり、カタログのキーはどこかで使われている", () => {
  const sources = ["cli.mjs", "preview.mjs"].map((f) => readFileSync(join(BIN_DIR, f), "utf8")).join("\n");
  const used = new Set([...sources.matchAll(/\bt\(\s*["']([\w.]+)["']/g)].map((m) => m[1]));
  // 動的に引くキー: 設定ファイルのコメント config.<name>(buildDocsPagesConfig の item)
  for (const m of sources.matchAll(/item\(\s*"(\w+)"/g)) used.add(`config.${m[1]}`);
  assert.deepEqual([...used].filter((k) => !(k in MESSAGES.en)), [], "カタログに無いキーを使っている");
  assert.deepEqual(Object.keys(MESSAGES.en).filter((k) => !used.has(k)), [], "どこでも使われていないキー");
  // テーマの質問・説明・--theme のエラー、保持のログ(log.kept)は無い
  for (const key of ["prompt.theme", "error.theme", "log.kept", "css.template", "config.styleFile"]) {
    assert.equal(key in MESSAGES.en, false, key);
    assert.equal(key in MESSAGES.ja, false, key);
  }
  assert.equal(Object.keys(MESSAGES.en).filter((k) => k.startsWith("theme.")).length, 0);
});
