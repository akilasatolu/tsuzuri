/**
 * theme-toggle.mjs
 *
 * ライト/ダーク表示の切り替え(NAV_ENABLED=true のとき、ナビの見出しの横にボタンを置く)。
 *
 *   - THEME_HEAD_SCRIPT: <head> に入れる短いスクリプト。前に選んだ表示(localStorage)を、ページが
 *     表示される前に <html data-theme="light|dark"> として反映する(一瞬だけ違う色で表示されるのを防ぐ)。
 *   - THEME_SCRIPT: tsuzuri-theme.js として出力する。ボタンを作り、押すと表示を切り替えて覚えておく。
 *     テーマにライト/ダークの違いが無い場合(墨・none など)は、ボタンを出さない。
 *
 * 選んでいないときは、これまでどおり OS の設定(prefers-color-scheme)に従う。
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため(search.mjs と同じ)。
 */

export const THEME_SCRIPT_NAME = "tsuzuri-theme.js";
const STORAGE_KEY = "tsuzuri-theme";

export const THEME_HEAD_SCRIPT = `<script>try{const t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch{}</script>`;

export const THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  const head = document.querySelector(".tsuzuri-nav-head");
  if (!head) return;
  const ja = (root.lang || "").toLowerCase().startsWith("ja");
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.dataset.theme || (media.matches ? "dark" : "light");
  // テーマにライト/ダークの違いがあるかを、実際に切り替えて背景色を比べて確かめる
  const saved = root.dataset.theme;
  const bgOf = (mode) => {
    root.dataset.theme = mode;
    return getComputedStyle(document.body).backgroundColor;
  };
  const differs = bgOf("light") !== bgOf("dark");
  if (saved) root.dataset.theme = saved;
  else delete root.dataset.theme;
  if (!differs) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tsuzuri-theme-toggle";
  const render = () => {
    const dark = current() === "dark";
    button.textContent = dark ? "☀" : "☾";
    const label = dark
      ? ja ? "ライト表示に切り替える" : "Switch to light mode"
      : ja ? "ダーク表示に切り替える" : "Switch to dark mode";
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("${STORAGE_KEY}", next);
    } catch {
      // 保存できなくても、このページでは切り替わる
    }
    render();
  });
  media.addEventListener("change", render);
  render();
  const label = head.querySelector(".tsuzuri-nav-label");
  head.insertBefore(button, label);
})();
`;
