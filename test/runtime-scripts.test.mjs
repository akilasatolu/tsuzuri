// 閲覧時に動くスクリプト(tsuzuri-copy.js・tsuzuri-theme.js)を、簡単な偽の document などの上で
// 実際に動かし、<html lang> に合わせた文言になること・振る舞いが変わっていないことを確かめる。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { COPY_SCRIPT } from "../.github/scripts/lib/copy-button.mjs";
import { CAROUSEL_SCRIPT } from "../.github/scripts/lib/carousel.mjs";
import { THEME_SCRIPT } from "../.github/scripts/lib/theme-toggle.mjs";

const JA_LANGS = ["ja", "ja-JP", "JA"];
const EN_LANGS = ["en", "en-US", "fr", "", undefined];

// ---------- 偽の DOM ----------

/** 属性・イベント・子要素だけを持つ、最小限の要素 */
function fakeElement(tag) {
  const listeners = {};
  return {
    tag,
    className: "",
    type: "",
    textContent: "",
    title: "",
    attrs: {},
    children: [],
    parentElement: null,
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    addEventListener(type, fn) {
      (listeners[type] ??= []).push(fn);
    },
    async dispatch(type) {
      for (const fn of listeners[type] ?? []) await fn();
    },
    append(child) {
      this.children.push(child);
      child.parentElement = this;
    },
    before(node) {
      this.beforeNodes = [...(this.beforeNodes ?? []), node];
    },
    insertBefore(node, ref) {
      const i = this.children.indexOf(ref);
      this.children.splice(i < 0 ? this.children.length : i, 0, node);
    },
  };
}

/**
 * COPY_SCRIPT を動かす。コードブロックは1つ。
 * @param {string | undefined} lang <html lang> の値(undefined は lang 属性が無い場合の "")
 * @param {{ clipboardFails?: boolean }} [opts]
 */
function runCopyScript(lang, { clipboardFails = false } = {}) {
  const pre = fakeElement("pre");
  const code = fakeElement("code");
  code.innerText = "echo hi\n";
  pre.append(code);
  const timers = [];
  const written = [];
  const context = {
    document: {
      documentElement: { lang: lang ?? "" },
      querySelectorAll: (sel) => (sel === "main pre > code" ? [code] : []),
      createElement: fakeElement,
    },
    navigator: {
      clipboard: {
        writeText: async (text) => {
          if (clipboardFails) throw new Error("denied");
          written.push(text);
        },
      },
    },
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  };
  vm.runInNewContext(COPY_SCRIPT, context);
  const box = pre.parentElement;
  const button = box?.children.find((c) => c.tag === "button");
  return { pre, box, button, timers, written };
}

/**
 * THEME_SCRIPT を動かす。
 * @param {string | undefined} lang
 * @param {{ head?: boolean, differs?: boolean, osDark?: boolean, saved?: string }} [opts]
 */
function runThemeScript(lang, { head = true, differs = true, osDark = false, saved } = {}) {
  const root = { lang: lang ?? "", dataset: saved ? { theme: saved } : {} };
  const navHead = head ? fakeElement("div") : null;
  const navLabel = fakeElement("span");
  if (navHead) {
    navHead.append(navLabel);
    navHead.querySelector = (sel) => (sel === ".tsuzuri-nav-label" ? navLabel : null);
  }
  const stored = {};
  const mediaListeners = [];
  const body = {};
  const context = {
    document: {
      documentElement: root,
      body,
      querySelector: (sel) => (sel === ".tsuzuri-nav-head" ? navHead : null),
      createElement: fakeElement,
    },
    window: {
      matchMedia: () => ({ matches: osDark, addEventListener: (_t, fn) => mediaListeners.push(fn) }),
    },
    getComputedStyle: (el) => {
      assert.equal(el, body);
      const dark = differs && root.dataset.theme === "dark";
      return { backgroundColor: dark ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)", backgroundImage: "none" };
    },
    localStorage: {
      setItem: (k, v) => (stored[k] = v),
    },
  };
  vm.runInNewContext(THEME_SCRIPT, context);
  const button = navHead?.children.find((c) => c.tag === "button");
  return { root, navHead, navLabel, button, stored };
}

// ---------- tsuzuri-copy.js ----------

