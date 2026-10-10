import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  UI_STRINGS,
  FALLBACK_UI_LANG,
  resolveUiLang,
  uiStrings,
  formatUi,
  languageName,
  runtimeStrings,
  RUNTIME_PICK_SOURCE,
} from "../.github/scripts/lib/i18n.mjs";

// 期待値は、多言語対応の前のコード(build-docs.mjs・html-renderer.mjs・copy-button.mjs・
// theme-toggle.mjs)にあった文言を1つずつ写したもの。langMenu 以下の3つは新しい文言(設計の表のとおり)。
const EXPECTED_EN = {
  menu: "Menu",
  navLabel: "Site pages",
  searchPlaceholder: "Search this site",
  searchEmpty: "No results",
  pagerPrev: "Previous",
  pagerNext: "Next",
  pagerNav: "Previous and next pages",
  toc: "Contents",
  anchorLabel: 'Link to "{text}"',
  lastUpdated: "Last updated",
  editPage: "Edit this page on GitHub",
  repoLink: "GitHub repository",
  repoVersion: "Version",
  repoLicense: "License",
  skip: "Skip to content",
  footnotes: "Footnotes",
  footnoteBack: "Back to reference {0}",
  alerts: { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" },
  notFound: {
    title: "Page not found",
    body: "The page you are looking for may have been moved or deleted, or the URL may be incorrect.",
    back: "Back to the top page",
  },
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  toLight: "Switch to light mode",
  toDark: "Switch to dark mode",
  langMenu: "Language",
  langSwitchTo: "Switch language to {name}",
  langUntranslated: "This page is not available in {name}. Opens the {name} top page.",
};

const EXPECTED_JA = {
  menu: "メニュー",
  navLabel: "サイト内ページ",
  searchPlaceholder: "サイト内を検索",
  searchEmpty: "見つかりませんでした",
  pagerPrev: "前のページ",
  pagerNext: "次のページ",
  pagerNav: "前後のページ",
  toc: "目次",
  anchorLabel: "「{text}」へのリンク",
  lastUpdated: "最終更新",
  editPage: "このページを GitHub で編集",
  repoLink: "GitHub リポジトリ",
  repoVersion: "バージョン",
  repoLicense: "ライセンス",
  skip: "本文へスキップ",
  footnotes: "脚注",
  footnoteBack: "本文の参照箇所 {0} に戻る",
  alerts: { note: "補足", tip: "ヒント", important: "重要", warning: "警告", caution: "注意" },
  notFound: {
    title: "ページが見つかりません",
    body: "お探しのページは、移動または削除されたか、URLが間違っている可能性があります。",
    back: "トップページへ戻る",
  },
  copy: "コピー",
  copied: "コピーしました",
  copyFailed: "コピーできませんでした",
  toLight: "ライト表示に切り替える",
  toDark: "ダーク表示に切り替える",
  langMenu: "言語",
  langSwitchTo: "{name}に切り替える",
  langUntranslated: "このページの{name}版はありません。{name}のトップページを開きます。",
};

// 表に fr を足した表(表を差し替えて選び方を確かめる用)
const TABLE_WITH_FR = { ...UI_STRINGS, fr: { ...UI_STRINGS.en, menu: "Menu (fr)" } };

describe("resolveUiLang", () => {
  test("ja・ja-JP・JA は ja", () => {
    assert.equal(resolveUiLang("ja"), "ja");
    assert.equal(resolveUiLang("ja-JP"), "ja");
    assert.equal(resolveUiLang("JA"), "ja");
  });
  test("en・en-US は en、表に無い fr・zh-Hant も en", () => {
    assert.equal(resolveUiLang("en"), "en");
    assert.equal(resolveUiLang("en-US"), "en");
    assert.equal(resolveUiLang("fr"), "en");
    assert.equal(resolveUiLang("zh-Hant"), "en");
  });
  test("空文字・undefined・null は en", () => {
    assert.equal(resolveUiLang(""), "en");
    assert.equal(resolveUiLang(undefined), "en");
    assert.equal(resolveUiLang(null), "en");
    assert.equal(resolveUiLang(), "en");
  });
  test("表に fr を足すと fr・fr-CA・FR は fr", () => {
    assert.equal(resolveUiLang("fr", TABLE_WITH_FR), "fr");
    assert.equal(resolveUiLang("fr-CA", TABLE_WITH_FR), "fr");
    assert.equal(resolveUiLang("FR", TABLE_WITH_FR), "fr");
    assert.equal(resolveUiLang("ja-JP", TABLE_WITH_FR), "ja");
    assert.equal(resolveUiLang("de", TABLE_WITH_FR), "en");
  });
  test("表のキーに大文字があっても、大文字・小文字を区別せずに選び、表のキーを返す", () => {
    const table = { en: {}, "pt-BR": {}, pt: {} };
    assert.equal(resolveUiLang("pt-br", table), "pt-BR");
    assert.equal(resolveUiLang("PT-BR", table), "pt-BR");
    assert.equal(resolveUiLang("pt-PT", table), "pt");
  });
  test("先頭の部分が空(-JP)なら en", () => {
    assert.equal(resolveUiLang("-JP"), "en");
  });
  test("FALLBACK_UI_LANG は en", () => {
    assert.equal(FALLBACK_UI_LANG, "en");
  });
});

describe("uiStrings(今のコードの文言と同じ)", () => {
  test("ja の表", () => {
    assert.deepEqual(uiStrings("ja"), EXPECTED_JA);
  });
  test("en の表", () => {
    assert.deepEqual(uiStrings("en"), EXPECTED_EN);
  });
  test("ja-JP は ja の表、fr・空は en の表", () => {
    assert.equal(uiStrings("ja-JP"), UI_STRINGS.ja);
    assert.equal(uiStrings("fr"), UI_STRINGS.en);
    assert.equal(uiStrings(""), UI_STRINGS.en);
  });
  test("en と ja のキーがそろっている", () => {
    const shape = (o) =>
      Object.keys(o)
        .sort()
        .map((k) => (typeof o[k] === "object" ? `${k}:{${shape(o[k])}}` : k))
        .join(",");
    assert.equal(shape(UI_STRINGS.ja), shape(UI_STRINGS.en));
  });
  test("表は書き換えられない(凍結されている)", () => {
    assert.ok(Object.isFrozen(UI_STRINGS));
    assert.ok(Object.isFrozen(UI_STRINGS.ja));
    assert.ok(Object.isFrozen(UI_STRINGS.ja.alerts));
    assert.throws(() => {
      UI_STRINGS.ja.menu = "x";
    }, TypeError);
  });
});

describe("formatUi", () => {
  test("{name} を置き換える", () => {
    assert.equal(formatUi(UI_STRINGS.en.langSwitchTo, { name: "日本語" }), "Switch language to 日本語");
    assert.equal(formatUi(UI_STRINGS.ja.anchorLabel, { text: "はじめに" }), "「はじめに」へのリンク");
    assert.equal(formatUi(UI_STRINGS.en.anchorLabel, { text: "Intro" }), 'Link to "Intro"');
  });
  test("同じ名前が2回あれば両方置き換える", () => {
    assert.equal(
      formatUi(UI_STRINGS.ja.langUntranslated, { name: "English" }),
      "このページのEnglish版はありません。Englishのトップページを開きます。"
    );
  });
  test("{0} はそのまま残す", () => {
    assert.equal(formatUi(UI_STRINGS.ja.footnoteBack, { name: "x" }), "本文の参照箇所 {0} に戻る");
  });
  test("vars に無い名前は残し、ある名前だけ置き換える", () => {
    assert.equal(formatUi("{name} / {other}", { name: "A" }), "A / {other}");
    assert.equal(formatUi("{name}", {}), "{name}");
    assert.equal(formatUi("{name}"), "{name}");
  });
  test("置き換える値に $ などがあっても文字どおり入る", () => {
    assert.equal(formatUi("[{text}]", { text: "$& $1 {name}" }), "[$& $1 {name}]");
  });
  test("{} や置き換える名前の無い文字列はそのまま", () => {
    assert.equal(formatUi("a {} b", { "": "x" }), "a {} b");
    assert.equal(formatUi("Menu", { name: "x" }), "Menu");
  });
});

describe("languageName", () => {
  test("その言語自身の書き方で、先頭が大文字", () => {
    assert.equal(languageName("en"), "English");
    assert.equal(languageName("ja"), "日本語");
    assert.equal(languageName("fr"), "Français");
    assert.equal(languageName("pt-BR"), "Português (Brasil)");
  });
  test("不正な値はそのまま", () => {
    assert.equal(languageName("en_US"), "en_US");
    assert.equal(languageName(""), "");
  });
});

describe("runtimeStrings", () => {
  test("指定したキーだけを言語ごとに抜き出す", () => {
    assert.deepEqual(runtimeStrings(["copy", "copied", "copyFailed"]), {
      en: { copy: "Copy", copied: "Copied", copyFailed: "Copy failed" },
      ja: { copy: "コピー", copied: "コピーしました", copyFailed: "コピーできませんでした" },
    });
    assert.deepEqual(runtimeStrings(["toLight", "toDark"]), {
      en: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
      ja: { toLight: "ライト表示に切り替える", toDark: "ダーク表示に切り替える" },
    });
  });
  test("表に無いキーは入れない、キーが空なら言語ごとに空の表", () => {
    assert.deepEqual(runtimeStrings(["copy", "nope"]), { en: { copy: "Copy" }, ja: { copy: "コピー" } });
    assert.deepEqual(runtimeStrings([]), { en: {}, ja: {} });
  });
  test("JSON にして埋め込める", () => {
    const s = runtimeStrings(["copy"]);
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  });
});

describe("RUNTIME_PICK_SOURCE", () => {
  // 閲覧時のスクリプトと同じく、ソースの文字列を式として評価して動かす
  const pick = new Function(`return (${RUNTIME_PICK_SOURCE});`)();

  test("resolveUiLang と同じ結果になる(今の表)", () => {
    for (const tag of ["ja", "ja-JP", "JA", "en", "en-US", "fr", "zh-Hant", "", undefined, null]) {
      assert.equal(pick(UI_STRINGS, tag), resolveUiLang(tag), `tag=${tag}`);
    }
  });
  test("resolveUiLang と同じ結果になる(fr を足した表)", () => {
    for (const tag of ["ja", "ja-JP", "en", "fr", "fr-CA", "de", ""]) {
      assert.equal(pick(TABLE_WITH_FR, tag), resolveUiLang(tag, TABLE_WITH_FR), `tag=${tag}`);
    }
  });
  test("runtimeStrings の表から選べる", () => {
    const S = JSON.parse(JSON.stringify(runtimeStrings(["copy"])));
    assert.equal(S[pick(S, "ja-JP")].copy, "コピー");
    assert.equal(S[pick(S, "fr")].copy, "Copy");
  });
});
