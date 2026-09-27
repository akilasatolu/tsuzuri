/**
 * link-extractor.mjs
 *
 * Markdown中のリンクを見つける処理を担当するモジュール。
 *
 * ページ集め(crawler.mjs)は extractLinks を使う。extractLinks は、ページの描画と同じ marked の
 * 解析結果(トークン)からリンクを集めるため、参照リンク([x][ref])・画像を囲んだリンク(バッジ)・
 * 単一引用符のタイトル・山括弧(<a b.md>)・括弧を含むパスなど、描画でリンクになるものは
 * すべてたどる。コードブロック・インラインコードの中の「見せかけのリンク」は、marked が
 * コードとして扱うので自然に除外される。生のHTML(<a href>・<img src>)は、HTMLのトークンに
 * extractRawHtmlLinks を適用して拾う。
 *
 * extractMarkdownSyntaxLinks / stripCodeSpans は、以前の正規表現による実装で、互換のために残している。
 *
 * 既存 build-docs.mjs (旧112〜132行目相当) からロジック変更なしで移動したもの:
 *   extractMarkdownSyntaxLinks / extractRawHtmlLinks
 *
 * 新規追加:
 *   stripCodeSpans — コードブロック・インラインコード内の「見せかけのリンク」を
 *     誤って辿らないよう、リンク抽出前に呼び出し側(crawler.mjs、T-007)が適用する
 *     前処理関数。
 */

import { Marked } from "marked";
import markedFootnote from "marked-footnote";

// リンク抽出用の marked(描画側と同じ GFM + 脚注の設定。描画はしない)
const lexerMarked = new Marked({ gfm: true });
lexerMarked.use(markedFootnote());

/**
 * Markdown 本文から、リンク・画像・生のHTMLの href/src を、描画と同じ解釈で集める。
 * @param {string} mdContent - frontmatter を除いた本文
 * @returns {string[]}
 */
export function extractLinks(mdContent) {
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

// (互換用)Markdown 中の [text](href) / ![alt](href) を抽出する簡易パーサ
export function extractMarkdownSyntaxLinks(mdContent) {
  const results = [];
  const re = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(mdContent)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

// 生の HTML <img src="..."> / <a href="..."> も拾う
export function extractRawHtmlLinks(mdContent) {
  const results = [];
  const re = /<(?:img|a)[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(mdContent)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

// フェンス付きコードブロック(```/~~~)の開始行を判定する。
// インデントされたフェンスも許容するため、行頭の空白は無視する。
const FENCE_RE = /^(\s*)(`{3,}|~{3,})/;

/**
 * Markdown中のフェンス付きコードブロックとインラインコードスパンを、
 * 同じ行数を保ったまま空行/空文字に置換して除去する。
 *
 * 除去後の文字列を extractMarkdownSyntaxLinks / extractRawHtmlLinks に渡すことで、
 * コードサンプル内に書かれた `[fake](evil.md)` のような「見せかけのリンク」を
 * リンクとして誤検出しないようにする(呼び出しは crawler.mjs 側の責務。T-007)。
 *
 * 行数を変えないのは、呼び出し側や将来のエラーメッセージが元のMarkdownの行番号と
 * 対応づけられるようにするための配慮。
 *
 * 既知の限界(あえて対応しない):
 *   - ネストしたバッククォート(例: `` `code with `nested` backtick` ``、または
 *     フェンスの開始/終了記号数が閉じ側と一致しない変則的なネスト)には対応しない。
 *     単純に「同じ種類のフェンス記号が最初に再度単独行で現れた行」を終端とみなす、
 *     もしくは「最初に閉じるバッククォート列」を終端とみなす素朴な実装であり、
 *     厳密なCommonMark仕様(バッククォートの本数一致要件等)までは実装しない。
 *
 * @param {string} mdContent
 * @returns {string}
 */
export function stripCodeSpans(mdContent) {
  const lines = mdContent.split("\n");
  const out = [];
  let inFence = false;
  let fenceMarker = "";

  for (const line of lines) {
    if (!inFence) {
      const fenceMatch = FENCE_RE.exec(line);
      if (fenceMatch) {
        inFence = true;
        fenceMarker = fenceMatch[2][0]; // "`" または "~"
        out.push("");
        continue;
      }
      out.push(stripInlineCodeSpans(line));
    } else {
      // フェンス終端行かどうか判定: 同じ種類の記号が3つ以上並ぶ行(行頭の空白は許容)。
      const closeRe = new RegExp(`^\\s*${fenceMarker}{3,}\\s*$`);
      if (closeRe.test(line)) {
        inFence = false;
        fenceMarker = "";
      }
      out.push("");
    }
  }

  return out.join("\n");
}

// 1行内のインラインコードスパン(バッククォートで囲まれた範囲)を空文字に置換する。
// 改行をまたぐスパンは扱わない(呼び出し元で1行ずつ処理される前提)。
// ネストしたバッククォート(`` ` `` のような複数バッククォートによるエスケープ)には対応しない。
function stripInlineCodeSpans(line) {
  return line.replace(/`[^`\n]*`/g, "");
}
