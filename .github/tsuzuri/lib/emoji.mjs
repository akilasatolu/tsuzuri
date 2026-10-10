/**
 * emoji.mjs
 *
 * 絵文字のショートコード(:tada: → 🎉)を変換する marked の拡張機能。GitHub と同じく、README に書いた
 * ショートコードが、サイトでも絵文字として表示される。表は emoji-data.mjs(gemoji から作る)。
 *
 * marked の tokenizer・start・walkTokens は使わず、解析が終わった後のトークンを1回たどって、
 * 文字のトークンの中のショートコードだけを置き換える。start や marked の walkTokens を使うと、
 * トークンが密な入力(コードスパンと文字が交互に何万個も並ぶなど)で、処理時間が長さの2乗に伸びるため。
 *
 * 変換する: 本文・強調・リンクの文字・表・リスト・引用・脚注、コード用以外のインラインのHTMLタグの間。
 * 変換しない: コードスパン・コードブロック、インラインの <code>・<kbd>・<pre>・<script>・<tt>・<samp>・<style> の中、
 * ブロックのHTMLの中、URLをそのまま書いたリンク、画像の alt、`\:tada:`、表に無い名前。
 */

import { EMOJI } from "./emoji-data.mjs";

const TYPE = "tsuzuriEmojiText";

// インラインのHTMLのうち、中を変換しないタグ。<code>・<kbd>・<pre>・<script> の中は marked が escaped を付けるので、
// そちらで除かれる。marked が escaped を付けない <tt>・<samp>・<style> だけ、ここで開閉を見る
const RAW_OPEN = /^<(tt|samp|style)[\s>]/i;
const RAW_CLOSE = /^<\/(tt|samp|style)\s*>/i;

/**
 * 文字列を、そのままの文字列と { name, emoji } に分ける。ショートコードが無ければ null。
 * 前から1回なぞるだけなので、処理時間は長さに比例する。
 * @param {string} text
 * @returns {(string | { name: string, emoji: string })[] | null}
 */
export function splitEmoji(text) {
  if (!text.includes(":")) return null;
  const re = /:([a-z0-9_+-]{1,40}):/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (!Object.hasOwn(EMOJI, name)) {
      // 表に無い名前。閉じ側のコロンは、次のショートコードの開き側かもしれないので戻す(:x:tada:)
      re.lastIndex = m.index + m[0].length - 1;
      continue;
    }
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ name, emoji: EMOJI[name] });
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return null;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// 1つのトークン列を前から読み、文字のトークンをショートコード入りのトークンに置き換える(元の配列の中を直接書き換える)。
// noEmoji: この列の中は変換しない(<tt> などの中にある強調・リンクの子など)
function convert(tokens, noEmoji) {
  let rawTag = ""; // いま中にいる <tt>・<samp>・<style> のタグ名(小文字)。無ければ ""
  for (const token of tokens) {
    const skip = noEmoji || rawTag !== "";
    if (token.type === "html") {
      if (!rawTag) {
        const open = RAW_OPEN.exec(token.raw);
        if (open) rawTag = open[1].toLowerCase();
      } else {
        const close = RAW_CLOSE.exec(token.raw);
        if (close && close[1].toLowerCase() === rawTag) rawTag = "";
      }
      continue;
    }
    if (token.type === "text" && !token.tokens) {
      if (skip || token.escaped === true) continue;
      const parts = splitEmoji(token.text);
      if (parts) {
        token.type = TYPE;
        token.parts = parts;
      }
      continue;
    }
    if (token.type === "image") continue; // alt は変換しない
    // `[` で始まらないリンクは、URLをそのまま書いた自動リンク(表示も href も変えない)
    const inner = skip || (token.type === "link" && !token.raw.startsWith("["));
    if (token.type === "table") {
      for (const cell of token.header) convert(cell.tokens, inner);
      for (const row of token.rows) for (const cell of row) convert(cell.tokens, inner);
    } else if (token.type === "list") {
      convert(token.items, inner);
    } else if (token.type === "footnotes") {
      for (const item of token.items) convert(item.content, inner);
    } else if (token.type === "footnote") {
      convert(token.content, inner);
    } else if (Array.isArray(token.tokens)) {
      convert(token.tokens, inner);
    }
  }
}

/**
 * 絵文字のショートコードを変換する marked の拡張機能を返す(`marked.use(emojiExtension())`)。
 * 脚注の拡張(marked-footnote)の後に使う。
 */
export function emojiExtension() {
  return {
    hooks: {
      processAllTokens(tokens) {
        convert(tokens, false);
        return tokens;
      },
    },
    extensions: [
      {
        name: TYPE,
        renderer(token) {
          return token.parts
            .map((part) =>
              typeof part === "string"
                ? // 文字の部分は、marked の text の描画と同じ(escaped の扱いも含めて)
                  this.parser.renderer.text({ type: "text", raw: part, text: part, escaped: token.escaped })
                : part.emoji
            )
            .join("");
        },
      },
    ],
  };
}

/**
 * トークン列に、ショートコード入りのトークンがあるか(入れ子の中も見る)。
 * @param {object[]} tokens
 * @returns {boolean}
 */
export function hasEmojiToken(tokens) {
  return tokens.some((t) => t.type === TYPE || (Array.isArray(t.tokens) && hasEmojiToken(t.tokens)));
}

/**
 * ショートコード入りのトークンを、元の文字のトークンに戻した新しいトークン列を返す(元の列は変えない)。
 * 見出しの id は、変換前の文字(demo-tada など)から作るために使う。
 * @param {object[]} tokens
 * @returns {object[]}
 */
export function emojiNamesAsText(tokens) {
  return tokens.map((t) => {
    if (t.type === TYPE) return { type: "text", raw: t.raw, text: t.text, escaped: t.escaped };
    if (Array.isArray(t.tokens) && hasEmojiToken(t.tokens)) return { ...t, tokens: emojiNamesAsText(t.tokens) };
    return t;
  });
}