describe("COPY_SCRIPT(tsuzuri-copy.js)", () => {
  for (const lang of JA_LANGS) {
    test(`<html lang="${lang}"> は日本語の文言`, async () => {
      const { button, timers, written } = runCopyScript(lang);
      assert.equal(button.textContent, "コピー");
      await button.dispatch("click");
      assert.deepEqual(written, ["echo hi"]); // 最後の改行は除いてコピーする
      assert.equal(button.textContent, "コピーしました");
      assert.equal(timers.length, 1);
      assert.equal(timers[0].ms, 2000);
      timers[0].fn();
      assert.equal(button.textContent, "コピー");
    });
  }

  for (const lang of EN_LANGS) {
    test(`<html lang="${lang ?? "(無し)"}"> は英語の文言`, async () => {
      const { button, timers } = runCopyScript(lang);
      assert.equal(button.textContent, "Copy");
      await button.dispatch("click");
      assert.equal(button.textContent, "Copied");
      timers[0].fn();
      assert.equal(button.textContent, "Copy");
    });
  }

  test("コピーに失敗したときの文言(ja・en)", async () => {
    const ja = runCopyScript("ja", { clipboardFails: true });
    await ja.button.dispatch("click");
    assert.equal(ja.button.textContent, "コピーできませんでした");
    ja.timers[0].fn();
    assert.equal(ja.button.textContent, "コピー");

    const en = runCopyScript("fr", { clipboardFails: true });
    await en.button.dispatch("click");
    assert.equal(en.button.textContent, "Copy failed");
  });

  test("コードブロックを枠で包み、その中にボタンを置く(今までと同じ形)", () => {
    const { pre, box, button } = runCopyScript("ja");
    assert.equal(box.className, "tsuzuri-code");
    assert.deepEqual(pre.beforeNodes, [box]);
    assert.deepEqual(box.children, [pre, button]);
    assert.equal(button.type, "button");
    assert.equal(button.className, "tsuzuri-copy");
    assert.equal(button.attrs["aria-live"], "polite");
  });
});

// ---------- tsuzuri-carousel.js ----------

/**
 * CAROUSEL_SCRIPT を動かす。画像は count 枚(幅 100、間隔 10 で並ぶ)。
 * @param {string | undefined} lang
 * @param {number} count
 */
function runCarouselScript(lang, count) {
  const carousel = fakeElement("div");
  carousel.scrollLeft = 0;
  const imgs = Array.from({ length: count }, (_, i) => ({ offsetLeft: 50 + i * 110 }));
  carousel.querySelectorAll = (sel) => (sel === "img" ? imgs : []);
  carousel.scrolledTo = [];
  carousel.scrollTo = ({ left }) => {
    carousel.scrolledTo.push(left);
    carousel.scrollLeft = left;
  };
  carousel.after = (node) => (carousel.afterNode = node);
  const resizeListeners = [];
  const context = {
    document: {
      documentElement: { lang: lang ?? "" },
      querySelectorAll: (sel) => (sel === "main .tsuzuri-carousel" ? [carousel] : []),
      createElement: fakeElement,
    },
    window: { addEventListener: (_t, fn) => resizeListeners.push(fn) },
  };
  vm.runInNewContext(CAROUSEL_SCRIPT, context);
  const nav = carousel.afterNode;
  const [prev, dots, countEl, next] = nav?.children ?? [];
  const scrollTo = (left) => {
    carousel.scrollLeft = left;
    return carousel.dispatch("scroll");
  };
  return { carousel, nav, prev, dots, countEl, next, scrollTo, resizeListeners };
}

