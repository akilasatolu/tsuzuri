/**
 * frontmatter.mjs
 *
 * Markdownファイル先頭に書ける簡易frontmatter(`---` で囲んだブロック)を
 * 解析し、メタデータ(`meta`)と残りの本文(`body`)に分離するモジュール。
 *
 * 設計方針:
 *   - YAMLパーサライブラリは追加しない(依存量の最小性を維持するため)。
 *     `key: value` 形式のフラットな行のみをサポートする自作パーサとする。
 *   - サポートするキーは `title` / `description` / `ogImage` / `ogType` /
 *     `lang` / `noindex` / `theme` の7つ。`noindex` のみ真偽値化し、それ以外は
 *     文字列としてそのまま保持する。
 *   - 上記7キー以外の未知のキーも文字列のまま `meta` に保持する
 *     (将来のフォーマット拡張に向けた寛容な扱い)。
 *
 * `theme`キーについて:
 *   ページ単位でテーマを上書きするためのキー。値の解釈(組み込みテーマ名か、
 *   独自CSSファイルパスか)は本モジュールの責務外で、呼び出し側
 *   (build-docs.mjs)が `config.mjs` の `ALLOWED_THEMES` と照合して判定する。
 *   本モジュールは他の未知キーと同様、値を文字列としてそのまま `meta.theme`
 *   に保持するだけである。
 *   - frontmatterの開始(`---`)はあるが終端の`---`が見つからない場合は
 *     `console.warn` で警告を出し、ブロック全体を本文としてそのまま扱う
 *     (fail-open。ビルドを止めない)。
 *
 * `lang`キーについての注意(決定3準拠):
 *   `lang` もパース処理自体は他のキーと同様に `meta.lang` へ文字列として
 *   保持する。しかし呼び出し側の `html-renderer.mjs` は `meta.lang` を
 *   一切参照・使用しない。多言語対応は対象外であり、生成されるHTMLの
 *   `<html lang="...">` は常に `.github/docs-pages.config` の `LANG`
 *   環境変数由来のサイト全体固定値のみが使われ、ページ単位のfrontmatterで
 *   上書きされることはない。
 */

const FRONTMATTER_DELIMITER = "---";
const LINE_PATTERN = /^(\w+):\s*(.*)$/;

/**
 * @param {string} rawContent - Markdownファイルの生の内容
 * @returns {{ meta: object, body: string }}
 */
export function parseFrontmatter(rawContent) {
  if (typeof rawContent !== "string") {
    return { meta: {}, body: rawContent };
  }
  // Windowsで作成・編集されたファイル(改行コードCRLF、先頭BOM付き)でも
  // frontmatterを認識できるよう、先頭のBOMを除去し改行コードをLFに正規化する。
  rawContent = rawContent.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!rawContent.startsWith(`${FRONTMATTER_DELIMITER}\n`)) {
    return { meta: {}, body: rawContent };
  }

  const lines = rawContent.split("\n");
  // lines[0] は先頭の "---" 行。次に現れる単独行 "---" を終端として探す。
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FRONTMATTER_DELIMITER) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    console.warn(
      "frontmatter終端の --- が見つかりません。frontmatterとして解釈せず本文として扱います。"
    );
    return { meta: {}, body: rawContent };
  }

  const blockLines = lines.slice(1, endIndex);
  const meta = {};

  for (const line of blockLines) {
    const match = line.match(LINE_PATTERN);
    if (!match) {
      // コメントや空行など、パターンに一致しない行は無視する。
      continue;
    }
    const [, key, value] = match;
    if (key === "noindex") {
      meta[key] = value.trim().toLowerCase() === "true";
    } else {
      meta[key] = value;
    }
  }

  const body = lines.slice(endIndex + 1).join("\n");

  return { meta, body };
}
