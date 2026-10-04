import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildTranslationIndex, createLangContext } from "../.github/scripts/lib/i18n.mjs";

const multi = () => createLangContext({ languages: ["ja", "en", "pt-BR"], rootMd: "README.md" });
const single = () => createLangContext({ languages: ["ja"], rootMd: "README.md" });

describe("createLangContext: 多言語 [ja, en, pt-BR]", () => {
  test("enabled・base・languages", () => {
    const i18n = multi();
    assert.equal(i18n.enabled, true);
    assert.equal(i18n.base, "ja");
    assert.deepEqual(i18n.languages, ["ja", "en", "pt-BR"]);
  });

  test("langOf", () => {
    const i18n = multi();
    const cases = {
      "docs/cli.en.md": "en",
      "docs/cli.EN.md": "en",
      "docs/cli.pt-br.md": "pt-BR",
      "docs/cli.pt-BR.md": "pt-BR",
      "docs/cli.md": "ja",
      "config.example.md": "ja",
      "v2.0.md": "ja",
      "cli.ja.md": "ja",
      "en/cli.md": "ja",
      "docs/cli.fr.md": "ja",
    };
    for (const [rel, lang] of Object.entries(cases)) assert.equal(i18n.langOf(rel), lang, rel);
  });

  test("基本言語の印付き cli.ja.md: baseRelOf は cli.md、出力は cli.html", () => {
    const i18n = multi();
    assert.equal(i18n.baseRelOf("cli.ja.md"), "cli.md");
    assert.equal(i18n.outputHtmlRel("cli.ja.md"), "cli.html");
  });

  test("baseRelOf: 印を取り拡張子を .md にそろえる。印が無ければそのまま", () => {
    const i18n = multi();
    assert.equal(i18n.baseRelOf("docs/cli.en.md"), "docs/cli.md");
    assert.equal(i18n.baseRelOf("docs/cli.pt-br.md"), "docs/cli.md");
    assert.equal(i18n.baseRelOf("docs/cli.en.MD"), "docs/cli.md");
    assert.equal(i18n.baseRelOf("docs/cli.md"), "docs/cli.md");
    assert.equal(i18n.baseRelOf("config.example.md"), "config.example.md");
    assert.equal(i18n.baseRelOf("docs/cli.MD"), "docs/cli.MD");
  });

  test("outputHtmlRel", () => {
    const i18n = multi();
    assert.equal(i18n.outputHtmlRel("docs/cli.en.md"), "en/docs/cli.html");
    assert.equal(i18n.outputHtmlRel("README.en.md"), "en/README.html");
    assert.equal(i18n.outputHtmlRel(".github/x.en.md"), "en/.github/x.html"); // outputRelOf はかけない
    assert.equal(i18n.outputHtmlRel("docs/cli.pt-BR.md"), "pt-br/docs/cli.html");
    assert.equal(i18n.outputHtmlRel("docs/cli.md"), "docs/cli.html");
    assert.equal(i18n.outputHtmlRel("README.md"), "README.html");
  });

  test("prefixOf: 基本言語は空、他は小文字", () => {
    const i18n = multi();
    assert.equal(i18n.prefixOf("ja"), "");
    assert.equal(i18n.prefixOf("en"), "en");
    assert.equal(i18n.prefixOf("pt-BR"), "pt-br");
  });

  test("markerOf", () => {
    const i18n = multi();
    assert.equal(i18n.markerOf("cli.ja.md"), "ja");
    assert.equal(i18n.markerOf("cli.en.md"), "en");
    assert.equal(i18n.markerOf("docs/cli.pt-br.md"), "pt-BR"); // LANGUAGES に書かれた形
    assert.equal(i18n.markerOf("cli.md"), null);
    assert.equal(i18n.markerOf("v2.0.md"), null);
  });

  test("isVariantName", () => {
    const i18n = multi();
    assert.equal(i18n.isVariantName("cli.PT-br.md", "cli.md", "pt-BR"), true);
    assert.equal(i18n.isVariantName("CLI.EN.MD", "cli.md", "en"), true);
    assert.equal(i18n.isVariantName("cli.ja.md", "cli.md", "ja"), true); // 基本言語も同じ
    assert.equal(i18n.isVariantName("cli.md", "cli.md", "ja"), false); // 印の無い名前は別扱い
    assert.equal(i18n.isVariantName("cli.en.md.bak", "cli.md", "en"), false);
    assert.equal(i18n.isVariantName("cli.en.md", "cli.md", "pt-BR"), false);
    assert.equal(i18n.isVariantName("cli.fr.md", "cli.md", "fr"), false); // LANGUAGES に無い言語
    assert.equal(i18n.isVariantName("other.en.md", "cli.md", "en"), false);
  });

  test("入口の名前: 基本言語", () => {
    const { isReadme, isIndex } = multi().dirIndexNames("ja");
    assert.equal(isReadme("README.md"), true);
    assert.equal(isReadme("Readme.md"), true);
    assert.equal(isReadme("readme.md"), true);
    assert.equal(isIndex("index.md"), true);
    assert.equal(isIndex("Index.md"), false);
    assert.equal(isReadme("Index.md"), false);
    assert.equal(isReadme("README.ja.md"), true);
    assert.equal(isIndex("index.ja.md"), true);
    // 他の言語の入口は基本言語の入口ではない
    assert.equal(isReadme("README.en.md"), false);
    assert.equal(isIndex("index.en.md"), false);
  });

  test("入口の名前: 他の言語", () => {
    const en = multi().dirIndexNames("en");
    assert.equal(en.isReadme("readme.EN.md"), true);
    assert.equal(en.isReadme("README.en.md"), true);
    assert.equal(en.isIndex("index.EN.md"), true);
    assert.equal(en.isIndex("INDEX.en.md"), false);
    assert.equal(en.isIndex("Index.en.md"), false);
    // 印の無い名前・基本言語の印は他の言語の入口ではない
    assert.equal(en.isReadme("README.md"), false);
    assert.equal(en.isIndex("index.md"), false);
    assert.equal(en.isReadme("README.ja.md"), false);
    const pt = multi().dirIndexNames("pt-BR");
    assert.equal(pt.isReadme("readme.pt-br.md"), true);
    assert.equal(pt.isIndex("index.PT-BR.md"), true);
  });

  test("candidates: リンク元の言語 → 基本言語の印付き → 今の3つ → 他の言語", () => {
    const i18n = multi();
    assert.deepEqual(i18n.candidates("en"), [
      "README.en.md", "index.en.md",
      "README.ja.md", "index.ja.md",
      "README.md", "readme.md", "index.md",
      "README.pt-BR.md", "index.pt-BR.md",
    ]);
    assert.deepEqual(i18n.candidates("ja"), [
      "README.ja.md", "index.ja.md",
      "README.md", "readme.md", "index.md",
      "README.en.md", "index.en.md",
      "README.pt-BR.md", "index.pt-BR.md",
    ]);
  });
});

