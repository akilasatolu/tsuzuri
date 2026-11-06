/**
 * copy-button.mjs
 *
 * コードブロックの右の列に、アイコンだけのコピーボタンを付けるための小さなスクリプト(tzr-copy.js として出力する)。
 * コードブロックがあるページだけが読み込む。ボタンの文字(読み上げ用。見た目は base.css でアイコンにする)は、
 * ページの言語(<html lang>)で i18n.mjs の表から選ぶ(表に無い言語は英語)。
 * JavaScript が動かない環境ではボタンが出ないだけで、コードはそのまま読める。
 *
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため(search.mjs と同じ)。
 */

import { runtimeStrings, RUNTIME_PICK_SOURCE } from "./i18n.mjs";

export const COPY_SCRIPT_NAME = "tzr-copy.js";

// スクリプトに埋め込む文言の表(言語ごとに copy・copied・copyFailed だけ)
const STRINGS = JSON.stringify(runtimeStrings(["copy", "copied", "copyFailed"]));

export const COPY_SCRIPT = `(() => {
  const S = ${STRINGS};
  const s = S[(${RUNTIME_PICK_SOURCE})(S, document.documentElement.lang)];
  const label = s.copy;
  const done = s.copied;
  const failed = s.copyFailed;
  for (const code of document.querySelectorAll("main pre > code")) {
    const pre = code.parentElement;
    // コードブロックを枠(tzr-code)で包み、ボタンは pre の中(右の余白の列)に置く。コードは code の中で横にスクロールするので、
    // ボタンは流れず、コードにも重ならない(見た目は base.css)
    const box = document.createElement("div");
    box.className = "tzr-code";
    pre.before(box);
    box.append(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tzr-copy";
    button.textContent = label;
    button.setAttribute("aria-live", "polite");
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.innerText.replace(/\\n$/, ""));
        button.textContent = done;
        button.setAttribute("data-state", "copied");
      } catch {
        button.textContent = failed;
        button.setAttribute("data-state", "failed");
      }
      setTimeout(() => {
        button.textContent = label;
        button.removeAttribute("data-state");
      }, 2000);
    });
    pre.append(button);
  }
})();
`;
