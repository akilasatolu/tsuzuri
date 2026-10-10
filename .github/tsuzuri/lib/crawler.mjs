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
 *
 * 多言語対応(`i18n` に言語の決まり lib/i18n.mjs の createLangContext の戻り値を渡したとき):
 *   手順0(1言語でも): queue に Markdown を入れるとき、印の無いファイルで、同じフォルダに
 *         基本言語の印付きの版(実際のファイル名)があれば、印付きの方を入れる(`shadowed` に記録)。
 *   手順1(多言語だけ): 読んだページの別の言語版を、フォルダの実際のファイル名から探して集める。
 *   手順2(多言語だけ): サイト直下へのリンクは、リンク元の言語のトップを指す。
 *   手順3(1言語でも): フォルダへのリンクの入口を、言語の決まりの順番(candidates)で探す。
 *   手順4(多言語だけ): 他の言語の URL の先頭と同じ名前の一番上のフォルダのページを `prefixConflicts` に入れる。
 *   `i18n` を渡さなければ今と同じ動き。
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

function defaultReadDir(abs) {
  try {
    return fs.readdirSync(abs);
  } catch {
    return [];
  }
}

/** "docs/a.md" → { dir: "docs", name: "a.md" }(直下は dir が "") */
function splitRel(rel) {
  const i = rel.lastIndexOf("/");
  return i < 0 ? { dir: "", name: rel } : { dir: rel.slice(0, i), name: rel.slice(i + 1) };
}

const joinRel = (dir, name) => (dir ? `${dir}/${name}` : name);

/** 名前で並べ替えて最初の1つ(無ければ null) */
const firstSorted = (names) => (names.length > 0 ? [...names].sort()[0] : null);

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
 * @param {(path: string) => boolean} [options.isDirectory] - DI: ディレクトリか(既定 fs.statSync)
 * @param {import("./i18n.mjs").LangContext} [options.i18n] - 言語の決まり。省略時は今と同じ動き
 * @param {(path: string) => string[]} [options.readDir] - DI: フォルダの中のファイル名一覧
 *   (既定 fs.readdirSync。読めなければ・例外なら [])
 * @returns {{
 *   visitedMd: Map<string, VisitedMdEntry>,
 *   imageSet: Set<string>,
 *   fileSet: Set<string>,
 *   hierarchy: Record<string, { parent: string|null, children: string[] }>,
 *   missing: MissingEntry[],
 *   rejected: RejectedEntry[],
 *   prefixConflicts: string[],
 *   shadowed: Map<string, string>,
 *   rootRel: string,
 * }}
 *   prefixConflicts: 他の言語の URL の先頭と同じ名前の一番上のフォルダにあるページ(多言語でなければ空)
 *   shadowed: 印の無い rel → 代わりに集めた基本言語の印付きの rel(i18n を渡さなければ空)
 *   rootRel: 手順0の置き換え後の起点
 */
