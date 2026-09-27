/**
 * sitemap.mjs
 *
 * sitemap.json (デバッグ・可視化用の出力物) を組み立てるモジュール。
 *
 * 既存 build-docs.mjs (旧333〜350行目相当) のインライン処理を
 * `buildSitemap(opts): object` として関数化したもの。
 *
 * v2 での拡張点:
 *   - 新規フィールド `lang` / `siteName` / `siteOrigin` / `customDomain` /
 *     `theme` / `rejected` を追加する。
 *   - `pages` を `string[]` から `{ rel, title, description }[]` に変更する
 *     (破壊的変更)。旧 `pages` 相当の文字列配列は後方互換のため
 *     `pageRels` として併存させる。
 *
 * 引数 `opts.visitedMd` の形状についての前提:
 *   `Map<string, { content: string, meta?: { title?: string, description?: string } }>`
 *   を想定する。h1 見出しからのタイトル抽出は本関数の責務外とし、
 *   呼び出し側 (build-docs.mjs / html-renderer.mjs 等) が解決済みの
 *   タイトルを `meta.title` に詰めて渡す設計とする。
 *   `meta.title` が無い場合のみ、本関数は安全側のフォールバックとして
 *   `rel` (ファイルパス) をタイトル代わりに用いる。
 *
 * `customDomain` 未設定時の値は `null` に統一する (空文字ではない)。
 * 呼び出し側が `undefined` を渡した場合も `null` に正規化する。
 */

/**
 * @param {object} opts
 * @param {string} opts.root - ROOT_MD の相対パス
 * @param {string} opts.basePath - 正規化済み BASE_PATH
 * @param {string} opts.styleFile - STYLE_FILE の相対パス
 * @param {boolean} opts.customStyleApplied - カスタム CSS が適用されたか
 * @param {Map<string, {content: string, meta?: {title?: string, description?: string}}>} opts.visitedMd
 * @param {Iterable<string>} opts.imageSet - 収集された画像の相対パス集合
 * @param {Iterable<string>} [opts.fileSet] - 収集された画像以外のリンク先ファイル(PDF等)の相対パス集合
 * @param {object} opts.hierarchy - ページ階層構造(リンクをたどった親子関係)
 * @param {object} [opts.tree] - ディレクトリ階層に沿ったサイトツリー(site-tree.mjs の buildSiteTree の戻り値)
 * @param {Array} opts.missing - 見つからなかったリンクの一覧
 * @param {Array<{rel: string, referencedFrom: string|null, reason: "path-traversal"|"decode-error"|"outside-repo"}>} [opts.rejected]
 *   - パストラバーサル等でスキップされたリンクの一覧 (省略時は空配列)
 * @param {string} opts.lang - サイト全体の言語コード
 * @param {string} opts.siteName - サイト名
 * @param {string} opts.siteOrigin - サイトのオリジン (例: "https://example.com")
 * @param {string|null} [opts.customDomain] - CNAME に書き出すカスタムドメイン (未設定時は null)
 * @param {string} opts.theme - config.loadConfig() で解決された最終テーマ名 ("none" を含む)
 * @returns {object} sitemap.json に書き出すオブジェクト
 */
export function buildSitemap(opts) {
  const {
    root,
    basePath,
    styleFile,
    customStyleApplied,
    visitedMd,
    imageSet,
    fileSet,
    hierarchy,
    tree,
    missing,
    rejected,
    lang,
    siteName,
    siteOrigin,
    customDomain,
    theme,
  } = opts;

  // 旧 `pages` 相当 (文字列配列)。後方互換のため `pageRels` として残す。
  const pageRels = [...visitedMd.keys()];

  // 新 `pages` (オブジェクト配列)。title は meta.title 優先、
  // 無ければ rel をフォールバックとして使う (h1抽出は呼び出し側の責務)。
  const pages = pageRels.map((rel) => {
    const entry = visitedMd.get(rel) || {};
    const meta = entry.meta || {};
    return {
      rel,
      title: meta.title || rel,
      description: meta.description ?? null,
      // ページ単位のテーマ上書き(frontmatterの `theme` キー)。未指定時は null とし、
      // サイト全体の `theme`(このオブジェクトのトップレベル)が適用されていることを示す。
      theme: meta.theme ?? null,
    };
  });

  return {
    root,
    basePath,
    styleFile,
    customStyleApplied: Boolean(customStyleApplied),
    pages,
    pageRels,
    images: [...imageSet],
    files: fileSet ? [...fileSet] : [],
    hierarchy,
    tree: tree ?? null,
    missing,
    rejected: rejected ? [...rejected] : [],
    lang,
    siteName,
    siteOrigin,
    customDomain: customDomain ?? null,
    theme,
  };
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 検索エンジン向けの sitemap.xml(sitemaps.org 形式)を組み立てる。
 * デバッグ用の sitemap.json とは別物。
 *
 * @param {Iterable<string>} urls - 公開URL(絶対URL)の一覧
 * @returns {string}
 */
export function buildSitemapXml(urls) {
  const entries = [...urls].map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
