/**
 * copy-button.mjs
 *
 * コードブロックの右上に「コピー」ボタンを付けるための小さなスクリプト(tsuzuri-copy.js として出力する)。
 * コードブロックがあるページだけが読み込む。ボタンの文言はページの言語(<html lang>)で日本語・英語を切り替える。
 * JavaScript が動かない環境ではボタンが出ないだけで、コードはそのまま読める。
 *
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため(search.mjs と同じ)。
 */

export const COPY_SCRIPT_NAME = "tsuzuri-copy.js";

export const COPY_SCRIPT = `(() => {
  const ja = (document.documentElement.lang || "").toLowerCase().startsWith("ja");
  const label = ja ? "コピー" : "Copy";
  const done = ja ? "コピーしました" : "Copied";
  const failed = ja ? "コピーできませんでした" : "Copy failed";
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
