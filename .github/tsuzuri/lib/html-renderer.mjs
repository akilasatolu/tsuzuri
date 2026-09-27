/**
 * html-renderer.mjs
 *
 * 実際のHTMLページを組み立てる部分を担当するモジュール。
 *
 * 既存 build-docs.mjs (旧212〜287行目相当) からロジック変更なしで移動したもの:
 *   escapeHtml
 *
 * 仕様変更・新規追加したもの:
 *   renderTitle       — metaTitle(frontmatterの title)を最優先する第3引数を追加。
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

import { isExternal, toSiteAbsHref } from "./path-utils.mjs";

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
 * ページタイトルを決定する。
 * 優先順位: metaTitle(frontmatterのtitle) > 本文先頭のh1見出し > fallback
 *
 * @param {string} content
 * @param {string} fallback
 * @param {string} [metaTitle]
 * @returns {string}
 */
export function renderTitle(content, fallback, metaTitle) {
  if (typeof metaTitle === "string" && metaTitle !== "") {
    return metaTitle;
  }
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
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
export function renderNav(tree, currentRel, basePath, siteName, menuLabel = "メニュー", search = null) {
  function renderNode(node) {
    if (node.type === "dir") {
      return `<li><span>${escapeHtml(node.name)}</span>${renderList(node.children)}</li>`;
    }
    const href = toSiteAbsHref("", node.rel, basePath);
    const currentAttr = node.rel === currentRel ? ' aria-current="page"' : "";
    return `<li><a href="${href}"${currentAttr}>${escapeHtml(node.title)}</a></li>`;
  }

  function renderList(nodes) {
    return `<ul>${nodes.map(renderNode).join("")}</ul>`;
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
  return `<nav aria-label="サイト内ページ">${toggle}${searchHtml}${renderList(tree.children)}</nav>`;
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
    `<a class="tsuzuri-pager-${rel}" rel="${rel}" href="${toSiteAbsHref("", page.rel, basePath)}">` +
    `<span>${escapeHtml(label)}</span>${escapeHtml(page.title)}</a>`;
  return (
    `<nav class="tsuzuri-pager" aria-label="${escapeHtml(labels.nav)}">` +
    (prev ? link(prev, "prev", labels.prev) : "") +
    (next ? link(next, "next", labels.next) : "") +
    `</nav>`
  );
}

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

// Markdown 記法ではなく生の HTML で書かれた <img src="..">/<a href=".."> は
// marked のレンダラーを経由しないため、Markdown ソースの時点で
// 絶対パスに書き換えておく
export function preprocessRawHtmlPaths(content, fromRel, basePath) {
  return content.replace(
    /(<(?:img|a)[^>]+(?:src|href)=["'])([^"']+)(["'])/g,
    (whole, pre, href, post) => {
      if (isExternal(href) || href.startsWith("#")) return whole;
      return pre + toSiteAbsHref(fromRel, href, basePath) + post;
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
export function pageTemplate({
  title,
  body,
  baseCss = "",
  themeCss = "",
  customCss = "",
  styleFileRel,
  lang = "ja",
  navHtml = "",
  metaTagsHtml = "",
}) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${metaTagsHtml ? metaTagsHtml + "\n" : ""}<style>
${baseCss}${themeCss}${customCss ? `/* ---- Custom style: ${styleFileRel} ---- */\n${customCss}` : ""}
</style>
</head>
<body>
${navHtml ? navHtml + "\n" : ""}<main>
${body}
</main>
</body>
</html>
`;
}