describe("createLangContext: [en, ja](先頭が基本言語)", () => {
  test("docs/cli.ja.md は ja、docs/cli.md は en", () => {
    const i18n = createLangContext({ languages: ["en", "ja"], rootMd: "README.md" });
    assert.equal(i18n.base, "en");
    assert.equal(i18n.langOf("docs/cli.ja.md"), "ja");
    assert.equal(i18n.langOf("docs/cli.md"), "en");
    assert.equal(i18n.outputHtmlRel("docs/cli.ja.md"), "ja/docs/cli.html");
    assert.equal(i18n.outputHtmlRel("docs/cli.en.md"), "docs/cli.html");
  });

  test("markerOf: [ja, en]", () => {
    const i18n = createLangContext({ languages: ["ja", "en"], rootMd: "README.md" });
    assert.equal(i18n.markerOf("cli.ja.md"), "ja");
    assert.equal(i18n.markerOf("cli.en.md"), "en");
    assert.equal(i18n.markerOf("cli.md"), null);
  });
});

describe("createLangContext: 1言語 [ja](何もしない版)", () => {
  test("enabled は false、languages は [ja]、prefixOf は常に空", () => {
    const i18n = single();
    assert.equal(i18n.enabled, false);
    assert.equal(i18n.base, "ja");
    assert.deepEqual(i18n.languages, ["ja"]);
    assert.equal(i18n.prefixOf("ja"), "");
    assert.equal(i18n.prefixOf("en"), "");
  });

  test("他の言語の印は普通の名前の一部", () => {
    const i18n = single();
    assert.equal(i18n.langOf("docs/cli.en.md"), "ja");
    assert.equal(i18n.markerOf("cli.en.md"), null);
    assert.equal(i18n.baseRelOf("docs/cli.en.md"), "docs/cli.en.md");
    assert.equal(i18n.outputHtmlRel("docs/cli.en.md"), "docs/cli.en.html");
    assert.equal(i18n.isVariantName("cli.en.md", "cli.md", "en"), false);
  });

  test("基本言語の印だけ取る", () => {
    const i18n = single();
    assert.equal(i18n.markerOf("cli.ja.md"), "ja");
    assert.equal(i18n.langOf("docs/cli.ja.md"), "ja");
    assert.equal(i18n.baseRelOf("docs/cli.ja.md"), "docs/cli.md");
    assert.equal(i18n.outputHtmlRel("docs/cli.ja.md"), "docs/cli.html");
    assert.equal(i18n.outputHtmlRel("docs/cli.md"), "docs/cli.html");
    assert.equal(i18n.isVariantName("cli.JA.md", "cli.md", "ja"), true);
  });

  test("入口の名前: readme.ja.md・index.ja.md と今の3つ", () => {
    const i18n = single();
    const { isReadme, isIndex } = i18n.dirIndexNames("ja");
    assert.equal(isReadme("README.md"), true);
    assert.equal(isReadme("readme.md"), true);
    assert.equal(isReadme("README.ja.md"), true);
    assert.equal(isIndex("index.md"), true);
    assert.equal(isIndex("index.ja.md"), true);
    assert.equal(isIndex("Index.md"), false);
    assert.equal(isReadme("README.en.md"), false);
    // 1言語では知らない言語を渡しても基本言語の決まり
    assert.equal(i18n.dirIndexNames("en").isReadme("README.md"), true);
    assert.deepEqual(i18n.candidates("ja"), ["README.ja.md", "index.ja.md", "README.md", "readme.md", "index.md"]);
  });

  test("1言語 [en] でも基本言語の印は取る", () => {
    const i18n = createLangContext({ languages: ["en"], rootMd: "README.md" });
    assert.equal(i18n.outputHtmlRel("README.en.md"), "README.html");
    assert.equal(i18n.outputHtmlRel("README.ja.md"), "README.ja.html");
  });
});