export function crawlSite({
  repoRoot,
  rootRel,
  readFile = fs.readFileSync,
  exists = fs.existsSync,
  realpath = fs.realpathSync,
  isDirectory = defaultIsDirectory,
  i18n = null,
  readDir = defaultReadDir,
}) {
  const visitedMd = new Map(); // relPath(posix) -> { content, meta, h1 }
  const imageSet = new Set(); // relPath(posix)
  const fileSet = new Set(); // relPath(posix)。Markdown・画像以外で、コピーする拡張子の一覧にあるリンク先(PDF・zip等)
  const hierarchy = {}; // relPath -> { parent, children: [] }
  const missing = [];
  const rejected = [];
  // サイトのページ・ファイルにはならないが、実在するリンク先(パスの末尾の "/" は除いた形がキー)
  //   { kind: "dir", referencedFrom }         … README.md / index.md のあるディレクトリ(サイトの "dir/")
  //   { kind: "repo", isDir, referencedFrom } … サイトに出さないファイル(LICENSE・ドットファイル・コピーする拡張子の一覧にないファイル等)や、
  //                                             README の無いディレクトリ。描画では GitHub 上の URL にする
  // referencedFrom は最初にリンクしていたページ(メッセージ用)
  const linkTargets = new Map();
  const existsInRepo = (repoRel) => {
    const abs = resolveInsideRepo(repoRoot, repoRel, realpath);
    return abs && exists(abs) ? abs : null;
  };

  const multi = Boolean(i18n && i18n.enabled);
  const shadowed = new Map();
  // フォルダの中の実際のファイル名(フォルダごとに1度だけ読む)。リポジトリの外は読まない
  const dirCache = new Map();
  const listDir = (dirRel) => {
    if (dirCache.has(dirRel)) return dirCache.get(dirRel);
    let names = [];
    const abs = resolveInsideRepo(repoRoot, dirRel || ".", realpath);
    if (abs) {
      try {
        const got = readDir(abs);
        if (Array.isArray(got)) names = got.map(String);
      } catch {
        names = []; // 読めないフォルダは、翻訳・入口が無いものとして続ける
      }
    }
    dirCache.set(dirRel, names);
    return names;
  };
  /** フォルダの中の名前が(フォルダではなく)ファイルか。名前が a.en.md のフォルダを拾わないため */
  const isFileIn = (dirRel, name) => {
    const abs = resolveInsideRepo(repoRoot, joinRel(dirRel, name), realpath);
    return Boolean(abs) && !isDirectory(abs);
  };
  /**
   * 大文字・小文字を区別しない条件で合うファイルの実際の名前を1つ選ぶ。
   * exact と完全に一致する名前があればそれを優先し、無ければ名前で並べ替えて最初の1つ(無ければ null)。
   * (翻訳の対応表 buildTranslationIndex と同じ「完全一致を優先」の基準)
   */
  const pickName = (dirRel, match, exact) => {
    const names = listDir(dirRel).filter((n) => match(n) && isFileIn(dirRel, n));
    return names.includes(exact) ? exact : firstSorted(names);
  };
  /** フォルダの中から、baseName(印の無い名前)の tag 版の印付きの実際の名前を探す */
  const findVariant = (dirRel, baseName, tag) =>
    pickName(
      dirRel,
      (n) => i18n.isVariantName(n, baseName, tag),
      `${String(baseName).replace(/\.md$/i, "")}.${tag}.md`,
    );
  /** 手順0: 印の無い Markdown なら、基本言語の印付きの版(実在すれば)に置き換える */
  const preferMarked = (rel) => {
    if (!i18n || i18n.markerOf(rel) !== null) return rel;
    const { dir, name } = splitRel(rel);
    const marked = findVariant(dir, name, i18n.base);
    if (!marked) return rel;
    // 印付き(a.en.md)の元の名前と完全に一致する、別の印の無いファイル(a.md)があれば、
    // 印付きはそちらの組。rel(A.md)は印付きの無い別のページとして残す
    const pairName = splitRel(i18n.baseRelOf(joinRel(dir, marked))).name;
    if (pairName !== name && listDir(dir).includes(pairName) && isFileIn(dir, pairName)) return rel;
    const markedRel = joinRel(dir, marked);
    shadowed.set(rel, markedRel);
    return markedRel;
  };
  const pushMd = (rel, parent) => queue.push({ rel: preferMarked(rel), parent });
  /** 手順1: ページ rel の tag 版の実際の rel(無ければ null)。基本言語は印付き → 印の無い名前の順 */
  const variantOf = (rel, tag) => {
    const { dir, name } = splitRel(i18n.baseRelOf(rel));
    const marked = findVariant(dir, name, tag);
    if (marked) return joinRel(dir, marked);
    if (tag !== i18n.base) return null;
    const lower = name.toLowerCase();
    const plain = pickName(dir, (n) => n.toLowerCase() === lower, name);
    return plain ? joinRel(dir, plain) : null;
  };
  /** 手順3: フォルダ dirRel の入口の rel を、リンク元の言語 tag の順番で探す(無ければ null) */
  const findDirIndex = (dirRel, tag) => {
    for (const candidate of i18n.candidates(tag)) {
      const candTag = i18n.markerOf(candidate);
      if (candTag === null) {
        // 印の無い今の3つ(README.md・readme.md・index.md)は、今と同じ確かめ方・綴りにする
        // (1言語のサイトの出力を変えないため)
        const rel = joinRel(dirRel, candidate);
        if (existsInRepo(rel)) return rel;
        continue;
      }
      // 印付きは、実際のファイル名と大文字・小文字を区別せずに比べ、入口の名前の決まりにも合うもの
      // (例: "Index.en.md" は index.en.md と一致しても入口ではない)
      const { isReadme, isIndex } = i18n.dirIndexNames(candTag);
      const lower = candidate.toLowerCase();
      const found = pickName(dirRel, (n) => n.toLowerCase() === lower && (isReadme(n) || isIndex(n)), candidate);
      if (found) return joinRel(dirRel, found);
    }
    return null;
  };

  /**
   * 入口に基本言語の印付き(README.en.md・index.en.md)を選んだとき、読まなかった同じ型の印の無い入口
   * (今と同じ綴り・確かめ方で最初に見つかるもの)を shadowed に記録する
   */
  const recordShadowedDirIndex = (dirRel, indexRel) => {
    const { name } = splitRel(indexRel);
    if (i18n.markerOf(indexRel) !== i18n.base) return;
    const plainNames = i18n.dirIndexNames(i18n.base).isIndex(name) ? ["index.md"] : ["README.md", "readme.md"];
    const plainRel = plainNames.map((n) => joinRel(dirRel, n)).find((r) => existsInRepo(r));
    if (plainRel && !shadowed.has(plainRel)) shadowed.set(plainRel, indexRel);
  };

  const effectiveRootRel = preferMarked(rootRel);
  const queue = [{ rel: effectiveRootRel, parent: null }];
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

    // 手順1: 別の言語版も集める(リンクが無くても。実在しなければ何も記録しない)
    if (multi) {
      const own = i18n.langOf(rel);
      for (const tag of i18n.languages) {
        if (tag === own) continue;
        const variant = variantOf(rel, tag);
        if (variant) queue.push({ rel: variant, parent: rel });
      }
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
        // 手順2: 多言語では、リンク元の言語のトップ(無ければ基本言語のトップ)
        const lang = multi ? i18n.langOf(rel) : null;
        const langRoot = multi && lang !== i18n.base ? variantOf(rootRel, lang) : null;
        queue.push({ rel: langRoot ?? effectiveRootRel, parent: rel });
        continue;
      }

      if (isMarkdownPath(bare)) {
        if (i18n) pushMd(bare, rel);
        else queue.push({ rel: bare, parent: rel });
        continue;
      }
      if (isImagePath(bare)) {
        imageSet.add(bare);
        continue;
      }
      if (isLinkedFilePath(bare) && !repoRel.endsWith("/")) {
        fileSet.add(bare); // コピーする拡張子の一覧(isLinkedFilePath)にあるもの。存在しなければコピー時にリンク切れとして報告される
        continue;
      }

      // ここに来るのは、ディレクトリへのリンク("guide/"・"guide")、拡張子の無いファイル(LICENSE)、
      // ドットファイル(.env.example)、コピーする拡張子の一覧にないファイル(src/foo.js・package.json)。
      // 実在するものだけを扱い、無ければリンク切れにする。
      const abs = existsInRepo(bare);
      if (!abs) {
        missing.push({ rel: repoRel, referencedFrom: rel });
        continue;
      }
      if (isDirectory(abs)) {
        // ディレクトリ: 中の README.md / index.md をたどり、サイトの "dir/" へのリンクにする。
        // どちらも無ければ、GitHub 上のディレクトリ一覧へのリンクにする。
        // 手順3: i18n があれば、言語の決まりの順番で実際のファイル名から探す
        const indexRel = i18n
          ? findDirIndex(bare, i18n.langOf(rel))
          : DIR_INDEX_NAMES.map((name) => `${bare}/${name}`).find((c) => existsInRepo(c));
        if (indexRel) {
          // 入口は candidates の順で基本言語の印付きを先に探してあるので、手順0の置き換えは通さない
          // (置き換えると、入口の名前の決まりに合わない印付き(Index.en.md)を拾うことがある)
          queue.push({ rel: indexRel, parent: rel });
          if (i18n) recordShadowedDirIndex(bare, indexRel);
          if (!linkTargets.has(bare)) linkTargets.set(bare, { kind: "dir", referencedFrom: rel });
        } else if (!linkTargets.has(bare)) {
          linkTargets.set(bare, { kind: "repo", isDir: true, referencedFrom: rel });
        }
      } else if (!linkTargets.has(bare)) {
        // サイトには出さないファイル(LICENSE・ドットファイル等)は、GitHub 上のファイルへのリンクにする
        linkTargets.set(bare, { kind: "repo", isDir: false, referencedFrom: rel });
      }
    }
  }

  // 手順4: 他の言語の URL の先頭(en/ など)と同じ名前の一番上のフォルダにあるページ
  const prefixConflicts = [];
  if (multi) {
    const prefixes = new Set(i18n.languages.map((tag) => i18n.prefixOf(tag)).filter(Boolean));
    for (const rel of visitedMd.keys()) {
      const slash = rel.indexOf("/");
      if (slash > 0 && prefixes.has(rel.slice(0, slash).toLowerCase())) prefixConflicts.push(rel);
    }
  }

  return {
    visitedMd,
    imageSet,
    fileSet,
    linkTargets,
    hierarchy,
    missing,
    rejected,
    prefixConflicts,
    shadowed,
    rootRel: effectiveRootRel,
  };
}
