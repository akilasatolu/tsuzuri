/**
 * link-extractor.mjs
 *
 * Markdown中のリンクを見つける処理を担当するモジュール。
 *
 * ページ集め(crawler.mjs)は extractLinks を使う。extractLinks は、ページの描画と同じ marked の
 * 解析結果(トークン)からリンクを集めるため、参照リンク([x][ref])・画像を囲んだリンク(バッジ)・
 * 単一引用符のタイトル・山括弧(<a b.md>)・括弧を含むパスなど、描画でリンクになるものは
 * すべてたどる。コードブロック・インラインコードの中の「見せかけのリンク」は、marked が
 * コードとして扱うので自然に除外される(入れ子のバッククォートも marked の規則どおりに扱われる)。
 * 生のHTML(<a href>・<img src>・<source srcset> など)は、HTMLのトークンに extractRawHtmlLinks を適用して拾う。
 */

import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import { htmlToText } from "./slugger.mjs";
import { emojiExtension } from "./emoji.mjs";
import { mapSrcsetUrls, SRCSET_ATTR } from "./path-utils.mjs";

/**
 * Markdown 本文から、リンク・画像・生のHTMLの href/src を、描画と同じ解釈で集める。
 * @param {string} mdContent - frontmatter を除いた本文
 * @returns {string[]}
 */
export function extractLinks(mdContent) {
  // 描画側と同じ GFM + 脚注の設定(描画はしない)。marked-footnote は状態を parse の hooks で
  // 初期化するため、lexer を直接呼ぶ場合はページごとに新しいインスタンスを作る
  // (使い回すと、2ページ目の脚注で状態が残っていて例外になる)。
  const lexerMarked = new Marked({ gfm: true });
  lexerMarked.use(markedFootnote());
  const links = [];
  const tokens = lexerMarked.lexer(mdContent);
  lexerMarked.walkTokens(tokens, (token) => {
    if ((token.type === "link" || token.type === "image") && token.href) {
      links.push(token.href);
    } else if (token.type === "html") {
      links.push(...extractRawHtmlLinks(token.raw ?? token.text ?? ""));
    }
  });
  return links;
}

/**
 * 本文の最初の h1 見出しの表示テキストを返す(Markdown の記号・HTMLタグは除く)。無ければ ""。
 * `# 見出し`・`見出し\n===` のほか、README でよく使われる生のHTMLの `<h1 align="center">…</h1>` も
 * 見出しとして扱う。ナビ・前後ページリンクの表示名と <title> に使う。
 * コードブロック内の "# …" は見出しとして扱われない。絵文字のショートコード(:tada:)は、描画と同じく絵文字に変える。
 * @param {string} mdContent
 * @returns {string}
 */
export function firstHeadingText(mdContent) {
  // 絵文字のショートコードは、描画と同じく変換後の文字にする(ナビの表示名が描画した見出しと揃うように)
  const marked = new Marked({ gfm: true });
  marked.use(emojiExtension());
  for (const token of marked.lexer(mdContent)) {
    if (token.type === "heading" && token.depth === 1) {
      return htmlToText(marked.parseInline(token.text)).trim();
    }
    if (token.type === "html") {
      const m = token.text.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      if (m) return htmlToText(m[1]).replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

// 生の HTML <a href>・<img src>・<video src>・<audio src>・<source src> と、<img>・<source> の srcset の
// 各候補の URL も拾う(タグ名・属性名の大文字小文字は区別しない。対象のタグは html-renderer の書き換えと同じ)
export function extractRawHtmlLinks(mdContent) {
  const results = [];
  const re = /<(?:a|img|video|audio|source)\b[^>]*?\s(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(mdContent)) !== null) {
    results.push(m[1].trim());
  }
  const srcsetRe = new RegExp(SRCSET_ATTR);
  while ((m = srcsetRe.exec(mdContent)) !== null) {
    mapSrcsetUrls(m[2] ?? m[3], (url) => {
      if (url) results.push(url);
      return url;
    });
  }
  return results;
}