describe("createLangContext: 境界値", () => {
  test("拡張子の大文字 cli.en.MD", () => {
    const i18n = multi();
    assert.equal(i18n.langOf("cli.en.MD"), "en");
    assert.equal(i18n.outputHtmlRel("cli.en.MD"), "en/cli.html");
    // 印の無い .MD は今と同じく .html にする
    assert.equal(i18n.outputHtmlRel("docs/cli.MD"), "docs/cli.html");
  });

  test("フォルダ名に点 v1.0/cli.en.md(印はファイル名だけで見る)", () => {
    const i18n = multi();
    assert.equal(i18n.langOf("v1.0/cli.en.md"), "en");
    assert.equal(i18n.baseRelOf("v1.0/cli.en.md"), "v1.0/cli.md");
    assert.equal(i18n.outputHtmlRel("v1.0/cli.en.md"), "en/v1.0/cli.html");
    assert.equal(i18n.langOf("docs.en/cli.md"), "ja");
    assert.equal(i18n.outputHtmlRel("docs.en/cli.md"), "docs.en/cli.html");
  });

  test(".md だけの名前・言語名だけの名前", () => {
    const i18n = multi();
    assert.equal(i18n.markerOf(".md"), null);
    assert.equal(i18n.outputHtmlRel(".md"), ".html");
    assert.equal(i18n.markerOf("en.md"), null);
    assert.equal(i18n.langOf("en.md"), "ja");
    assert.equal(i18n.outputHtmlRel("docs/en.md"), "docs/en.html");
  });

  test("深いフォルダ", () => {
    const i18n = multi();
    const rel = "a/b/c/d/e/page.pt-BR.md";
    assert.equal(i18n.langOf(rel), "pt-BR");
    assert.equal(i18n.baseRelOf(rel), "a/b/c/d/e/page.md");
    assert.equal(i18n.outputHtmlRel(rel), "pt-br/a/b/c/d/e/page.html");
  });

  test("languages が空・配列でないときはエラー", () => {
    assert.throws(() => createLangContext({ languages: [], rootMd: "README.md" }), TypeError);
    assert.throws(() => createLangContext({ languages: undefined, rootMd: "README.md" }), TypeError);
    assert.throws(() => createLangContext({ languages: ["ja", ""], rootMd: "README.md" }), TypeError);
  });

  test("rootMd がそのまま返る(フォルダの中の値も)。空・文字列でなければエラー", () => {
    assert.equal(multi().rootMd, "README.md");
    assert.equal(single().rootMd, "README.md");
    assert.equal(createLangContext({ languages: ["ja", "en"], rootMd: "docs/README.md" }).rootMd, "docs/README.md");
    assert.equal(createLangContext({ languages: ["en"], rootMd: "docs/README.md" }).rootMd, "docs/README.md");
    assert.throws(() => createLangContext({ languages: ["ja"] }), TypeError);
    assert.throws(() => createLangContext({ languages: ["ja"], rootMd: "" }), TypeError);
    assert.throws(() => createLangContext({ languages: ["ja"], rootMd: 1 }), TypeError);
  });
});

