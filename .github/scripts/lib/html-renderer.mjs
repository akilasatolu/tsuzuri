/**
 * html-renderer.mjs
 *
 * 実際のHTMLページを組み立てる部分を担当するモジュール。
 *
 * 既存 build-docs.mjs (旧212〜287行目相当) からロジック変更なしで移動したもの:
 *   escapeHtml
 *
 * 仕様変更・新規追加したもの:
 *   renderNav         — 新規。navEnabled=true のときのみ呼び出し側が呼ぶ。
 *                        site-tree.mjs のサイトツリー(ディレクトリ階層)をそのまま <ul> の入れ子にする。
 *   renderMetaTags    — 新規。SEO用メタタグ(description/OGP/canonical/robots/favicon/og:site_name)を生成する。
 *   pageTemplate      — シグネチャを `{ ..., customCss }` から
 *                        `{ ..., baseCss, themeCss, customCss, navHtml, metaTagsHtml }` に変更。
 *                        v1でハードコードされていた配色ブロックは削除し、
 *                        `<style>` タグ内は `baseCss + themeCss + customCss` の順で連結する
 *                        (基礎CSS→THEME→STYLE_FILE の3層カスケード)。
 *   preprocessRawHtmlPaths — basePath をモジュール内グローバル定数ではなく明示引数化。
 */

import { isExternal, toSiteAbsHref, pageHref } from "./path-utils.mjs";

/**
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * サイト内ナビゲーション(<nav>)のHTMLを構築する。
 * site-tree.mjs の `buildSiteTree` が返すディレクトリ階層をそのまま <ul> の入れ子にする。
 * ページは <li><a>(表示名は frontmatter の title、無ければファイル名)、
 * ディレクトリは <li><span>ディレクトリ名</span><ul>…</ul></li> として出力する。
 * `navEnabled=false` の場合は呼び出し側がそもそもこの関数を呼ばず navHtml="" とする
 * (=既存出力と完全一致を保証する)ため、本関数自体はnavEnabledを意識しない。
 *
 * 狭い画面ではナビを折りたためるよう、JavaScriptを使わずに開閉できるチェックボックスと
 * ラベル(「メニュー」ボタン)を出力する。開閉の見た目は base.css 側で制御する
 * (広い画面ではボタンを隠し、常にサイドバーとして表示する)。
 *
 * @param {import("./site-tree.mjs").DirNode} tree - buildSiteTree の戻り値(ルートディレクトリ)
 * @param {string} currentRel - 現在描画中のページのrel(aria-current付与判定用)
 * @param {string} basePath
 * @param {string} [siteName]
 * @param {string} [menuLabel] - 狭い画面で表示する開閉ボタンの文言
 * @param {{ indexUrl: string, scriptUrl: string, placeholder: string, empty: string } | null} [search]
 *   - サイト内検索の設定。指定すると検索欄の置き場所と検索スクリプトの読み込みを出力する
 *     (検索欄そのものはスクリプトが作るため、JavaScriptが動かない環境では何も表示されない)
 * @returns {string}
 */
export function renderNav(
  tree,
  currentRel,
  basePath,
  siteName,
  menuLabel = "メニュー",
  search = null,
  navLabel = "サイト内ページ",
) {
  // ディレクトリは <details> で折りたためるようにする(JavaScript は不要)。
  // どのページを見ていても全ページへのリンクが見えるよう、最初はすべて開いておく。
  function renderNode(node, depth) {
    if (node.type === "dir") {
      return `<li><details open><summary>${escapeHtml(node.name)}</summary>${renderList(node.children, depth + 1)}</details></li>`;
    }
    const href = pageHref(node.rel, basePath);
    const currentAttr = node.rel === currentRel ? ' aria-current="page"' : "";
    return `<li><a href="${escapeHtml(href)}"${currentAttr}>${escapeHtml(node.title)}</a></li>`;
  }

  function renderList(nodes, depth = 0) {
    return `<ul>${nodes.map((n) => renderNode(n, depth)).join("")}</ul>`;
  }

  const heading = siteName ? `<p>${escapeHtml(siteName)}</p>` : "";
  const toggle =
    `<input type="checkbox" id="tsuzuri-nav-toggle" class="tsuzuri-nav-toggle">` +
    `<div class="tsuzuri-nav-head">${heading}` +
    `<label for="tsuzuri-nav-toggle" class="tsuzuri-nav-label">${escapeHtml(menuLabel)}</label></div>`;
  const searchHtml = search
    ? `<div class="tsuzuri-search" data-index="${escapeHtml(search.indexUrl)}"` +
      ` data-placeholder="${escapeHtml(search.placeholder)}" data-empty="${escapeHtml(search.empty)}"></div>` +
      `<script src="${escapeHtml(search.scriptUrl)}" defer></script>`
    : "";
  return `<nav aria-label="${escapeHtml(navLabel)}">${toggle}${searchHtml}${renderList(tree.children)}</nav>`;
}

