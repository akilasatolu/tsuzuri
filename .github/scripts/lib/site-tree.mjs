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
 *   frontmatter に `order`(数値)を書いたページは、同じディレクトリの中で、書いていないページより前に
 *   小さい順に並ぶ。サブディレクトリの位置は、その中の README.md / index.md の `order` で指定できる。
 *
 * ナビに載せないページ:
 *   frontmatter に `nav: false` と書いたページはツリーに含めない(ページ自体は出力され、リンクで開ける)。
 *   中のページがすべて載らないディレクトリも表示しない。
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
 * @typedef {{ type: "page", rel: string, title: string, order?: number }} PageNode
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

// frontmatter の order を数値にする(書いていない・数値でないときは undefined)
export function pageOrder(meta) {
  const raw = typeof meta?.order === "string" ? meta.order.trim() : meta?.order;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

// frontmatter に nav: false と書いたページか
export function isHiddenFromNav(meta) {
  return String(meta?.nav ?? "").trim().toLowerCase() === "false";
}

const DIR_INDEX_NAMES = ["README.md", "readme.md", "index.md"];

// isDirIndex を渡さないときの「フォルダの入口(README.md / readme.md / index.md)か」の判定
function defaultIsDirIndex(rel) {
  return DIR_INDEX_NAMES.includes(posix.basename(rel));
}

/**
 * @param {Iterable<[string, { meta?: object }]>} visitedMdEntries - crawlSite の visitedMd.entries()(発見順)
 * @param {{ rootMd?: string, siteName?: string, isDirIndex?: (rel: string) => boolean }} [options]
 *   rootMd・siteName は起点ページの表示名にサイト名を使うための情報。
 *   isDirIndex はページ(rel)がフォルダの入口か(そのフォルダの位置をこのページの order で決めるか)の判定。
 *   省略時は README.md / readme.md / index.md。
 * @returns {DirNode} ルートディレクトリ(name="", path="")
 */
export function buildSiteTree(visitedMdEntries, { rootMd = "", siteName = "", isDirIndex = defaultIsDirIndex } = {}) {
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
    if (isHiddenFromNav(entry?.meta)) continue;
    const dirPath = posix.dirname(rel) === "." ? "" : posix.dirname(rel);
    const fallback = rel === rootMd ? siteName : "";
    const node = { type: "page", rel, title: pageLabel(rel, entry?.meta, fallback, entry?.h1) };
    const order = pageOrder(entry?.meta);
    if (order !== undefined) node.order = order;
    getDir(dirPath).children.push(node);
  }

  sortByOrder(root, isDirIndex);
  return root;
}

// order を書いたもの(小さい順)を先に、書いていないものは見つかった順のまま後ろに並べる。
// ディレクトリの order は、その中の入口のページ(isDirIndex が true の最初のページ)の order。
function sortByOrder(dir, isDirIndex) {
  const keyOf = (node) => {
    if (node.type === "page") return node.order ?? Infinity;
    const index = node.children.find((c) => c.type === "page" && isDirIndex(c.rel));
    return index?.order ?? Infinity;
  };
  for (const child of dir.children) if (child.type === "dir") sortByOrder(child, isDirIndex);
  // Array.prototype.sort は安定ソートなので、同じ順位のものは見つかった順のまま
  dir.children.sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    return ka === kb ? 0 : ka < kb ? -1 : 1;
  });
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
