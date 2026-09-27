/**
 * search.mjs
 *
 * サイト内検索(NAV_ENABLED=true のとき、ナビの上部に検索欄を出す)のためのモジュール。
 *
 *   - ビルド時: 各ページのタイトル・本文から検索用の索引(search-index.json)を作る
 *   - 閲覧時:   SEARCH_SCRIPT(tsuzuri-search.js として出力する小さなスクリプト)が、
 *               検索欄に初めてフォーカスしたときに索引を読み込み、入力に応じて結果を表示する
 *
 * スクリプトをこのモジュール内の文字列として持っているのは、init が利用者リポジトリに
 * コピーするビルドスクリプト一式(lib/*.mjs)に自動的に含めるため。
 * JavaScript が動かない環境では検索欄が表示されないだけで、ナビ自体はそのまま使える。
 */

const ENTITY_MAP = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

// 1ページあたりに索引へ入れる本文の最大文字数(索引ファイルが大きくなりすぎないように)
export const MAX_TEXT_LENGTH = 20000;

/**
 * レンダリング済みの本文HTMLから、検索用のプレーンテキストを取り出す。
 * @param {string} html
 * @returns {string}
 */
export function htmlToSearchText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a class="tsuzuri-anchor"[^>]*>#<\/a>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITY_MAP[m])
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * search-index.json の中身を組み立てる。
 * @param {Array<{ title: string, url: string, html: string }>} pages
 * @returns {Array<{ t: string, u: string, x: string }>}
 */
export function buildSearchIndex(pages) {
  return pages.map(({ title, url, html }) => ({ t: title, u: url, x: htmlToSearchText(html) }));
}

/** 閲覧時に動く検索スクリプト(tsuzuri-search.js として出力する) */
export const SEARCH_SCRIPT = `(() => {
  const root = document.querySelector(".tsuzuri-search");
  if (!root) return;
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = root.dataset.placeholder || "Search";
  input.setAttribute("aria-label", input.placeholder);
  const list = document.createElement("ul");
  list.className = "tsuzuri-search-results";
  root.append(input, list);

  let index = null;
  let loading = null;
  const load = () =>
    (loading ??= fetch(root.dataset.index)
      .then((res) => res.json())
      .then((data) => (index = data))
      .catch(() => (index = [])));

  const snippet = (text, term) => {
    const at = Math.max(0, text.toLowerCase().indexOf(term) - 30);
    const body = text.slice(at, at + 100);
    return (at > 0 ? "…" : "") + body + (text.length > at + 100 ? "…" : "");
  };

  const render = () => {
    list.replaceChildren();
    const query = input.value.trim().toLowerCase();
    if (!query || !index) return;
    const terms = query.split(/\\s+/);
    const hits = index
      .map((page) => ({ page, title: page.t.toLowerCase(), text: page.x.toLowerCase() }))
      .filter(({ title, text }) => terms.every((term) => title.includes(term) || text.includes(term)))
      .map((hit) => ({ ...hit, inTitle: terms.every((term) => hit.title.includes(term)) }))
      .sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
      .slice(0, 10);
    if (!hits.length) {
      const li = document.createElement("li");
      li.textContent = root.dataset.empty || "No results";
      list.append(li);
      return;
    }
    for (const { page } of hits) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = page.u;
      link.textContent = page.t;
      const excerpt = document.createElement("small");
      excerpt.textContent = snippet(page.x, terms[0]);
      li.append(link, excerpt);
      list.append(li);
    }
  };

  input.addEventListener("focus", load, { once: true });
  input.addEventListener("input", () => (index ? render() : load().then(render)));
})();
`;