/**
 * 本文末尾の「前のページ/次のページ」リンク(ページャー)のHTMLを構築する。
 * 前後どちらも無ければ空文字を返す。
 *
 * @param {{ rel: string, title: string } | null} prev
 * @param {{ rel: string, title: string } | null} next
 * @param {string} basePath
 * @param {{ prev: string, next: string, nav: string }} [labels]
 * @returns {string}
 */
export function renderPager(
  prev,
  next,
  basePath,
  labels = { prev: "前のページ", next: "次のページ", nav: "前後のページ" },
) {
  if (!prev && !next) return "";
  const link = (page, rel, label) =>
    `<a class="tsuzuri-pager-${rel}" rel="${rel}" href="${escapeHtml(pageHref(page.rel, basePath))}">` +
    `<span>${escapeHtml(label)}</span>${escapeHtml(page.title)}</a>`;
  return (
    `<nav class="tsuzuri-pager" aria-label="${escapeHtml(labels.nav)}">` +
    (prev ? link(prev, "prev", labels.prev) : "") +
    (next ? link(next, "next", labels.next) : "") +
    `</nav>`
  );
}

/**
 * ページ内の目次(h2・h3 の見出しへのリンク一覧)のHTMLを構築する。
 * h3 は直前の h2 の下に入れ子にする(h2 より前にある h3 は1段目に置く)。
 *
 * @param {Array<{ depth: number, id: string, text: string }>} headings
 * @param {string} [label]
 * @returns {string}
 */
export function renderToc(headings, label = "目次") {
  const items = [];
  for (const heading of headings) {
    const link = `<a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`;
    const parent = items[items.length - 1];
    if (heading.depth === 3 && parent && parent.depth === 2) parent.children.push(link);
    else items.push({ depth: heading.depth, link, children: [] });
  }
  const list = items
    .map(
      (item) =>
        `<li>${item.link}${
          item.children.length ? `<ul>${item.children.map((c) => `<li>${c}</li>`).join("")}</ul>` : ""
        }</li>`
    )
    .join("");
  return `<nav class="tsuzuri-toc" aria-label="${escapeHtml(label)}"><p>${escapeHtml(label)}</p><ul>${list}</ul></nav>\n`;
}

// GitHub の注意書き(> [!NOTE] など)の種類と、表示する見出し(日本語/英語)
const ALERT_TYPES = {
  note: ["補足", "Note"],
  tip: ["ヒント", "Tip"],
  important: ["重要", "Important"],
  warning: ["警告", "Warning"],
  caution: ["注意", "Caution"],
};

/**
 * 引用ブロックの中身(レンダリング済みHTML)が GitHub の注意書き(先頭が [!NOTE] 等)なら、
 * 種類ごとの枠のHTMLを返す。注意書きでなければ null を返す(呼び出し側で通常の引用にする)。
 *
 * @param {string} innerHtml - 引用ブロックの中身のHTML
 * @param {boolean} [ja] - 見出しを日本語にするか
 * @returns {string | null}
 */
