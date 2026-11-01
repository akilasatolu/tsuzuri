/**
 * carousel.mjs
 *
 * 画像のカルーセル(<div class="tsuzuri-carousel"> の中に <img> を並べたもの)に、ドット(今の画像の
 * 表示と、押すと切り替わるボタン)を付けるための小さなスクリプト(tsuzuri-carousel.js として出力する)。
 * 矢印や「1 / 2」の枚数は出さない。画像は横にスワイプ・スクロールしても切り替えられる。
 * カルーセルがタイル(<div class="tsuzuri-tile">)の中にあるときは、画像を押すとそのタイルの見出しのリンクを開く
 * (スワイプやドットの操作では開かない)。
 * カルーセルがあるページだけが読み込む。ラベルはページの言語(<html lang>)で i18n.mjs の表から選ぶ
 * (表に無い言語は英語)。画像が1枚のときは、ドットを出さない。
 * JavaScript が動かない環境では何も足されないだけで、今までどおり横にスクロールして見られる。
 *
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため(search.mjs と同じ)。
 */

import { runtimeStrings, RUNTIME_PICK_SOURCE } from "./i18n.mjs";

export const CAROUSEL_SCRIPT_NAME = "tsuzuri-carousel.js";

// スクリプトに埋め込む文言の表(言語ごとに carouselDot だけ)
const STRINGS = JSON.stringify(runtimeStrings(["carouselDot"]));

export const CAROUSEL_SCRIPT = `(() => {
  const S = ${STRINGS};
  const s = S[(${RUNTIME_PICK_SOURCE})(S, document.documentElement.lang)];
  const el = (tag, className) => {
    const e = document.createElement(tag);
    e.className = className;
    return e;
  };
  const button = (className, label) => {
    const b = el("button", className);
    b.type = "button";
    b.setAttribute("aria-label", label);
    return b;
  };
  for (const carousel of document.querySelectorAll("main .tsuzuri-carousel")) {
    const imgs = Array.from(carousel.querySelectorAll("img"));
    if (imgs.length === 0) continue;
    carousel.setAttribute("tabindex", "0");
    // 画像の位置(いちばん左の画像を 0 としたスクロール量)
    const left = (i) => imgs[i].offsetLeft - imgs[0].offsetLeft;
    const current = () => {
      let best = 0;
      for (let i = 1; i < imgs.length; i++) {
        if (Math.abs(left(i) - carousel.scrollLeft) < Math.abs(left(best) - carousel.scrollLeft)) best = i;
      }
      return best;
    };
    const go = (i) => carousel.scrollTo({ left: left(Math.max(0, Math.min(imgs.length - 1, i))) });

    const nav = el("div", "tsuzuri-carousel-nav");
    const dots = el("span", "tsuzuri-carousel-dots");
    const dotButtons = imgs.map((_, i) => {
      const d = button("tsuzuri-carousel-dot", s.carouselDot.replace("{n}", String(i + 1)));
      d.addEventListener("click", () => go(i));
      dots.append(d);
      return d;
    });
    nav.append(dots);

    const update = () => {
      const i = current();
      dotButtons.forEach((d, k) => {
        if (k === i) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    };
    carousel.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    // タイルの中の画像を押したら、タイルの見出しのリンクを開く(スワイプは click にならない)
    const tileLink = carousel.closest(".tsuzuri-tile")?.querySelector("h3 a:not(.tsuzuri-anchor)");
    if (tileLink) carousel.addEventListener("click", () => tileLink.click());
    if (imgs.length > 1) {
      carousel.after(nav);
      update();
    }
  }
})();
`;
