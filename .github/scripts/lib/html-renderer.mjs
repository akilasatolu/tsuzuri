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
 *   renderLangSwitch  — 新規。多言語サイトの言語切り替えボタン(JavaScript を使わない普通のリンク)。
 */

import { isExternal, toSiteAbsHref, pageHref, mapSrcsetUrls, SRCSET_ATTR } from "./path-utils.mjs";
import { uiStrings, formatUi, languageName } from "./i18n.mjs";

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
 * @param {string} [navLabel] - <nav> の aria-label
 * @param {{ hrefFor?: (rel: string) => string, langSwitchHtml?: string }} [opts]
 *   - hrefFor: ページへのリンク先の組み立て(省略時は pageHref(rel, basePath))
 *   - langSwitchHtml: 言語切り替えボタンのHTML。見出し(サイト名)と「メニュー」ラベルの間に入れる
 *     (ライト/ダーク切り替えは「メニュー」ラベルの手前に差し込まれるので、並びは サイト名・言語・☾・メニュー)
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
  { hrefFor = (rel) => pageHref(rel, basePath), langSwitchHtml = "" } = {},
) {
  // ディレクトリは <details> で折りたためるようにする(JavaScript は不要)。
  // どのページを見ていても全ページへのリンクが見えるよう、最初はすべて開いておく。
  function renderNode(node, depth) {
    if (node.type === "dir") {
      return `<li><details open><summary>${escapeHtml(node.name)}</summary>${renderList(node.children, depth + 1)}</details></li>`;
    }
    const href = hrefFor(node.rel);
    const currentAttr = node.rel === currentRel ? ' aria-current="page"' : "";
    return `<li><a href="${escapeHtml(href)}"${currentAttr}>${escapeHtml(node.title)}</a></li>`;
  }

  function renderList(nodes, depth = 0) {
    return `<ul>${nodes.map((n) => renderNode(n, depth)).join("")}</ul>`;
  }

  const heading = siteName ? `<p>${escapeHtml(siteName)}</p>` : "";
  const toggle =
    `<input type="checkbox" id="tsuzuri-nav-toggle" class="tsuzuri-nav-toggle">` +
    `<div class="tsuzuri-nav-head">${heading}${langSwitchHtml}` +
    `<label for="tsuzuri-nav-toggle" class="tsuzuri-nav-label">${escapeHtml(menuLabel)}</label></div>`;
  const searchHtml = search
    ? `<div class="tsuzuri-search" data-index="${escapeHtml(search.indexUrl)}"` +
      ` data-placeholder="${escapeHtml(search.placeholder)}" data-empty="${escapeHtml(search.empty)}"></div>` +
      `<script src="${escapeHtml(search.scriptUrl)}" defer></script>`
    : "";
  return `<nav aria-label="${escapeHtml(navLabel)}">${toggle}${searchHtml}${renderList(tree.children)}</nav>`;
}

/**
 * 言語切り替えボタンのHTMLを構築する(JavaScript は使わない)。
 * - 今の言語以外の切り替え先(href が空でないもの)が1つ: その言語へのリンク1つ
 * - 2つ以上: <details> のメニュー(押すと下に一覧が開く)。一覧は entries の順で、今の言語も含め aria-current を付ける
 * - 0: ""(ボタンを出さない)
 * 翻訳が無くその言語のトップへ飛ぶ項目(untranslated)には data-untranslated と、その旨の title を付ける。
 * placement が "bar"(ナビの無いページの本文の上)なら <div class="tsuzuri-lang-bar"> で包む。
 * 見た目は base.css の「言語の切り替え」のかたまり。
 *
 * @param {{
 *   current: string,
 *   entries: Array<{ tag: string, href: string, untranslated: boolean }>, // 全言語(languages の順。今の言語を含む)
 *   strings: { langMenu: string, langSwitchTo: string, langUntranslated: string }, // 今のページの言語の文言
 *   placement: "nav" | "bar",
 * }} opts
 * @returns {string}
 */
export function renderLangSwitch({ current, entries, strings, placement }) {
  const targets = entries.filter((e) => e.tag !== current && e.href);
  if (targets.length === 0) return "";
  const titleOf = (e) =>
    formatUi(e.untranslated ? strings.langUntranslated : strings.langSwitchTo, { name: languageName(e.tag) });
  let html;
  if (targets.length === 1) {
    const e = targets[0];
    html =
      `<a class="tsuzuri-lang-switch" href="${escapeHtml(e.href)}" hreflang="${escapeHtml(e.tag)}"` +
      `${e.untranslated ? " data-untranslated" : ""} title="${escapeHtml(titleOf(e))}">` +
      `<span lang="${escapeHtml(e.tag)}">${escapeHtml(languageName(e.tag))}</span></a>`;
  } else {
    const items = entries
      .filter((e) => e.tag === current || e.href)
      .map((e) => {
        const tag = escapeHtml(e.tag);
        const attrs =
          e.tag === current
            ? ' aria-current="true"'
            : e.untranslated
              ? ` data-untranslated title="${escapeHtml(titleOf(e))}"`
              : "";
        return `<li><a href="${escapeHtml(e.href)}" hreflang="${tag}" lang="${tag}"${attrs}>${escapeHtml(languageName(e.tag))}</a></li>`;
      })
      .join("");
    html =
      `<details class="tsuzuri-lang-menu"><summary class="tsuzuri-lang-switch" title="${escapeHtml(strings.langMenu)}">` +
      `<span lang="${escapeHtml(current)}">${escapeHtml(languageName(current))}</span></summary><ul>${items}</ul></details>`;
  }
  return placement === "bar" ? `<div class="tsuzuri-lang-bar">${html}</div>` : html;
}