export function renderAlert(innerHtml, ja = true) {
  const m = innerHtml.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:<br>)?\n?/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const title = ALERT_TYPES[type][ja ? 0 : 1];
  const body = ("<p>" + innerHtml.slice(m[0].length)).replace(/^<p>\s*<\/p>\n?/, "");
  return (
    `<div class="markdown-alert markdown-alert-${type}">` +
    `<p class="markdown-alert-title">${escapeHtml(title)}</p>\n${body}</div>\n`
  );
}

// mermaid の図を描画するスクリプト。```mermaid のコードブロックがあるページにだけ入れる。
// 閲覧時に CDN(jsDelivr)から mermaid を読み込み、<pre class="mermaid"> を図に変換する。
// ページの背景が暗い(テーマ月・灯・ダークモード)ときは、図も暗い配色にする。
//
// 読み込むファイルは integrity(SRI)でハッシュを確かめる。CDN で中身が差し替えられていたら、
// ブラウザが読み込みを止める(図はコードのまま表示される)。ハッシュを確かめられるよう、分割されていない
// 1ファイルの版(dist/mermaid.min.js)を使う。
// MERMAID_VERSION を変えたら、`node scripts/mermaid-integrity.mjs` で MERMAID_INTEGRITY も更新する
// (CI の verify-cdn ジョブが、実際のファイルのハッシュと一致するか確認する)。
export const MERMAID_VERSION = "12.0.0";
export const MERMAID_INTEGRITY = "sha384-xzghz1GQ5u9HCpVskeDPqMsdogD1yvuMQbEK53+wi+G70+6J1AG0L2cfi9PHjDWI";
export const MERMAID_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
export const MERMAID_SCRIPT = `<script src="${MERMAID_URL}" integrity="${MERMAID_INTEGRITY}" crossorigin="anonymous"></script>
<script>
if (window.mermaid) {
  const bg = getComputedStyle(document.body).backgroundColor.match(/\\d+/g) || [255, 255, 255];
  const dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 128;
  mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
  mermaid.run();
}
</script>
`;

/**
 * SEO用メタタグ(description/OGP/canonical/robots/favicon)のHTMLを構築する。
 *
 * @param {{
 *   description?: string,
 *   ogTitle: string,
 *   ogImage?: string,
 *   ogType?: string,
 *   canonicalUrl?: string,
 *   noindex?: boolean,
 *   faviconHref?: string,
 *   siteName?: string,
 * }} opts
 * canonicalUrl があれば、canonical と同じ値を og:url としても出力する。
 * @returns {string}
 */