describe("CAROUSEL_SCRIPT(tsuzuri-carousel.js)", () => {
  test("画像が2枚: 矢印・ドット2つ・「1 / 2」を、カルーセルの次に置く", () => {
    const { carousel, nav, prev, dots, countEl, next } = runCarouselScript("en", 2);
    assert.equal(nav.className, "tsuzuri-carousel-nav");
    assert.equal(carousel.attrs.tabindex, "0");
    assert.equal(prev.className, "tsuzuri-carousel-prev");
    assert.equal(next.className, "tsuzuri-carousel-next");
    assert.equal(prev.type, "button");
    assert.equal(dots.children.length, 2);
    assert.equal(countEl.textContent, "1 / 2");
    assert.equal(countEl.attrs["aria-live"], "polite");
    assert.equal(prev.disabled, true);
    assert.equal(next.disabled, false);
    assert.equal(dots.children[0].attrs["aria-current"], "true");
    assert.equal(dots.children[1].attrs["aria-current"], undefined);
  });

  test("画像が1枚でもナビを出す(1 / 1、矢印は両方押せない、ドットは1つ)", () => {
    const { prev, dots, countEl, next } = runCarouselScript("en", 1);
    assert.equal(countEl.textContent, "1 / 1");
    assert.equal(prev.disabled, true);
    assert.equal(next.disabled, true);
    assert.equal(dots.children.length, 1);
  });

  test("画像が0枚なら何も作らない", () => {
    const { nav } = runCarouselScript("en", 0);
    assert.equal(nav, undefined);
  });

  test("矢印で隣の画像の位置へスクロールし、スクロールに合わせて表示が変わる", async () => {
    const { carousel, prev, dots, countEl, next, scrollTo } = runCarouselScript("en", 3);
    await next.dispatch("click");
    assert.deepEqual(carousel.scrolledTo, [110]);
    await scrollTo(110);
    assert.equal(countEl.textContent, "2 / 3");
    assert.equal(prev.disabled, false);
    assert.equal(next.disabled, false);
    assert.equal(dots.children[1].attrs["aria-current"], "true");
    assert.equal(dots.children[0].attrs["aria-current"], undefined);
    await scrollTo(220);
    assert.equal(countEl.textContent, "3 / 3");
    assert.equal(next.disabled, true);
    await prev.dispatch("click");
    assert.deepEqual(carousel.scrolledTo, [110, 110]);
  });

  test("スクロール量が画像の位置の間にあるときは、近いほうの画像", async () => {
    const { countEl, scrollTo } = runCarouselScript("en", 3);
    await scrollTo(50);
    assert.equal(countEl.textContent, "1 / 3");
    await scrollTo(160);
    assert.equal(countEl.textContent, "2 / 3");
  });

  test("ドットを押すと、その画像へスクロールする", async () => {
    const { carousel, dots } = runCarouselScript("en", 3);
    await dots.children[2].dispatch("click");
    assert.deepEqual(carousel.scrolledTo, [220]);
  });

  test("ラベルは <html lang> に合わせる(ja は日本語、それ以外は英語)", () => {
    const ja = runCarouselScript("ja", 2);
    assert.equal(ja.prev.attrs["aria-label"], "前の画像");
    assert.equal(ja.next.attrs["aria-label"], "次の画像");
    assert.equal(ja.dots.children[1].attrs["aria-label"], "2枚目の画像へ");
    const en = runCarouselScript("fr", 2);
    assert.equal(en.prev.attrs["aria-label"], "Previous image");
    assert.equal(en.next.attrs["aria-label"], "Next image");
    assert.equal(en.dots.children[1].attrs["aria-label"], "Go to image 2");
  });
});

// ---------- tsuzuri-theme.js ----------

describe("THEME_SCRIPT(tsuzuri-theme.js)", () => {
  for (const lang of JA_LANGS) {
    test(`<html lang="${lang}"> は日本語の文言`, async () => {
      const { button, root, stored } = runThemeScript(lang);
      assert.equal(button.textContent, "☾");
      assert.equal(button.attrs["aria-label"], "ダーク表示に切り替える");
      assert.equal(button.title, "ダーク表示に切り替える");
      await button.dispatch("click");
      assert.equal(root.dataset.theme, "dark");
      assert.equal(stored["tsuzuri-theme"], "dark");
      assert.equal(button.textContent, "☀");
      assert.equal(button.attrs["aria-label"], "ライト表示に切り替える");
      assert.equal(button.title, "ライト表示に切り替える");
    });
  }

  for (const lang of EN_LANGS) {
    test(`<html lang="${lang ?? "(無し)"}"> は英語の文言`, async () => {
      const { button } = runThemeScript(lang);
      assert.equal(button.attrs["aria-label"], "Switch to dark mode");
      assert.equal(button.title, "Switch to dark mode");
      await button.dispatch("click");
      assert.equal(button.attrs["aria-label"], "Switch to light mode");
      assert.equal(button.title, "Switch to light mode");
    });
  }

  test("OS がダーク表示なら、最初からライトへの切り替えの文言", () => {
    assert.equal(runThemeScript("ja", { osDark: true }).button.attrs["aria-label"], "ライト表示に切り替える");
    assert.equal(runThemeScript("en", { osDark: true }).button.attrs["aria-label"], "Switch to light mode");
  });

  test("ボタンはナビの見出しのラベルの前に置き、選んでいた表示を元に戻す", () => {
    const { navHead, navLabel, button, root } = runThemeScript("ja", { saved: "dark" });
    assert.deepEqual(navHead.children, [button, navLabel]);
    assert.equal(button.className, "tsuzuri-theme-toggle");
    assert.equal(root.dataset.theme, "dark");
    assert.equal(button.attrs["aria-label"], "ライト表示に切り替える");
  });

  test("ライト/ダークの違いが無いテーマ・ナビが無いページではボタンを出さない", () => {
    const flat = runThemeScript("ja", { differs: false });
    assert.equal(flat.button, undefined);
    assert.deepEqual(flat.root.dataset, {}); // 確かめるために切り替えた表示は元に戻す
    assert.equal(runThemeScript("en", { head: false }).button, undefined);
  });
});
