/**
 * carousel.mjs
 *
 * 画像のカルーセル(<div class="tsuzuri-carousel"> の中に <img> を並べたもの)に、前へ・次への矢印、
 * ドット、「1 / 2」の枚数の表示を付けるための小さなスクリプト(tsuzuri-carousel.js として出力する)。
 * カルーセルがあるページだけが読み込む。ラベルはページの言語(<html lang>)で i18n.mjs の表から選ぶ
 * (表に無い言語は英語)。画像が1枚でも、同じ形のナビを出す(矢印は押せない状態)。
 * JavaScript が動かない環境では何も足されないだけで、今までどおり横にスクロールして見られる。
 *
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため(search.mjs と同じ)。
 */

import { runtimeStrings, RUNTIME_PICK_SOURCE } from "./i18n.mjs";

export const CAROUSEL_SCRIPT_NAME = "tsuzuri-carousel.js";

// スクリプトに埋め込む文言の表(言語ごとに carouselPrev・carouselNext・carouselDot だけ)
const STRINGS = JSON.stringify(runtimeStrings(["carouselPrev", "carouselNext", "carouselDot"]));

export const CAROUSEL_SCRIPT = `(() => {
  const S = ${STRINGS};
  const s = S[(${RUNTIME_PICK_SOURCE})(S, document.documentElement.lang)];
  const el = (tag, className) => {
    const e = document.createElement(tag);
    e.className = className;
    return e;
  };
  const button = (className, label, text) => {
    const b = el("button", className);
    b.type = "button";
    b.setAttribute("aria-label", label);
    if (text) b.textContent = text;
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
    const prev = button("tsuzuri-carousel-prev", s.carouselPrev, "\\u2039");
    const next = button("tsuzuri-carousel-next", s.carouselNext, "\\u203a");
    const dots = el("span", "tsuzuri-carousel-dots");
    const dotButtons = imgs.map((_, i) => {
      const d = button("tsuzuri-carousel-dot", s.carouselDot.replace("{n}", String(i + 1)));
      d.addEventListener("click", () => go(i));
      dots.append(d);
      return d;
    });
    const count = el("span", "tsuzuri-carousel-count");
    count.setAttribute("aria-live", "polite");
    prev.addEventListener("click", () => go(current() - 1));
    next.addEventListener("click", () => go(current() + 1));
    nav.append(prev);
    nav.append(dots);
    nav.append(count);
    nav.append(next);

    const update = () => {
      const i = current();
      count.textContent = (i + 1) + " / " + imgs.length;
      dotButtons.forEach((d, k) => {
        if (k === i) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
      prev.disabled = i === 0;
      next.disabled = i === imgs.length - 1;
    };
    carousel.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    carousel.after(nav);
    update();
  }
})();
`;
