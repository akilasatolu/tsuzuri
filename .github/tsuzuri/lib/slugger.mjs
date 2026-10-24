/**
 * slugger.mjs
 *
 * 見出しから、ページ内リンク(`[…](page.md#見出し)`)の飛び先になる id を作るモジュール。
 * GitHub が README 等の見出しに付ける id と同じ規則にそろえ、GitHub上で動いていた
 * アンカーリンクが生成サイトでもそのまま動くようにする。
 *
 * 規則(GitHub互換):
 *   1. 見出しのテキスト(HTMLタグを除いたもの)を小文字にする
 *   2. 文字・数字・結合文字・連結句読点(_)・空白・ハイフン以外を取り除く
 *      (日本語などの文字はそのまま残る)
 *   3. 空白をハイフンに置き換える
 *   4. 同じページで同じ id が既に使われていれば、末尾に -1, -2, … を付ける
 */

const ENTITY_MAP = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/**
 * レンダリング済みの見出しHTMLから、表示されるテキストだけを取り出す。
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITY_MAP[m]);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/**
 * ページごとに1つ作り、同じページ内での id の重複を避ける。
 * @returns {{ slug: (text: string) => string }}
 */
export function createSlugger() {
  const used = new Map();
  return {
    slug(text) {
      const base = slugify(text);
      if (!used.has(base)) {
        used.set(base, 0);
        return base;
      }
      let count = used.get(base);
      let candidate;
      do {
        count += 1;
        candidate = `${base}-${count}`;
      } while (used.has(candidate));
      used.set(base, count);
      used.set(candidate, 0);
      return candidate;
    },
  };
}
