import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 言語の切り替えボタンの CSS のかたまり(base.css と7テーマの末尾)を確かめる。
// 目印は test/golden.test.mjs と同じ文字。

const STYLES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "styles");
const THEMES = ["material", "glass", "neumorphism", "editorial", "minimal", "blueprint", "nineties"];
const START = "/* ---------- 言語の切り替え ここから";
const END = "/* ---------- 言語の切り替え ここまで ---------- */";
const LANG_SELECTOR = ":is(.tsuzuri-nav-head, .tsuzuri-lang-bar) .tsuzuri-lang-switch";
// テーマのボタンの見た目として写す宣言
const BUTTON_PROPS = ["color", "background", "border", "border-radius", "box-shadow"];

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

// CSS を「元の部分」と「かたまり」に分ける(かたまりは末尾にある前提)
function splitCss(css) {
  const start = css.indexOf(START);
  const end = css.indexOf(END);
  return { original: css.slice(0, start), block: css.slice(start, end + END.length), after: css.slice(end + END.length) };
}

// 単純な CSS の読み取り: { selectors: string[], decls: Map } をファイルの順に返す
function parseRules(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  for (const m of noComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // かっこの外のカンマだけで分ける(:is(.a, .b) .c を1つのセレクタとして扱う)
    const selectors = m[1].split(/,(?![^(]*\))/).map((s) => s.trim().replace(/\s+/g, " "));
    const decls = new Map();
    for (const part of m[2].split(";")) {
      const i = part.indexOf(":");
      if (i < 0) continue;
      decls.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
    }
    rules.push({ selectors, decls });
  }
  return rules;
}

// あるセレクタに当たる宣言を、後の行での上書きも反映して1つにまとめる
function finalDecls(rules, selector) {
  const merged = new Map();
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    for (const [k, v] of rule.decls) merged.set(k, v);
  }
  return merged;
}

describe("言語の切り替えの CSS: 目印", () => {
  for (const file of ["base.css", ...THEMES.map((t) => `${t}.css`)]) {
    test(`styles/${file}: 目印がちょうど1組あり、順番が正しく、ファイルの末尾にある`, () => {
      const css = fs.readFileSync(path.join(STYLES_DIR, file), "utf-8");
      assert.equal(countOf(css, START), 1, "始まりの目印の数");
      assert.equal(countOf(css, END), 1, "終わりの目印の数");
      const { original, block, after } = splitCss(css);
      assert.ok(css.indexOf(START) < css.indexOf(END), "始まりが終わりより前");
      assert.equal(after, "\n", "終わりの目印の後は改行1つだけ");
      assert.ok(original.endsWith("}\n\n"), "かたまりの前に空行1つ");
      assert.ok(block.includes(".tsuzuri-lang-switch"), "かたまりの中に .tsuzuri-lang-switch がある");
      assert.ok(!original.includes("tsuzuri-lang"), "かたまりの外に tsuzuri-lang が無い");
    });
  }

  test("base.css の始まりの目印は設計どおりの文", () => {
    const css = fs.readFileSync(path.join(STYLES_DIR, "base.css"), "utf-8");
    assert.ok(css.includes(`${START}(多言語サイトのときだけ出力される) ---------- */`));
  });
});