describe("buildTranslationIndex", () => {
  const ctxOf = (languages, rootMd = "README.md") => createLangContext({ languages, rootMd });
  const entries = (map) => [...map.entries()];

  test("[en, ja]: 印の無い方が先でも基本言語の印付きを残し、印の無い方は shadowed", () => {
    const idx = buildTranslationIndex(["docs/cli.md", "docs/cli.ja.md", "docs/cli.en.md"], ctxOf(["en", "ja"]));
    assert.deepEqual(idx.shadowed, [{ rel: "docs/cli.md", keptRel: "docs/cli.en.md" }]);
    assert.deepEqual(idx.excluded, []);
    assert.deepEqual(entries(idx.byBase.get("docs/cli.md")), [
      ["en", "docs/cli.en.md"],
      ["ja", "docs/cli.ja.md"],
    ]);
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.ja.md")), [
      ["en", "docs/cli.en.md"],
      ["ja", "docs/cli.ja.md"],
    ]);
  });

  test("[en, ja]: 印付きが先・印の無い方が後でも同じ", () => {
    const idx = buildTranslationIndex(["docs/cli.en.md", "docs/cli.md"], ctxOf(["en", "ja"]));
    assert.deepEqual(idx.shadowed, [{ rel: "docs/cli.md", keptRel: "docs/cli.en.md" }]);
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.en.md")), [["en", "docs/cli.en.md"]]);
  });

  test("[ja, en, pt-BR]: 対応付けと alternatesOf の順番(languages の順・自分を含む)", () => {
    const rels = ["README.md", "docs/cli.pt-br.md", "docs/cli.en.md", "docs/cli.md", "docs/solo.md", "docs/only.en.md"];
    const idx = buildTranslationIndex(rels, ctxOf(["ja", "en", "pt-BR"]));
    const want = [
      ["ja", "docs/cli.md"],
      ["en", "docs/cli.en.md"],
      ["pt-BR", "docs/cli.pt-br.md"],
    ];
    for (const rel of ["docs/cli.md", "docs/cli.en.md", "docs/cli.pt-br.md"]) {
      assert.deepEqual(entries(idx.alternatesOf(rel)), want, rel);
    }
    assert.deepEqual(entries(idx.alternatesOf("docs/solo.md")), [["ja", "docs/solo.md"]]);
    assert.deepEqual(entries(idx.alternatesOf("docs/only.en.md")), [["en", "docs/only.en.md"]]);
    assert.deepEqual(entries(idx.alternatesOf("docs/unknown.md")), []);
    assert.deepEqual([...idx.byBase.keys()], ["README.md", "docs/cli.md", "docs/solo.md", "docs/only.md"]);
    assert.deepEqual(idx.shadowed, []);
    assert.deepEqual(idx.excluded, []);
  });

  test("alternatesOf は毎回新しい Map を返す(書き換えても表は変わらない)", () => {
    const idx = buildTranslationIndex(["a.md", "a.en.md"], ctxOf(["ja", "en"]));
    idx.alternatesOf("a.md").delete("en");
    assert.equal(idx.alternatesOf("a.md").get("en"), "a.en.md");
  });

  test("rootOf: README.md と README.en.md。無い言語・知らない言語は null", () => {
    const idx = buildTranslationIndex(["README.md", "README.en.md", "docs/a.md"], ctxOf(["ja", "en", "fr"]));
    assert.equal(idx.rootOf("ja"), "README.md");
    assert.equal(idx.rootOf("en"), "README.en.md");
    assert.equal(idx.rootOf("EN"), "README.en.md");
    assert.equal(idx.rootOf("fr"), null);
    assert.equal(idx.rootOf("de"), null);
    const noEn = buildTranslationIndex(["README.md"], ctxOf(["ja", "en"]));
    assert.equal(noEn.rootOf("en"), null);
  });

  test("rootOf: 基本言語は印付きを優先する(1言語でも)", () => {
    const multi = buildTranslationIndex(["README.md", "README.ja.md", "README.en.md"], ctxOf(["ja", "en"]));
    assert.equal(multi.rootOf("ja"), "README.ja.md");
    const single = buildTranslationIndex(["README.md", "README.en.md"], ctxOf(["en"]));
    assert.equal(single.rootOf("en"), "README.en.md");
    assert.deepEqual(single.shadowed, [{ rel: "README.md", keptRel: "README.en.md" }]);
  });

  test("dirIndexOf: index 型を優先", () => {
    const idx = buildTranslationIndex(
      ["guide/README.md", "guide/index.md", "guide/README.en.md", "guide/index.en.md"],
      ctxOf(["ja", "en"]),
    );
    assert.deepEqual(idx.dirIndexOf("guide", "ja"), { rel: "guide/index.md", kind: "index" });
    assert.deepEqual(idx.dirIndexOf("guide", "en"), { rel: "guide/index.en.md", kind: "index" });
  });

  test("dirIndexOf: 基本言語は型ごとに印付きを優先し、無ければ印なし。shadowed は対象外", () => {
    const ctx = ctxOf(["ja", "en"]);
    const marked = buildTranslationIndex(["guide/README.md", "guide/README.ja.md"], ctx);
    assert.deepEqual(marked.dirIndexOf("guide", "ja"), { rel: "guide/README.ja.md", kind: "readme" });
    assert.deepEqual(marked.shadowed, [{ rel: "guide/README.md", keptRel: "guide/README.ja.md" }]);
    const plain = buildTranslationIndex(["guide/README.md"], ctx);
    assert.deepEqual(plain.dirIndexOf("guide", "ja"), { rel: "guide/README.md", kind: "readme" });
    const idx = buildTranslationIndex(["guide/index.md", "guide/index.ja.md"], ctx);
    assert.deepEqual(idx.dirIndexOf("guide", "ja"), { rel: "guide/index.ja.md", kind: "index" });
    // 他の言語の入口は印付きだけ
    assert.equal(plain.dirIndexOf("guide", "en"), null);
  });

  test("dirIndexOf: 入口の無いフォルダ・知らないフォルダ・知らない言語は null", () => {
    const idx = buildTranslationIndex(["guide/a.md", "guide/Index.md", "guide/sub/README.md"], ctxOf(["ja", "en"]));
    assert.equal(idx.dirIndexOf("guide", "ja"), null);
    assert.equal(idx.dirIndexOf("nothing", "ja"), null);
    assert.equal(idx.dirIndexOf("guide/sub", "de"), null);
    assert.deepEqual(idx.dirIndexOf("guide/sub", "ja"), { rel: "guide/sub/README.md", kind: "readme" });
    assert.deepEqual(idx.dirIndexOf("guide/sub/", "ja"), { rel: "guide/sub/README.md", kind: "readme" });
  });

  test("dirIndexOf: dir に \".\"(サイト直下)", () => {
    const idx = buildTranslationIndex(["README.md", "README.en.md", "docs/README.md"], ctxOf(["ja", "en"]));
    assert.deepEqual(idx.dirIndexOf(".", "ja"), { rel: "README.md", kind: "readme" });
    assert.deepEqual(idx.dirIndexOf(".", "en"), { rel: "README.en.md", kind: "readme" });
    assert.deepEqual(idx.dirIndexOf("", "ja"), { rel: "README.md", kind: "readme" });
  });

  test("1言語 [en]: guide/README.en.md だけ・README.md と README.en.md・index.md と README.en.md", () => {
    const ctx = ctxOf(["en"]);
    const only = buildTranslationIndex(["README.md", "guide/README.en.md"], ctx);
    assert.deepEqual(only.dirIndexOf("guide", "en"), { rel: "guide/README.en.md", kind: "readme" });
    const both = buildTranslationIndex(["guide/README.md", "guide/README.en.md"], ctx);
    assert.deepEqual(both.dirIndexOf("guide", "en"), { rel: "guide/README.en.md", kind: "readme" });
    assert.deepEqual(both.shadowed, [{ rel: "guide/README.md", keptRel: "guide/README.en.md" }]);
    const mixed = buildTranslationIndex(["guide/index.md", "guide/README.en.md"], ctx);
    assert.deepEqual(mixed.dirIndexOf("guide", "en"), { rel: "guide/index.md", kind: "index" });
    assert.deepEqual(mixed.shadowed, []);
  });

  test("1言語 [ja]: 他の言語の印は普通の名前なので対応付けない", () => {
    const idx = buildTranslationIndex(["docs/cli.md", "docs/cli.en.md"], ctxOf(["ja"]));
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.md")), [["ja", "docs/cli.md"]]);
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.en.md")), [["ja", "docs/cli.en.md"]]);
    assert.deepEqual(idx.shadowed, []);
    assert.deepEqual(idx.excluded, []);
  });

  test("重複: 同じ言語の印付きどうしは先勝ちで、後の方を excluded に", () => {
    const idx = buildTranslationIndex(["docs/a.en.md", "docs/a.EN.md", "docs/a.md"], ctxOf(["ja", "en"]));
    assert.deepEqual(idx.excluded, [{ rel: "docs/a.EN.md", keptRel: "docs/a.en.md" }]);
    assert.deepEqual(idx.shadowed, []);
    assert.deepEqual(entries(idx.alternatesOf("docs/a.md")), [
      ["ja", "docs/a.md"],
      ["en", "docs/a.en.md"],
    ]);
  });

  test("重複と shadowed が同時にあるとき(基本言語の印付き2つ + 印なし)", () => {
    const idx = buildTranslationIndex(["docs/a.md", "docs/a.JA.md", "docs/a.ja.md"], ctxOf(["ja", "en"]));
    assert.deepEqual(idx.shadowed, [{ rel: "docs/a.md", keptRel: "docs/a.JA.md" }]);
    assert.deepEqual(idx.excluded, [{ rel: "docs/a.ja.md", keptRel: "docs/a.JA.md" }]);
  });

  test("境界値: rels が空", () => {
    const idx = buildTranslationIndex([], ctxOf(["ja", "en"]));
    assert.equal(idx.byBase.size, 0);
    assert.deepEqual(idx.excluded, []);
    assert.deepEqual(idx.shadowed, []);
    assert.equal(idx.rootOf("ja"), null);
    assert.equal(idx.dirIndexOf(".", "ja"), null);
    assert.deepEqual(entries(idx.alternatesOf("README.md")), []);
  });

  test("境界値: ROOT_MD がフォルダの中(docs/README.md)", () => {
    const rels = ["docs/README.md", "docs/README.en.md", "README.en.md"];
    const idx = buildTranslationIndex(rels, ctxOf(["ja", "en"], "docs/README.md"));
    assert.equal(idx.rootOf("ja"), "docs/README.md");
    assert.equal(idx.rootOf("en"), "docs/README.en.md");
  });

  test("境界値: Iterable(Map のキー)を受け付け、拡張子の大文字は同じ元の名前にそろえる", () => {
    const visited = new Map([["v1.0/cli.MD", 1], ["v1.0/cli.ja.md", 1], ["v1.0/cli.en.MD", 1]]);
    const idx = buildTranslationIndex(visited.keys(), ctxOf(["ja", "en"]));
    assert.deepEqual(idx.shadowed, [{ rel: "v1.0/cli.MD", keptRel: "v1.0/cli.ja.md" }]);
    assert.deepEqual(entries(idx.byBase.get("v1.0/cli.md")), [
      ["ja", "v1.0/cli.ja.md"],
      ["en", "v1.0/cli.en.MD"],
    ]);
  });

  test("ctx が無い・形が違うときはエラー", () => {
    assert.throws(() => buildTranslationIndex([], undefined), TypeError);
    assert.throws(() => buildTranslationIndex([], {}), TypeError);
  });
});

