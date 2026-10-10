/**
 * llms-txt.mjs
 *
 * AI(LLM)向けにサイトの目次を書いた llms.txt を組み立てる純粋関数モジュール(ファイルI/Oは行わない)。
 * 形は https://llmstxt.org/ に沿う(H1 のサイト名・引用ブロックの要約・リンクの一覧の節)。
 *
 * ページの題名・説明は利用者が書いた文字列なので、Markdown の構造を壊さないよう、書き込む前に
 * 無害化する(1行にまとめ、リンクの記号をエスケープし、長さを切る)。
 */

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 300;

/**
 * 1行の文字列にして、Markdown のリンク・コード・HTML の記号(\ [ ] ` <)をエスケープし、
 * max 文字(コードポイント)で切る。
 *   - 空白と制御文字(NEL・U+001C〜U+001E・NUL・ESC・DEL など、行の区切りとして扱う読み手がいるもの)の
 *     並びは1つの空白にまとめ、前後を取る
 *   - 切るのはエスケープの前なので、サロゲートペア(絵文字など)の途中や、`\` だけが残る位置では切れない
 *   - 正規表現は1文字のクラスの置換だけ(入力の長さに対して線形)
 * @param {string} raw
 * @param {number} max
 * @returns {string}
 */
export function sanitizeText(raw, max) {
  const oneLine = String(raw ?? "")
    .toWellFormed()
    .replace(/[\s\p{Cc}]+/gu, " ")
    .trim();
  const cut = Array.from(oneLine).slice(0, max).join("").trimEnd();
  return cut.replace(/[\\[\]`<]/g, "\\$&");
}

/**
 * URL を、Markdown のリンクの括弧の中に書けるようにする。パスはパーセントエンコード済みなので、
 * 残る ( と ) だけを置き換える。オリジン(SITE_ORIGIN)には制御文字が残りうるので、それもエンコードする。
 * @param {string} url
 * @returns {string}
 */
export function sanitizeUrl(url) {
  return String(url).replace(/[()\p{Cc}]/gu, (c) =>
    c === "(" ? "%28" : c === ")" ? "%29" : `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  );
}

// - [題名](URL): 説明   (説明が空なら ": " 以降は出さない)
function itemLine({ title, url, description }) {
  const safeUrl = sanitizeUrl(url);
  // 題名が空になったときは、空でない代わりに URL を使う
  const label = sanitizeText(title, TITLE_MAX) || sanitizeText(url, TITLE_MAX);
  const desc = sanitizeText(description, DESCRIPTION_MAX);
  return `- [${label}](${safeUrl})${desc ? `: ${desc}` : ""}`;
}

/**
 * llms.txt の本文を組み立てる。項目のない節は、見出しごと出さない。末尾は改行1つ。
 *
 * @param {object} opts
 * @param {string} opts.siteName - H1 に使うサイト名(空なら homeUrl)
 * @param {string} opts.homeUrl - サイトのトップの URL(サイト名が空になったときの代わり)
 * @param {string} [opts.summary] - 引用ブロックの要約(空なら出さない)
 * @param {Array<{ title: string, url: string, description?: string }>} opts.docs - `## Docs` の項目
 * @param {Array<{ title: string, url: string, description?: string }>} [opts.optional] - `## Optional` の項目
 * @returns {string}
 */
export function buildLlmsTxt({ siteName, homeUrl, summary = "", docs, optional = [] }) {
  const lines = [`# ${sanitizeText(siteName, TITLE_MAX) || sanitizeText(homeUrl, TITLE_MAX)}`];
  const safeSummary = sanitizeText(summary, DESCRIPTION_MAX);
  if (safeSummary) lines.push("", `> ${safeSummary}`);
  for (const [heading, items] of [
    ["Docs", docs],
    ["Optional", optional],
  ]) {
    if (items.length === 0) continue;
    lines.push("", `## ${heading}`, "", ...items.map(itemLine));
  }
  return `${lines.join("\n")}\n`;
}
