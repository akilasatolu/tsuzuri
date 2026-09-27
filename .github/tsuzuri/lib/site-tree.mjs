/**
 * site-tree.mjs
 *
 * 収集したページ一覧から、リポジトリ上のディレクトリ構成に沿った
 * サイトツリー(ナビゲーション・sitemap.json の `tree` に使う)を組み立てるモジュール。
 *
 * 並び順:
 *   各ディレクトリ内のページ・サブディレクトリは、クロール(BFS)でページが
 *   見つかった順に並べる。サブディレクトリの位置は、そのディレクトリ配下で
 *   最初に見つかったページの位置で決まる。READMEなどでリンクを書いた順が
 *   そのままナビの並び順になる。
 *
 * ページの表示名(優先順):
 *   1. frontmatter の `title`
 *   2. 本文の最初の h1 見出しの表示テキスト(crawler が集めた entry.h1)
 *   3. 起点のページ(ROOT_MD)なら、サイト名(SITE_NAME)
 *   4. ファイル名(例: "cli.md")
 *   <title> タグ(frontmatter の title > h1 > ファイルパス)と同じ考え方にそろえている。
 */

import path from "node:path";

const posix = path.posix;

/**
 * @typedef {{ type: "page", rel: string, title: string }} PageNode
 * @typedef {{ type: "dir", name: string, path: string, children: TreeNode[] }} DirNode
 * @typedef {PageNode | DirNode} TreeNode
 */

/**
 * ページの表示名を決める。frontmatterの title > h1 > fallback(起点ページのサイト名) > ファイル名。
 *
 * @param {string} rel
 * @param {{ title?: string }} [meta]
 * @param {string} [fallback]
 * @param {string} [h1] - 本文の最初の h1 の表示テキスト
 * @returns {string}
 */
export function pageLabel(rel, meta, fallback = "", h1 = "") {
  const title = typeof meta?.title === "string" ? meta.title.trim() : "";
  return title || (h1 || "").trim() || fallback || posix.basename(rel);
}

/**
 * @param {Iterable<[string, { meta?: object }]>} visitedMdEntries - crawlSite の visitedMd.entries()(発見順)
 * @param {{ rootMd?: string, siteName?: string }} [options] - 起点ページの表示名にサイト名を使うための情報
 * @returns {DirNode} ルートディレクトリ(name="", path="")
 */
export function buildSiteTree(visitedMdEntries, { rootMd = "", siteName = "" } = {}) {
  const root = { type: "dir", name: "", path: "", children: [] };
  const dirIndex = new Map([["", root]]);

  function getDir(dirPath) {
    if (dirIndex.has(dirPath)) return dirIndex.get(dirPath);
    const parent = getDir(posix.dirname(dirPath) === "." ? "" : posix.dirname(dirPath));
    const dir = { type: "dir", name: posix.basename(dirPath), path: dirPath, children: [] };
    parent.children.push(dir);
    dirIndex.set(dirPath, dir);
    return dir;
  }

  for (const [rel, entry] of visitedMdEntries) {
    const dirPath = posix.dirname(rel) === "." ? "" : posix.dirname(rel);
    const fallback = rel === rootMd ? siteName : "";
    getDir(dirPath).children.push({
      type: "page",
      rel,
      title: pageLabel(rel, entry?.meta, fallback, entry?.h1),
    });
  }

  return root;
}

/**
 * サイトツリーのページを、ナビゲーションに表示される順(深さ優先)に1列に並べる。
 * 「前のページ/次のページ」リンクの順番に使う。
 *
 * @param {DirNode} tree
 * @returns {PageNode[]}
 */
export function flattenPages(tree) {
  const pages = [];
  (function walk(node) {
    for (const child of node.children) {
      if (child.type === "page") pages.push(child);
      else walk(child);
    }
  })(tree);
  return pages;
}
