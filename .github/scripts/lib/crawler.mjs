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
 *   - リンクの抽出は link-extractor.extractLinks(描画と同じ marked の解析結果を使う)で行い、
 *     参照リンク・バッジ等もたどる。コードブロック内の見せかけのリンクは自然に除外される。
 *   - ディレクトリへのリンク("guide/")は、中の README.md / index.md をたどる。
 *   - `path-utils.resolveRepoRel` が判別可能な戻り値
 *     (`{ repoRel, rest }` または `{ rejected: true, reason }`) を返すようになったため、
 *     `reason` で分岐する:
 *       - "external" / "anchor" → 正常な非対象リンクとして黙って無視する
 *         (`missing`にも`rejected`にも記録しない)。
 *       - "path-traversal" / "decode-error" → セキュリティ上疑わしい入力として
 *         `rejected` 配列に記録する。
 */

import fs from "node:fs";
import { resolveRepoRel, resolveInsideRepo, isMarkdownPath, isImagePath, isLinkedFilePath } from "./path-utils.mjs";
import { extractLinks, firstHeadingText } from "./link-extractor.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";

/**
 * @typedef {{ content: string, meta: object }} VisitedMdEntry
 * @typedef {{ rel: string, referencedFrom: string|null }} MissingEntry
 * @typedef {{ rel: string, referencedFrom: string|null, reason: "path-traversal"|"decode-error"|"outside-repo" }} RejectedEntry
 */

// ディレクトリへのリンクのとき、たどるページ(優先順)
const DIR_INDEX_NAMES = ["README.md", "readme.md", "index.md"];

function defaultIsDirectory(abs) {
  try {
    return fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

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
 *   fileSet: Set<string>,
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
  isDirectory = defaultIsDirectory,
}) {
  const visitedMd = new Map(); // relPath(posix) -> { content, meta, h1 }
  const imageSet = new Set(); // relPath(posix)
  const fileSet = new Set(); // relPath(posix)。Markdown・画像以外のリンク先(PDF・zip等)
  const hierarchy = {}; // relPath -> { parent, children: [] }
  const missing = [];
  const rejected = [];
  // サイトのページ・ファイルにはならないが、実在するリンク先(パスの末尾の "/" は除いた形がキー)
  //   { kind: "dir" }            … README.md / index.md のあるディレクトリ(サイトの "dir/" を指す)
  //   { kind: "repo", isDir }    … サイトに出さないファイル(LICENSE・ドットファイル等)や、
  //                                README の無いディレクトリ。描画では GitHub 上の URL に置き換える
  const linkTargets = new Map();
  const existsInRepo = (repoRel) => {
    const abs = resolveInsideRepo(repoRoot, repoRel, realpath);
    return abs && exists(abs) ? abs : null;
  };

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
    visitedMd.set(rel, { content: body, meta, h1: firstHeadingText(body) });
    hierarchy[rel] = { parent, children: [] };
    if (parent && hierarchy[parent]) {
      hierarchy[parent].children.push(rel);
    }

    const rawLinks = extractLinks(body);

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
      const bare = repoRel.replace(/\/+$/, "");

      // サイトのルート("/" や "../" で直下を指すリンク)は、描画ではトップURL(= ROOT_MD のページ)を
      // 指すので、リポジトリ直下の README.md ではなく ROOT_MD をたどる
      if (bare === "" || bare === ".") {
        queue.push({ rel: rootRel, parent: rel });
        continue;
      }

      if (isMarkdownPath(bare)) {
        queue.push({ rel: bare, parent: rel });
        continue;
      }
      if (isImagePath(bare)) {
        imageSet.add(bare);
        continue;
      }
      if (isLinkedFilePath(bare) && !repoRel.endsWith("/")) {
        fileSet.add(bare); // 存在しなければコピー時にリンク切れとして報告される
        continue;
      }

      // ここに来るのは、ディレクトリへのリンク("guide/"・"guide")、拡張子の無いファイル(LICENSE)、
      // ドットファイル(.env.example)。実在するものだけを扱い、無ければリンク切れにする。
      const abs = existsInRepo(bare);
      if (!abs) {
        missing.push({ rel: repoRel, referencedFrom: rel });
        continue;
      }
      if (isDirectory(abs)) {
        // ディレクトリ: 中の README.md / index.md をたどり、サイトの "dir/" へのリンクにする。
        // どちらも無ければ、GitHub 上のディレクトリ一覧へのリンクにする。
        const indexRel = DIR_INDEX_NAMES.map((name) => `${bare}/${name}`).find((c) => existsInRepo(c));
        if (indexRel) {
          queue.push({ rel: indexRel, parent: rel });
          linkTargets.set(bare, { kind: "dir" });
        } else {
          linkTargets.set(bare, { kind: "repo", isDir: true });
        }
      } else {
        // サイトには出さないファイル(LICENSE・ドットファイル等)は、GitHub 上のファイルへのリンクにする
        linkTargets.set(bare, { kind: "repo", isDir: false });
      }
    }
  }

  return { visitedMd, imageSet, fileSet, linkTargets, hierarchy, missing, rejected };
}
