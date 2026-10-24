/**
 * copy-button.mjs
 *
 * コードブロックの右上に「コピー」ボタンを付けるための小さなスクリプト(tsuzuri-copy.js として出力する)。
 * コードブロックがあるページだけが読み込む。ボタンの文言はページの言語(<html lang>)で i18n.mjs の表から選ぶ
 * (表に無い言語は英語)。
 * JavaScript が動かない環境ではボタンが出ないだけで、コードはそのまま読める。
 *
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため(search.mjs と同じ)。
 */

import { runtimeStrings, RUNTIME_PICK_SOURCE } from "./i18n.mjs";

export const COPY_SCRIPT_NAME = "tsuzuri-copy.js";

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
    // ボタンが横スクロールで一緒に流れないよう、コードブロックを枠で包んでその右上に置く
    const box = document.createElement("div");
    box.className = "tsuzuri-code";
    pre.before(box);
    box.append(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tsuzuri-copy";
    button.textContent = label;
    button.setAttribute("aria-live", "polite");
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.innerText.replace(/\\n$/, ""));
        button.textContent = done;
      } catch {
        button.textContent = failed;
      }
      setTimeout(() => (button.textContent = label), 2000);
    });
    box.append(button);
  }
})();
`;
