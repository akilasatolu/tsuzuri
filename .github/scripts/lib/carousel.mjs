/**
 * carousel.mjs
 *
 * 画像のカルーセル(<div class="tsuzuri-carousel"> の中に <img> を並べたもの)に、ドット(今の画像の
 * 表示と、押すと切り替わるボタン)を付けるための小さなスクリプト(tsuzuri-carousel.js として出力する)。
 * 矢印や「1 / 2」の枚数は出さない。画像は横にスワイプ・スクロールしても切り替えられる。
 * カルーセルがタイル(<div class="tsuzuri-tile">)の中にあるときは、画像を押すとそのタイルの見出しのリンクを開く
 * (スワイプやドットの操作では開かない)。
 * マウスでは画像をドラッグして切り替えられる(タッチはブラウザのスワイプのまま)。ドラッグしたあとの click では
 * タイルのリンクを開かない。
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

    // マウスのドラッグで切り替える(タッチはブラウザのスワイプに任せる)
    let drag = null;      // 押している間の状態 { x, scrollLeft, from }
    let dragged = false;  // 直前の操作がドラッグだったか(そのあとの click でリンクを開かない)
    if (imgs.length > 1) {
      // 吸着を戻す。前のドラッグで予約したものが、次のドラッグの最中に走ったときは戻さない(そのドラッグの終わりで予約し直す)
      const restoreSnap = () => {
        if (drag && dragged) return;
        carousel.style.scrollSnapType = "";
      };
      carousel.addEventListener("dragstart", (e) => e.preventDefault());  // 画像そのもののドラッグ(保存用)を止める
      carousel.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, scrollLeft: carousel.scrollLeft, from: current() };
        dragged = false;
      });
      carousel.addEventListener("pointermove", (e) => {
        if (!drag) return;
        if (!(e.buttons & 1)) { drag = null; return; }  // カルーセルの外で離していた(pointerup が届かなかった)
        const dx = e.clientX - drag.x;
        if (!dragged && Math.abs(dx) < 5) return;  // 少し動いただけなら、ただのクリック
        if (!dragged) {
          dragged = true;
          carousel.setPointerCapture(e.pointerId);
          carousel.classList.add("tsuzuri-carousel-dragging");
          // 指の位置にそのまま付いてくるよう、ドラッグ中は吸着とスムーズスクロールを止める
          carousel.style.scrollSnapType = "none";
          carousel.style.scrollBehavior = "auto";
        }
        carousel.scrollLeft = drag.scrollLeft - dx;
      });
      const endDrag = (e) => {
        if (!drag) return;
        const { x, from } = drag;
        drag = null;
        if (!dragged) return;
        carousel.classList.remove("tsuzuri-carousel-dragging");
        carousel.style.scrollBehavior = "";
        const dx = e.clientX - x;
        // 画像の幅の 1/5 以上動かしたら、その向きの隣へ。足りなければ元の画像へ戻す
        const threshold = imgs[0].offsetWidth / 5;
        const to = dx <= -threshold ? from + 1 : dx >= threshold ? from - 1 : from;
        const target = Math.max(0, Math.min(imgs.length - 1, to));
        // 吸着は、移動のスクロールが終わってから戻す(先に戻すと近い画像へ吸い寄せられて、移動が途中で止まる)
        if (Math.abs(carousel.scrollLeft - left(target)) < 1) restoreSnap();
        else if ("onscrollend" in window) carousel.addEventListener("scrollend", restoreSnap, { once: true });
        else setTimeout(restoreSnap, 500);
        go(target);
      };
      carousel.addEventListener("pointerup", endDrag);
      carousel.addEventListener("pointercancel", endDrag);
    }
    // タイルの中の画像を押したら、タイルの見出しのリンクを開く(スワイプは click にならない)
    const tileLink = carousel.closest(".tsuzuri-tile")?.querySelector("h3 a:not(.tsuzuri-anchor)");
    if (tileLink) carousel.addEventListener("click", () => { if (!dragged) tileLink.click(); });
    if (imgs.length > 1) {
      carousel.after(nav);
      update();
    }
  }
})();
`;