export function renderMetaTags({
  description,
  ogTitle,
  ogImage,
  ogType = "website",
  canonicalUrl,
  noindex,
  faviconHref,
  siteName,
} = {}) {
  const tags = [];

  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}">`);
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
  }

  tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}">`);
  tags.push(`<meta property="og:type" content="${escapeHtml(ogType)}">`);

  if (siteName) {
    tags.push(`<meta property="og:site_name" content="${escapeHtml(siteName)}">`);
  }

  if (ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}">`);
  }

  if (canonicalUrl) {
    tags.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`);
    tags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
  }

  if (noindex === true) {
    tags.push(`<meta name="robots" content="noindex">`);
  }

  if (faviconHref) {
    tags.push(`<link rel="icon" href="${escapeHtml(faviconHref)}">`);
  }

  return tags.join("\n");
}

/**
 * リポジトリ直下に 404.md が無い場合に使う、404ページ(404.html)の既定の内容(Markdown)。
 * LANG が日本語(ja…)なら日本語、それ以外は英語にする。
 * 「/」へのリンクはビルド時にサイトのトップURL(basePath付き)に書き換えられる。
 *
 * @param {string} lang
 * @returns {string}
 */
export function defaultNotFoundMarkdown(lang = "ja") {
  if (String(lang).toLowerCase().startsWith("ja")) {
    return [
      "---",
      "title: ページが見つかりません",
      "---",
      "",
      "# ページが見つかりません",
      "",
      "お探しのページは、移動または削除されたか、URLが間違っている可能性があります。",
      "",
      "[トップページへ戻る](/)",
      "",
    ].join("\n");
  }
  return [
    "---",
    "title: Page not found",
    "---",
    "",
    "# Page not found",
    "",
    "The page you are looking for may have been moved or deleted, or the URL may be incorrect.",
    "",
    "[Back to the top page](/)",
    "",
  ].join("\n");
}

// Markdown 記法ではなく生の HTML で書かれた <a href>・<img src>・<video src> などは
// marked のレンダラーを経由しないため、Markdown ソースの時点で
// 絶対パスに書き換えておく
//
// build-docs.mjs は marked の html トークン(renderer.html)の中身にだけ適用する。
// そのため、コードブロック・インラインコードの中に書いたHTMLの例は書き換えない。
// hrefFor を渡すと、URLの組み立てをそれに任せる(ディレクトリ・GitHubへのリンクの置き換え用)。
export function preprocessRawHtmlPaths(
  content,
  fromRel,
  basePath,
  hrefFor = (from, href) => toSiteAbsHref(from, href, basePath),
) {
  return content.replace(
    /(<(?:a|img|video|audio|source)\b[^>]*?\s(?:src|href)=["'])([^"']+)(["'])/gi,
    (whole, pre, href, post) => {
      if (isExternal(href) || href.startsWith("#")) return whole;
      return pre + hrefFor(fromRel, href) + post;
    }
  );
}

/**
 * ページ全体のHTMLテンプレートを組み立てる。
 * `<style>` タグ内は `baseCss + themeCss + customCss` の順で連結し、
 * 「基礎CSS→THEME→STYLE_FILE」の3層カスケードを実現する。
 *
 * @param {{
 *   title: string,
 *   body: string,
 *   baseCss?: string,
 *   themeCss?: string,
 *   customCss?: string,
 *   styleFileRel?: string,
 *   lang?: string,
 *   navHtml?: string,
 *   metaTagsHtml?: string,
 * }} opts
 * @returns {string}
 */
// ページに適用するCSS(基礎CSS → テーマ → 独自CSS の順につなげたもの)。
// pageTemplate の <style> と、build-docs.mjs が書き出す共通のCSSファイルで同じ内容にする。
export function composeCss({ baseCss = "", themeCss = "", customCss = "", styleFileRel }) {
  return `${baseCss}${themeCss}${customCss ? `/* ---- Custom style: ${styleFileRel} ---- */\n${customCss}` : ""}`;
}

// stylesheetHref を渡すと、CSS を <style> で埋め込む代わりに、そのCSSファイルを <link> で読み込む
// (全ページで同じファイルを使うので、2ページ目以降はブラウザのキャッシュが効く)。
// headHtml は <head> の最後に入れるHTML(ライト/ダークの切り替えを表示前に反映するスクリプトなど)。
export function pageTemplate({
  title,
  body,
  baseCss = "",
  themeCss = "",
  customCss = "",
  styleFileRel,
  stylesheetHref = "",
  headHtml = "",
  lang = "ja",
  navHtml = "",
  metaTagsHtml = "",
  skipLabel = "本文へスキップ",
}) {
  // ナビがあるページだけ、先頭に「本文へスキップ」リンクを置き、<main> にその飛び先の id を付ける
  // (ナビが無いページの出力は従来と同じ)
  // (id は本文の見出しの id(例: "## Main" → "main")と重ならない名前にする)
  const skipLink = navHtml ? `<a class="tsuzuri-skip" href="#tsuzuri-main">${escapeHtml(skipLabel)}</a>\n` : "";
  const mainTag = navHtml ? `<main id="tsuzuri-main">` : "<main>";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${metaTagsHtml ? metaTagsHtml + "\n" : ""}${
    stylesheetHref
      ? `<link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">`
      : `<style>\n${composeCss({ baseCss, themeCss, customCss, styleFileRel })}\n</style>`
  }
${headHtml ? headHtml + "\n" : ""}</head>
<body>
${skipLink}${navHtml ? navHtml + "\n" : ""}${mainTag}
${body}
</main>
</body>
</html>
`;
}
