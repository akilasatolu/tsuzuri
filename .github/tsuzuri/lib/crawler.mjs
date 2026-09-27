/**
 * crawler.mjs
 *
 * ROOT_MD を起点に、Markdown内のリンクをBFS(幅優先探索)でたどり、
 * 到達可能な md ファイル・画像ファイルだけを収集し、階層構造を構築するモジュール。
 *
 * 既存 build-docs.mjs (旧136〜178行目相当の `bfs` 関数) を移動したもの。
 * 元の実装との違い:
 *   - グローバル変数・トップレベル即時実行だったものを `crawlSite(options)` という
 *     1つの関数にまとめ、`readFile`/`exists` をDI(依存注入)可能にしてテストしやすくした。
 *   - ファイル読み込み直後に `frontmatter.parseFrontmatter` を適用し、
 *     `visitedMd` の各エントリを `{ content, meta }` の形にした
 *     (`content` はfrontmatterブロックを除いた本文)。以降のリンク抽出は
 *     この本文に対して行う。
 *   - リンク抽出前に `link-extractor.stripCodeSpans` を適用し、コードブロック内の
 *     見せかけのリンクを探索対象から除外する(セキュリティ回帰対応)。
 *   - `path-utils.resolveRepoRel` が判別可能な戻り値
 *     (`{ repoRel, rest }` または `{ rejected: true, reason }`) を返すようになったため、
 *     `reason` で分岐する:
 *       - "external" / "anchor" → 正常な非対象リンクとして黙って無視する
 *         (`missing`にも`rejected`にも記録しない)。
 *       - "path-traversal" / "decode-error" → セキュリティ上疑わしい入力として
 *         `rejected` 配列に記録する。
 */

import fs from "node:fs";
import { resolveRepoRel, resolveInsideRepo, isMarkdownPath, isImagePath } from "./path-utils.mjs";
import { stripCodeSpans, extractMarkdownSyntaxLinks, extractRawHtmlLinks } from "./link-extractor.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";

/**
 * @typedef {{ content: string, meta: object }} VisitedMdEntry
 * @typedef {{ rel: string, referencedFrom: string|null }} MissingEntry
 * @typedef {{ rel: string, referencedFrom: string|null, reason: "path-traversal"|"decode-error"|"outside-repo" }} RejectedEntry
 */

/**
 * @param {object} options
 * @param {string} options.repoRoot - リポジトリルートの絶対パス
 * @param {string} options.rootRel - 起点となる md ファイルのリポジトリルートからの相対パス(posix)
 * @param {(path: string, encoding: string) => string} [options.readFile] - DI: ファイル読み込み(既定 fs.readFileSync)
 * @param {(path: string) => boolean} [options.exists] - DI: ファイル存在確認(既定 fs.existsSync)
 * @param {(path: string) => string} [options.realpath] - DI: シンボリックリンク解決(既定 fs.realpathSync)
 * @returns {{
 *   visitedMd: Map<string, VisitedMdEntry>,
 *   imageSet: Set<string>,
 *   hierarchy: Record<string, { parent: string|null, children: string[] }>,
 *   missing: MissingEntry[],
 *   rejected: RejectedEntry[],
 * }}
 */
export function crawlSite({
  repoRoot,
  rootRel,
  readFile = fs.readFileSync,
  exists = fs.existsSync,
  realpath = fs.realpathSync,
}) {
  const visitedMd = new Map(); // relPath(posix) -> { content, meta }
  const imageSet = new Set(); // relPath(posix)
  const hierarchy = {}; // relPath -> { parent, children: [] }
  const missing = [];
  const rejected = [];

  const queue = [{ rel: rootRel, parent: null }];
  while (queue.length > 0) {
    const { rel, parent } = queue.shift();
    if (visitedMd.has(rel)) continue;

    // シンボリックリンク経由でリポジトリ外のファイルを読み込んで公開してしまわないよう、
    // 実体がリポジトリ内にあるものだけを対象にする。
    const abs = resolveInsideRepo(repoRoot, rel, realpath);
    if (!abs) {
      rejected.push({ rel, referencedFrom: parent, reason: "outside-repo" });
      continue;
    }
    if (!exists(abs)) {
      missing.push({ rel, referencedFrom: parent });
      continue;
    }

    const rawContent = readFile(abs, "utf-8");
    const { meta, body } = parseFrontmatter(rawContent);
    visitedMd.set(rel, { content: body, meta });
    hierarchy[rel] = { parent, children: [] };
    if (parent && hierarchy[parent]) {
      hierarchy[parent].children.push(rel);
    }

    const stripped = stripCodeSpans(body);
    const rawLinks = [
      ...extractMarkdownSyntaxLinks(stripped),
      ...extractRawHtmlLinks(stripped),
    ];

    for (const rawLink of rawLinks) {
      const resolved = resolveRepoRel(rel, rawLink);

      if (resolved.rejected) {
        if (resolved.reason === "path-traversal" || resolved.reason === "decode-error") {
          rejected.push({ rel: rawLink, referencedFrom: rel, reason: resolved.reason });
        }
        // "external" / "anchor" は正常な非対象リンクとして黙って無視する
        continue;
      }

      const { repoRel } = resolved;

      if (isMarkdownPath(repoRel)) {
        queue.push({ rel: repoRel, parent: rel });
      } else if (isImagePath(repoRel)) {
        imageSet.add(repoRel);
      }
      // それ以外の拡張子 (pdf など) は今回のスコープ外なのでスキップ
    }
  }

  return { visitedMd, imageSet, hierarchy, missing, rejected };
}
