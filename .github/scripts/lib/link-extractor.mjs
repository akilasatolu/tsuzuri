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
 * 生のHTML(<a href>・<img src>)は、HTMLのトークンに extractRawHtmlLinks を適用して拾う。
 */

import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import { htmlToText } from "./slugger.mjs";

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
 * 本文の最初の h1 見出し(`# 見出し`)の表示テキストを返す(Markdown の記号は除く)。無ければ ""。
 * ナビ・前後ページリンクの表示名に使う。コードブロック内の "# …" は見出しとして扱われない。
 * @param {string} mdContent
 * @returns {string}
 */
export function firstHeadingText(mdContent) {
  const marked = new Marked({ gfm: true });
  const h1 = marked.lexer(mdContent).find((token) => token.type === "heading" && token.depth === 1);
  return h1 ? htmlToText(marked.parseInline(h1.text)).trim() : "";
}

// 生の HTML <img src="..."> / <a href="..."> も拾う(タグ名・属性名の大文字小文字は区別しない)
export function extractRawHtmlLinks(mdContent) {
  const results = [];
  const re = /<(?:img|a)[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(mdContent)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}