describe("言語の切り替えの CSS: base.css のメニュー", () => {
  const { block } = splitCss(fs.readFileSync(path.join(STYLES_DIR, "base.css"), "utf-8"));
  const rules = parseRules(block);
  const MENU = ":is(.tsuzuri-nav-head, .tsuzuri-lang-bar) .tsuzuri-lang-menu";

  test("一覧の項目は本文のリストの印を打ち消す(::before・::marker・display: block)", () => {
    assert.equal(finalDecls(rules, `${MENU} li::before`).get("content"), "none");
    assert.equal(finalDecls(rules, `${MENU} li::marker`).get("content"), "none");
    assert.equal(finalDecls(rules, `${MENU} li`).get("display"), "block");
  });

  test("一覧のリンクは下線なし・周りの文字の色・背景や枠なし(ナビでも本文の上でも同じ)", () => {
    const a = finalDecls(rules, `${MENU} a`);
    assert.equal(a.get("text-decoration"), "none");
    assert.equal(a.get("color"), "inherit");
    assert.equal(a.get("background"), "none");
    assert.equal(a.get("border"), "0");
    assert.equal(a.get("box-shadow"), "none");
    const visited = finalDecls(rules, `${MENU} a:is(:hover, :visited)`);
    assert.equal(visited.get("text-decoration"), "none");
    assert.equal(visited.get("color"), "inherit");
    assert.equal(finalDecls(rules, `${MENU} a[aria-current]`).get("font-weight"), "700");
  });

  test("開いている間: 対応ブラウザでは <details> の箱をなくし、一覧だけを最後の行に全幅で置く(重ねない)", () => {
    const start = block.indexOf("@supports selector(::details-content)");
    assert.ok(start > 0, "@supports selector(::details-content) がある");
    const sup = parseRules(block.slice(start));
    assert.equal(finalDecls(sup, ".tsuzuri-nav-head > .tsuzuri-lang-menu[open]").get("display"), "contents");
    const content = finalDecls(sup, ".tsuzuri-nav-head > .tsuzuri-lang-menu[open]::details-content");
    assert.equal(content.get("order"), "1");
    assert.equal(content.get("flex"), "0 0 100%");
    assert.equal(finalDecls(sup, ".tsuzuri-nav-head > .tsuzuri-lang-menu[open] > summary").get("margin-left"), "auto");
    // 一覧は重ねて表示しない・背景を付けない(設計の決まりを保つ)
    const ul = finalDecls(rules, `${MENU} > ul`);
    assert.equal(ul.get("position"), "static");
    assert.ok(!ul.has("background") && !ul.has("background-color"));
    assert.ok(!/position:\s*(absolute|fixed)/.test(block), "かたまりの中に absolute・fixed が無い");
  });
});

describe("言語の切り替えの CSS: テーマのボタンの見た目を写している", () => {
  for (const theme of THEMES) {
    test(`styles/${theme}.css: 言語ボタンの宣言が「ライト/ダーク」ボタンの最終的な宣言と同じ`, () => {
      const css = fs.readFileSync(path.join(STYLES_DIR, `${theme}.css`), "utf-8");
      const { original, block } = splitCss(css);
      const expected = finalDecls(parseRules(original), ".tsuzuri-theme-toggle");
      const actual = finalDecls(parseRules(block), LANG_SELECTOR);
      for (const prop of BUTTON_PROPS) {
        assert.ok(expected.has(prop), `元の部分に ${prop} がある`);
        assert.equal(actual.get(prop), expected.get(prop), `${prop} の値`);
      }
      // 「メニュー」ボタンにも同じ最終値が当たっていること(写す元がそろっている)
      const label = finalDecls(parseRules(original), ".tsuzuri-nav-label");
      for (const prop of BUTTON_PROPS) assert.equal(label.get(prop), expected.get(prop), `メニューの ${prop}`);
      // 新しい宣言を作っていない
      assert.deepEqual([...actual.keys()].sort(), [...BUTTON_PROPS].sort());
    });
  }

  test("読み取りの部品: 後の行の上書きが反映される(境界の確かめ)", () => {
    const rules = parseRules(".a, .b { color: red; border: 0; }\n/* .b { color: blue; } */\n.c, .b { border: 1px solid x; }\n");
    assert.deepEqual(Object.fromEntries(finalDecls(rules, ".b")), { color: "red", border: "1px solid x" });
    assert.equal(finalDecls(rules, ".zz").size, 0);
    const isRules = parseRules(":is(.x, .y) .z, .w { color: red; }\n");
    assert.deepEqual(isRules[0].selectors, [":is(.x, .y) .z", ".w"]);
  });
});
