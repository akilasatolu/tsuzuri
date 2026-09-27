/**
 * link-extractor.mjs
 *
 * Markdown中のリンクを見つける処理を担当するモジュール。
 *
 * 既存 build-docs.mjs (旧112〜132行目相当) からロジック変更なしで移動したもの:
 *   extractMarkdownSyntaxLinks / extractRawHtmlLinks
 *
 * 新規追加:
 *   stripCodeSpans — コードブロック・インラインコード内の「見せかけのリンク」を
 *     誤って辿らないよう、リンク抽出前に呼び出し側(crawler.mjs、T-007)が適用する
 *     前処理関数。
 */

// Markdown 中の [text](href) / ![alt](href) を抽出する簡易パーサ
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