/**
 * 本文末尾の「前のページ/次のページ」リンク(ページャー)のHTMLを構築する。
 * 前後どちらも無ければ空文字を返す。
 *
 * @param {{ rel: string, title: string } | null} prev
 * @param {{ rel: string, title: string } | null} next
 * @param {string} basePath
 * @param {{ prev: string, next: string, nav: string }} [labels]
 * @param {{ hrefFor?: (rel: string) => string }} [opts] - hrefFor: リンク先の組み立て(省略時は pageHref(rel, basePath))
 * @returns {string}
 */
export function renderPager(
  prev,
  next,
  basePath,
  labels = { prev: "前のページ", next: "次のページ", nav: "前後のページ" },
  { hrefFor = (rel) => pageHref(rel, basePath) } = {},
) {
  if (!prev && !next) return "";
  const link = (page, rel, label) =>
    `<a class="tsuzuri-pager-${rel}" rel="${rel}" href="${escapeHtml(hrefFor(page.rel))}">` +
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

/**
 * 引用ブロックの中身(レンダリング済みHTML)が GitHub の注意書き(先頭が [!NOTE] 等)なら、
 * 種類ごとの枠のHTMLを返す。注意書きでなければ null を返す(呼び出し側で通常の引用にする)。
 *
 * @param {string} innerHtml - 引用ブロックの中身のHTML
 * @param {boolean | Record<string, string>} [jaOrLabels] - 見出しの文言。
 *   真偽値なら見出しを日本語にするか(true=日本語・false=英語)。
 *   オブジェクトなら種類ごとの見出し({ note, tip, important, warning, caution }。i18n.mjs の alerts)
 * @returns {string | null}
 */
export function renderAlert(innerHtml, jaOrLabels = true) {
  const m = innerHtml.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:<br>)?\n?/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const labels =
    jaOrLabels && typeof jaOrLabels === "object" ? jaOrLabels : uiStrings(jaOrLabels ? "ja" : "en").alerts;
  const title = labels[type] ?? uiStrings("en").alerts[type]; // 渡された表にその種類が無ければ英語
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
 *   alternates?: Array<{ hreflang: string, href: string }>,
 * }} opts
 * canonicalUrl があれば、canonical と同じ値を og:url としても出力する。
 * alternates が空でなければ、canonical の後に <link rel="alternate" hreflang="…" href="…"> を渡した順に出力する。
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
  alternates = [],
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

  for (const { hreflang, href } of alternates) {
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${escapeHtml(href)}">`);
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
 * ページの言語が日本語(ja・ja-JP など)なら日本語、それ以外は英語にする(文言は i18n.mjs の notFound)。
 * 「/」へのリンクはビルド時にサイトのトップURL(basePath付き)に書き換えられる。
 *
 * sections を渡すと(多言語のサイト用)、言語ごとに <div lang="…"> で包んだ見出し・本文・戻るリンクを
 * 渡した順に並べる。frontmatter の title は lang の文言。
 * homeHref は Markdown に書くリンク先(`/` や `/en/`)で、basePath は描画時のリンクの書き換えで付く
 * (この関数では付けない)。
 *
 * @param {string} lang
 * @param {{ sections?: Array<{ tag: string, homeHref: string }> }} [opts]
 * @returns {string}
 */
export function defaultNotFoundMarkdown(lang = "ja", { sections } = {}) {
  const { title, body, back } = uiStrings(lang).notFound;
  if (!sections) {
    return ["---", `title: ${title}`, "---", "", `# ${title}`, "", body, "", `[${back}](/)`, ""].join("\n");
  }
  const lines = ["---", `title: ${title}`, "---", ""];
  for (const { tag, homeHref } of sections) {
    const s = uiStrings(tag).notFound;
    // <div> の直後・直前に空行を置き、中身が Markdown として描画されるようにする
    lines.push(`<div lang="${escapeHtml(tag)}">`, "", `# ${s.title}`, "", s.body, "", `[${s.back}](${homeHref})`, "", "</div>", "");
  }
  return lines.join("\n");
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
  return content
    .replace(
      /(<(?:a|img|video|audio|source)\b[^>]*?\s(?:src|href)=["'])([^"']+)(["'])/gi,
      (whole, pre, href, post) => {
        if (isExternal(href) || href.startsWith("#")) return whole;
        return pre + hrefFor(fromRel, href) + post;
      }
    )
    .replace(SRCSET_ATTR, (whole, pre, double, single) => {
      const quote = double !== undefined ? '"' : "'";
      const value = double ?? single;
      // 候補ごとに、外部・#始まり・data: 以外を書き換える。属性を壊さないよう、書き換えた URL の ' は %27 にする
      const rewritten = mapSrcsetUrls(value, (url) => {
        if (!url || isExternal(url) || url.startsWith("#")) return url;
        return hrefFor(fromRel, url).replaceAll("'", "%27");
      });
      return pre + quote + rewritten + quote;
    });
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
 *   skipLabel?: string,      // 「本文へスキップ」の文言(省略時は lang の文言)
 *   langBarHtml?: string,    // 本文の上の言語切り替え欄。空でなければ <main…> の直後に入れる
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
  lang = "en",
  navHtml = "",
  metaTagsHtml = "",
  skipLabel = uiStrings(lang).skip,
  langBarHtml = "",
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
${langBarHtml ? langBarHtml + "\n" : ""}${body}
</main>
</body>
</html>
`;
}
