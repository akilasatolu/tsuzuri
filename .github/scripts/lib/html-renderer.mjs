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
 *   renderMetaTags    — 新規。SEO用メタタグ(description/OGP/canonical/robots/favicon)を生成する。
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
 * `hierarchy` をルートから深さ優先で辿り、各ページを <li><a> として出力する。
 * `navEnabled=false` の場合は呼び出し側がそもそもこの関数を呼ばず navHtml="" とする
 * (=既存出力と完全一致を保証する)ため、本関数自体はnavEnabledを意識しない。
 *
 * @param {Record<string, { parent: string|null, children: string[] }>} hierarchy
 * @param {Iterable<string>} visitedMdKeys - 実際にレンダリング対象となったページのrel一覧
 * @param {string} currentRel - 現在描画中のページのrel(aria-current付与判定用)
 * @param {string} basePath
 * @param {string} [siteName]
 * @returns {string}
 */
export function renderNav(hierarchy, visitedMdKeys, currentRel, basePath, siteName) {
  const visited = new Set(visitedMdKeys);

  const roots = Object.keys(hierarchy).filter(
    (rel) => visited.has(rel) && (hierarchy[rel]?.parent === null || hierarchy[rel]?.parent === undefined)
  );

  function renderItem(rel) {
    const href = toSiteAbsHref("", rel, basePath);
    const currentAttr = rel === currentRel ? ' aria-current="page"' : "";
    const children = (hierarchy[rel]?.children || []).filter((c) => visited.has(c));
    const childList = children.length ? renderList(children) : "";
    return `<li><a href="${href}"${currentAttr}>${escapeHtml(rel)}</a>${childList}</li>`;
  }

  function renderList(rels) {
    return `<ul>${rels.map(renderItem).join("")}</ul>`;
  }

  const heading = siteName ? `<p>${escapeHtml(siteName)}</p>` : "";
  return `<nav aria-label="サイト内ページ">${heading}${renderList(roots)}</nav>`;
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
 * }} opts
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
} = {}) {
  const tags = [];

  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}">`);
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
  }

  tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}">`);
  tags.push(`<meta property="og:type" content="${escapeHtml(ogType)}">`);

  if (ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}">`);
  }

  if (canonicalUrl) {
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
<html lang="${lang}">
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