describe("buildTranslationIndex: 名前の大文字・小文字(crawler の isVariantName に合わせる)", () => {
  const ctxOf = (languages, rootMd = "README.md") => createLangContext({ languages, rootMd });
  const entries = (map) => [...map.entries()];

  test("[ja, en]: README.md と readme.en.md は対応し、rootOf(en) は readme.en.md", () => {
    const idx = buildTranslationIndex(["README.md", "readme.en.md"], ctxOf(["ja", "en"]));
    assert.equal(idx.rootOf("ja"), "README.md");
    assert.equal(idx.rootOf("en"), "readme.en.md");
    assert.deepEqual(entries(idx.alternatesOf("README.md")), [
      ["ja", "README.md"],
      ["en", "readme.en.md"],
    ]);
  });

  test("[en, ja]: readme.en.md と README.ja.md(印の無い起点が無い)でも rootOf(en) は readme.en.md", () => {
    const idx = buildTranslationIndex(["readme.en.md", "README.ja.md"], ctxOf(["en", "ja"]));
    assert.equal(idx.rootOf("en"), "readme.en.md");
    assert.equal(idx.rootOf("ja"), "README.ja.md");
    assert.deepEqual(entries(idx.alternatesOf("README.ja.md")), [
      ["en", "readme.en.md"],
      ["ja", "README.ja.md"],
    ]);
  });

  test("[en]: README.md と readme.en.md → README.md は shadowed(どちらの順でも)", () => {
    for (const rels of [["README.md", "readme.en.md"], ["readme.en.md", "README.md"]]) {
      const idx = buildTranslationIndex(rels, ctxOf(["en"]));
      assert.deepEqual(idx.shadowed, [{ rel: "README.md", keptRel: "readme.en.md" }], rels.join(","));
      assert.deepEqual(idx.excluded, []);
      assert.equal(idx.rootOf("en"), "readme.en.md");
      assert.deepEqual(idx.dirIndexOf(".", "en"), { rel: "readme.en.md", kind: "readme" });
    }
  });

  test("[ja, en]: docs/CLI.md と docs/cli.en.md は対応する", () => {
    const idx = buildTranslationIndex(["docs/CLI.md", "docs/cli.en.md"], ctxOf(["ja", "en"]));
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.en.md")), [
      ["ja", "docs/CLI.md"],
      ["en", "docs/cli.en.md"],
    ]);
    assert.deepEqual(idx.shadowed, []);
    assert.deepEqual(idx.excluded, []);
  });

  test("[ja]: 印の無い docs/CLI.md と docs/cli.md は今と同じく別のページで両方残る", () => {
    const idx = buildTranslationIndex(["docs/CLI.md", "docs/cli.md"], ctxOf(["ja"]));
    assert.deepEqual(idx.shadowed, []);
    assert.deepEqual(idx.excluded, []);
    assert.deepEqual(entries(idx.alternatesOf("docs/CLI.md")), [["ja", "docs/CLI.md"]]);
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.md")), [["ja", "docs/cli.md"]]);
  });

  test("印付きは完全一致の組を優先する(CLI.md・cli.md の両方があるとき)", () => {
    const idx = buildTranslationIndex(["docs/CLI.md", "docs/cli.md", "docs/cli.en.md", "docs/Cli.en.md"], ctxOf(["ja", "en"]));
    assert.deepEqual(entries(idx.alternatesOf("docs/cli.md")), [
      ["ja", "docs/cli.md"],
      ["en", "docs/cli.en.md"],
    ]);
    // 完全一致の組が無い Cli.en.md は、見つかった順で最初の組(CLI.md)に入る
    assert.deepEqual(entries(idx.alternatesOf("docs/CLI.md")), [
      ["ja", "docs/CLI.md"],
      ["en", "docs/Cli.en.md"],
    ]);
  });
});
