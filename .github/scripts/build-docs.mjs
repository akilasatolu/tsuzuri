#!/usr/bin/env node
/**
 * build-docs.mjs
 *
 * オーケストレーション層(エントリーポイント)。
 * config・crawler・frontmatter・link-extractor・path-utils・html-renderer・
 * sitemap の各モジュールを正しい順番で呼び出し、ROOT_MD (default: README.md) を
 * 起点に「たどり着けるファイルだけ」を収集して OUT_DIR (default: _site) に
 * 静的サイトとして書き出す。
 *
 * 処理順序 (設計書「モジュール別詳細設計 > build-docs.mjs(エントリーポイント)」節):
 *   1. config.loadConfig()
 *   2. ROOT_MD 存在チェック(不在なら console.error + 致命的エラー・終了コード1)
 *   3. ${styleDir}/base.css 読み込み(不在なら致命的エラー。OSS本体自身の欠陥であり
 *      利用者側の設定ミスではないため STYLE_FILE 不在時とは扱いを分ける)
 *   4. THEME !== "none" なら ${styleDir}/${theme}.css 読み込み
 *      (不在なら console.warn + themeCss="" にフォールバック。fail-open)
 *   5. crawler.crawlSite()
 *   6. STYLE_FILE / FAVICON_FILE 読み込み(不在なら console.warn のみ・非致命的)
 *   7. 出力ディレクトリ作成・.nojekyll・(customDomain時)CNAME・
 *      (faviconFile時)favicon本体コピー
 *   8. 各ページの HTML 生成ループ(見出しid付与。ROOT_MD と各ディレクトリの README.md は
 *      index.html としても出力)
 *   9. 404.html 生成(リポジトリ直下の 404.md、無ければ既定の内容)
 *   10. 画像・その他のリンク先ファイル(PDF等)のコピー
 *   11. sitemap.xml / robots.txt(SITE_ORIGIN がある場合のみ)
 *   12. sitemap.buildSitemap() 書き込み(デバッグ用 sitemap.json。SITEMAP_JSON=true のときだけ)
 *   13. 完了ログ
 *
 * エラーハンドリング方針:
 *   main() 全体を呼び出し元(本ファイル末尾)で catch し、未分類の例外は
 *   「ビルド中に予期しないエラーが発生しました」+ err.message を出力してから
 *   終了コード1で終了する。ROOT_MD 不在・base.css 不在のみ main() 内部で
 *   個別に致命的エラーとして扱う。STYLE_FILE/FAVICON_FILE/THEME本体の不在・
 *   missing link・rejected link は非致命的(warn継続)。
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import hljs from "highlight.js/lib/common";

import { loadConfig, ALLOWED_THEMES, parseConfigText, withConfigFileDefaults } from "./lib/config.mjs";
import { crawlSite } from "./lib/crawler.mjs";
import {
  isMarkdownPath,
  toSiteAbsHref,
  resolveInsideRepo,
  resolveRepoRel,
  isExternal,
  isImagePath,
  isLinkedFilePath,
  webUrlFromGitRemote,
  outputRelOf,
  encodeUrlPath,
} from "./lib/path-utils.mjs";
import { extractLinks } from "./lib/link-extractor.mjs";
import {
  escapeHtml,
  renderNav,
  renderMetaTags,
  renderPager,
  renderToc,
  renderAlert,
  MERMAID_SCRIPT,
  preprocessRawHtmlPaths,
  pageTemplate,
  composeCss,
  defaultNotFoundMarkdown,
  renderLangSwitch,
} from "./lib/html-renderer.mjs";
import { buildSitemap, buildSitemapXml } from "./lib/sitemap.mjs";
import { buildSiteTree, flattenPages } from "./lib/site-tree.mjs";
import { createSlugger, htmlToText } from "./lib/slugger.mjs";
import { buildSearchIndex, SEARCH_SCRIPT } from "./lib/search.mjs";
import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { imageSizeOf } from "./lib/image-size.mjs";
import { COPY_SCRIPT, COPY_SCRIPT_NAME } from "./lib/copy-button.mjs";
import { THEME_SCRIPT, THEME_SCRIPT_NAME, THEME_HEAD_SCRIPT } from "./lib/theme-toggle.mjs";
import {
  uiStrings,
  resolveUiLang,
  formatUi,
  createLangContext,
  buildTranslationIndex,
  languageName,
  notFoundLangScript,
} from "./lib/i18n.mjs";

// 印の無いフォルダの入口の名前(ナビの木のフォルダの並び順に使う。今の site-tree と同じ3つ・同じ綴り)
const PLAIN_DIR_INDEX_NAMES = ["README.md", "readme.md", "index.md"];

// 出力先の目印のファイル名。これがあるディレクトリは Tsuzuri が前回出力したものなので、ビルドの前に
// 空にしてよい(消したページ・画像が残らないように)。"." で始まるので公開サイトには含まれない。
const BUILD_MARKER = ".tsuzuri-build";

// 日本語の文を途中で改行したとき、表示に余計な空白が入らないよう、前後がどちらも全角文字
// (漢字・かな・長音「ー」や中黒「・」を含む記号・全角文字)の改行を取り除く
// (markdown-it-cjk-breaks と同じ考え方)。描画後のHTMLにかけるので、**強調**やリンクの直後の
// 改行(改行の前後にタグがはさまる)も取り除ける。<pre>(コードブロック)の中は変えない。
const CJK_CHARS = "\\p{scx=Han}\\p{scx=Hiragana}\\p{scx=Katakana}\\u3000-\\u303f\\uff00-\\uffef";
const CJK_BREAK = new RegExp(`([${CJK_CHARS}])((?:<[^>]+>)*)\\n((?:<[^>]+>)*)(?=[${CJK_CHARS}])`, "gu");
export function removeCjkLineBreaks(html) {
  return html
    .split(/(<pre[\s\S]*?<\/pre>)/)
    .map((part) => (part.startsWith("<pre") ? part : part.replace(CJK_BREAK, "$1$2$3")))
    .join("");
}

// 手元でビルドするときの環境変数。GitHub Actions の外では、
//   - .github/docs-pages.config の値を、環境変数で指定していないキーの既定値にする
//   - STYLE_DIR を指定せず、init でコピーしたテーマCSS(.github/tsuzuri/styles)があればそれを使う
// ことで、公開サイトと同じ設定でプレビューできるようにする。
function localBuildEnv(env, repoRoot) {
  if (env.GITHUB_ACTIONS === "true") return env;
  let merged = env;
  const configAbs = path.join(repoRoot, ".github", "docs-pages.config");
  if (fs.existsSync(configAbs)) {
    merged = withConfigFileDefaults(env, parseConfigText(fs.readFileSync(configAbs, "utf-8")));
    console.log("Config file loaded: .github/docs-pages.config (環境変数で指定したキーは環境変数を優先)");
  }
  // リポジトリ直下の styles/ は利用者のアプリの CSS の可能性があるため、init でコピーした方を優先する
  const vendoredStyles = ".github/tsuzuri/styles";
  if (merged.STYLE_DIR === undefined && fs.existsSync(path.join(repoRoot, vendoredStyles, "base.css"))) {
    merged = { ...merged, STYLE_DIR: vendoredStyles };
  }
  return merged;
}

// 起点(ROOT_MD)の基本言語の印付きの版(README.en.md など)が、同じフォルダに実際のファイル名であるか
function hasMarkedRootFile(rootMdAbs, rootMd, i18n) {
  if (i18n.markerOf(rootMd) !== null) return false;
  const dirAbs = path.dirname(rootMdAbs);
  let names;
  try {
    names = fs.readdirSync(dirAbs);
  } catch {
    return false;
  }
  const isFile = (abs) => {
    try {
      return fs.statSync(abs).isFile();
    } catch {
      return false; // 壊れたシンボリックリンクなど
    }
  };
  return names.some(
    (name) => i18n.isVariantName(name, path.posix.basename(rootMd), i18n.base) && isFile(path.join(dirAbs, name))
  );
}

async function main() {
  const REPO_ROOT = process.cwd();
  const config = loadConfig(localBuildEnv(process.env, REPO_ROOT));
  // ページの言語・出力先・URL の先頭を決めるのは、この言語の決まりだけ
  const i18n = createLangContext(config);
  const OUT_DIR = resolveInsideRepo(REPO_ROOT, config.outDir);

  // ---------- 0. OUT_DIR チェック(致命的) ----------
  // リポジトリ外やリポジトリ直下そのものへの書き出しは、利用者のファイルを
  // 上書きしてしまう恐れがあるため受け付けない。
  if (!OUT_DIR || OUT_DIR === path.resolve(REPO_ROOT)) {
    console.error(
      `OUT_DIR (${config.outDir}) にはリポジトリ内のサブディレクトリを指定してください。処理を中止します。`
    );
    process.exit(1);
  }

  // ---------- 1. ROOT_MD 存在チェック(致命的) ----------
  const rootMdAbs = resolveInsideRepo(REPO_ROOT, config.rootMd);
  if (!rootMdAbs) {
    console.error(`起点となる ${config.rootMd} がリポジトリの外を指しています。処理を中止します。`);
    process.exit(1);
  }
  // ROOT_MD が無くても、基本言語の印付きの版(README.en.md など。実際のファイル名で探す)があれば続ける
  // (crawler が起点をそちらに置き換える)
  if (!fs.existsSync(rootMdAbs) && !hasMarkedRootFile(rootMdAbs, config.rootMd, i18n)) {
    const markedRoot =
      i18n.markerOf(config.rootMd) === null ? config.rootMd.replace(/\.md$/i, "") + `.${i18n.base}.md` : "";
    console.error(
      `起点となる ${config.rootMd}${markedRoot ? `(または ${markedRoot})` : " "}が見つかりません。処理を中止します。`
    );
    process.exit(1);
  }

  // ---------- 2. base.css 読み込み(必須・致命的) ----------
  // OSS本体自身が同梱すべきファイルであるため、不在は利用者の設定ミスではなく
  // パッケージ自体の欠陥として扱う(STYLE_FILE/テーマ本体の不在とは扱いを分ける)。
  const baseCssAbs = path.resolve(REPO_ROOT, config.styleDir, "base.css");
  if (!fs.existsSync(baseCssAbs)) {
    console.error(
      `${config.styleDir}/base.css が見つかりません。パッケージが破損している可能性があるため処理を中止します。`
    );
    process.exit(1);
  }
  const baseCss = fs.readFileSync(baseCssAbs, "utf-8");

  // ---------- 3. THEME CSS 読み込み(非致命的・fail-open) ----------
  let themeCss = "";
  if (config.theme !== "none") {
    const themeCssAbs = path.resolve(REPO_ROOT, config.styleDir, `${config.theme}.css`);
    if (fs.existsSync(themeCssAbs)) {
      themeCss = fs.readFileSync(themeCssAbs, "utf-8");
    } else {
      console.warn(
        `[build-docs] ${config.styleDir}/${config.theme}.css が見つかりません。テーマなし(base.cssのみ)でビルドを継続します。`
      );
      themeCss = "";
    }
  }

  // ---------- 3.5 ページ単位のテーマ上書き(frontmatter `theme`)解決 ----------
  // frontmatterの `theme` キーは、次のいずれかとして解釈する:
  //   - config.mjs の ALLOWED_THEMES に含まれる値 → 組み込みテーマ名として
  //     ${config.styleDir}/${theme}.css を読み込む(サイト全体のTHEMEと同じ解決方法)。
  //   - それ以外の値 → リポジトリルートからの相対パスとして扱い、
  //     ユーザーが用意した独自CSSファイルをそのまま読み込む(パスを含めて指定する)。
  // どちらも読み込みに失敗した場合(ファイル不在等)は console.warn した上で、
  // サイト全体のTHEME(themeCss)にフォールバックする(既存のfail-open方針を踏襲)。
  // 同じ指定が複数ページで使われるケースに備え、指定ごとに読み込み結果をキャッシュする。
  const pageThemeCssCache = new Map(); // "builtin:material" | "path:styles/custom.css" -> css文字列
  function resolveThemeCssForPage(rel, rawThemeSpec) {
    if (typeof rawThemeSpec !== "string") return themeCss;
    const spec = rawThemeSpec.trim();
    if (!spec) return themeCss;

    if (ALLOWED_THEMES.includes(spec)) {
      if (spec === "none") return "";
      const cacheKey = `builtin:${spec}`;
      if (pageThemeCssCache.has(cacheKey)) return pageThemeCssCache.get(cacheKey);
      const abs = path.resolve(REPO_ROOT, config.styleDir, `${spec}.css`);
      if (!fs.existsSync(abs)) {
        console.warn(
          `[build-docs] ${rel}: frontmatterで指定されたtheme "${spec}" 用のCSS(${config.styleDir}/${spec}.css)が見つかりません。サイト全体のTHEME("${config.theme}")にフォールバックします。`
        );
        return themeCss;
      }
      const css = fs.readFileSync(abs, "utf-8");
      pageThemeCssCache.set(cacheKey, css);
      return css;
    }

    // 組み込みテーマ名ではない → リポジトリルートからの相対パスで指定された
    // ユーザー独自のスタイルファイルとして扱う。リポジトリ外(../ や絶対パス、
    // リポジトリ外を指すシンボリックリンク)のファイルは読み込まない。
    const cacheKey = `path:${spec}`;
    if (pageThemeCssCache.has(cacheKey)) return pageThemeCssCache.get(cacheKey);
    const abs = resolveInsideRepo(REPO_ROOT, spec);
    if (!abs) {
      console.warn(
        `[build-docs] ${rel}: frontmatterで指定されたtheme "${spec}" はリポジトリの外を指しているため無視します。サイト全体のTHEME("${config.theme}")にフォールバックします。`
      );
      return themeCss;
    }
    if (!fs.existsSync(abs)) {
      console.warn(
        `[build-docs] ${rel}: frontmatterで指定されたtheme "${spec}" は組み込みテーマ名(${ALLOWED_THEMES.join(
          "/"
        )})に該当せず、リポジトリ内のファイルとしても見つかりません。サイト全体のTHEME("${config.theme}")にフォールバックします。`
      );
      return themeCss;
    }
    const css = fs.readFileSync(abs, "utf-8");
    pageThemeCssCache.set(cacheKey, css);
    return css;
  }

  // ---------- 4. crawlSite ----------
  const crawl = crawlSite({
    repoRoot: REPO_ROOT,
    rootRel: config.rootMd,
    i18n,
  });
  const { visitedMd, imageSet, fileSet, linkTargets, hierarchy, missing, rejected } = crawl;

  // ---------- 4.1 翻訳の対応表 ----------
  // 基本言語の印付きがあるため使わない印の無いファイル(shadowed)と、同じページの同じ言語版の
  // 重複(excluded)は、ナビ・前後・検索・書き出し・sitemap・見出しの確認のどれにも出さない。
  const tIndex = buildTranslationIndex(visitedMd.keys(), i18n);
  // 使わなかったファイル → 代わりに使うファイル(リンク先・見出しの確認の置き換え用)
  const replacedBy = new Map(crawl.shadowed);
  for (const { rel, keptRel } of [...tIndex.shadowed, ...tIndex.excluded]) {
    replacedBy.set(rel, keptRel);
    visitedMd.delete(rel);
    if (hierarchy[rel]) {
      delete hierarchy[rel];
      for (const node of Object.values(hierarchy)) node.children = node.children.filter((c) => c !== rel);
    }
  }
  for (const { rel, keptRel } of tIndex.excluded) {
    console.warn(`[build-docs] ${rel} は ${keptRel} と同じページの同じ言語版のため使いません。`);
  }
  /** 使わなかったファイルなら、代わりに使うファイル(置き換えが続くときは最後まで)。それ以外はそのまま */
  function keptRelOf(rel) {
    let cur = rel;
    for (let i = 0; i < 4 && replacedBy.has(cur) && !visitedMd.has(cur); i++) cur = replacedBy.get(cur);
    return cur;
  }
  // 置き換え後の起点(README.en.md があればそれ)。ROOT_MD の名前(config.rootMd)はログ・エラーの文言にだけ使う
  const siteRootRel = keptRelOf(crawl.rootRel);
  /** その言語のトップページ(基本言語は置き換え後の起点。他の言語は ROOT_MD のその言語の版)。無ければ null */
  const rootOfLang = (tag) => (tag === i18n.base ? siteRootRel : tIndex.rootOf(tag));
  const isLangRoot = (rel) => rel === rootOfLang(i18n.langOf(rel));
  /** フォルダの入口を、tag → 基本言語 → 他の言語の順に探す。{ tag, rel } か null */
  function dirIndexFor(dir, tag) {
    for (const t of [tag, ...i18n.languages.filter((x) => x !== tag)]) {
      const entry = tIndex.dirIndexOf(dir, t);
      if (entry) return { tag: t, rel: entry.rel };
    }
    return null;
  }

  console.log(`Markdown files mapped: ${visitedMd.size}`);
  console.log(`Image resources mapped: ${imageSet.size}`);
  console.log(`Other linked files mapped: ${fileSet.size}`);
  console.log(`Base path: "${config.basePath || "(none)"}"`);
  console.log(`Languages: ${i18n.languages.join(",")} (base: ${i18n.base})`);
  if (i18n.enabled) {
    // 言語の URL の先頭(en/ など)と同じ名前の一番上のフォルダのページ(出力先が重なるおそれ)
    const conflictDirs = [...new Set(crawl.prefixConflicts.map((rel) => rel.slice(0, rel.indexOf("/"))))];
    for (const dir of conflictDirs) {
      console.warn(
        `[build-docs] 多言語のURL(/${dir.toLowerCase()}/)と同じ名前のフォルダ ${dir} のページがあります。出力先が重なるおそれがあります。`
      );
    }
    const rels = [...visitedMd.keys()];
    for (const tag of i18n.languages) {
      const count = rels.filter((rel) => i18n.langOf(rel) === tag).length;
      console.log(`  ${tag}: ${count} ${count === 1 ? "page" : "pages"}`);
    }
    const basePages = rels.filter((rel) => i18n.langOf(rel) === i18n.base);
    for (const tag of i18n.languages.slice(1)) {
      const untranslated = basePages.filter((rel) => !tIndex.alternatesOf(rel).has(tag));
      if (untranslated.length) {
        const more = untranslated.length > 10 ? ", …" : "";
        console.log(`  Not translated into ${tag}: ${untranslated.length} (${untranslated.slice(0, 10).join(", ")}${more})`);
      }
      if (!tIndex.rootOf(tag)) {
        const name = languageName(tag);
        const rootName = config.rootMd.replace(/\.md$/i, "") + `.${tag}.md`;
        console.warn(
          `[build-docs] ${name}(${tag})のトップページ(${rootName})が見つかりません。翻訳の無いページの言語切り替えボタンには ${name} を出しません。`
        );
      }
    }
  }
  if (missing.length) {
    console.warn(`リンク先が見つからなかったファイル: ${missing.length} 件`);
    for (const m of missing) {
      console.warn(`  - ${m.rel} (referenced from ${m.referencedFrom})`);
    }
  }
  if (rejected.length) {
    console.warn(`セキュリティ上の理由で無視されたリンク: ${rejected.length} 件`);
    for (const r of rejected) {
      console.warn(`  - ${r.rel} (referenced from ${r.referencedFrom}, reason: ${r.reason})`);
    }
  }

  // ---------- 5. STYLE_FILE / FAVICON_FILE 読み込み(非致命的) ----------
  let customCss = "";
  if (config.styleFile) {
    const styleAbs = resolveInsideRepo(REPO_ROOT, config.styleFile);
    if (!styleAbs) {
      console.warn(`STYLE_FILE (${config.styleFile}) はリポジトリの外を指しているため無視します。`);
    } else if (fs.existsSync(styleAbs)) {
      customCss = fs.readFileSync(styleAbs, "utf-8");
      console.log(`Custom style loaded: ${config.styleFile}`);
    } else {
      // 独自CSSは任意なので、無くても警告にはしない
      console.log(`Custom style file not used (${config.styleFile} does not exist).`);
    }
  }

  // ページ単位の独自CSS(frontmatter `styleFile`。リポジトリの直下からのパス)。指定したページでは、
  // サイト全体の STYLE_FILE の代わりにこのファイルを3層目として使う(中身が空のファイルを指定すれば、
  // そのページには独自CSSを当てない)。読めない場合は警告して、サイト全体の STYLE_FILE を使う。
  const pageStyleCache = new Map(); // 指定 -> { css, rel } | null
  function resolveCustomStyleForPage(rel, rawSpec) {
    if (typeof rawSpec !== "string" || !rawSpec.trim()) return { css: customCss, rel: config.styleFile };
    const spec = rawSpec.trim();
    if (!pageStyleCache.has(spec)) {
      const abs = resolveInsideRepo(REPO_ROOT, spec);
      let loaded = null;
      if (!abs) {
        console.warn(`[build-docs] ${rel}: frontmatterの styleFile "${spec}" はリポジトリの外を指しているため無視します。`);
      } else if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        console.warn(`[build-docs] ${rel}: frontmatterの styleFile "${spec}" が見つかりません。サイト全体の STYLE_FILE を使います。`);
      } else {
        loaded = { css: fs.readFileSync(abs, "utf-8"), rel: spec };
      }
      pageStyleCache.set(spec, loaded);
    }
    return pageStyleCache.get(spec) ?? { css: customCss, rel: config.styleFile };
  }

  // faviconも画像(imageSet)と同様に、リポジトリルートからの相対パス構造を
  // 維持したまま OUT_DIR 配下にコピーする。ベースネームのみでコピーすると、
  // 別ディレクトリに同名ファイル(例: imageSet 側のリポジトリ直下 favicon.png)が
  // 存在した場合に出力先パスが衝突し、どちらかが無警告で上書きされてしまうため。
  let faviconHref = "";
  let faviconOutRel = "";
  let faviconAbs = "";
  if (config.faviconFile) {
    faviconAbs = resolveInsideRepo(REPO_ROOT, config.faviconFile) || "";
    if (!faviconAbs) {
      // コピー先も OUT_DIR の外になってしまうため、リポジトリ外を指す指定は受け付けない
      console.warn(`FAVICON_FILE (${config.faviconFile}) はリポジトリの外を指しているため無視します。`);
    } else if (fs.existsSync(faviconAbs)) {
      faviconOutRel = outputRelOf(path.relative(REPO_ROOT, faviconAbs).split(path.sep).join("/"));
      faviconHref = `${config.basePath}/${encodeUrlPath(faviconOutRel)}`;
    } else {
      console.warn(`Favicon file not found (${config.faviconFile}); skipping <link rel="icon">.`);
    }
  }

  // ---------- 6. 出力ディレクトリ準備 ----------
  // 出力先のパス(OUT_DIR からの相対パス)ごとに、何を書いたかを記録する。リンクされたファイルの
  // コピーが、生成したページやビルドが作るファイルを上書きしないようにするため。
  //   この設定でビルドが作るファイルは、書く前から予約しておく(コピーより後に書くものもあるため。
  //   404.html はコピーより前に必ず書くので、ここには含めない)
  const generatedFiles = [
    ".nojekyll",
    config.customDomain && "CNAME",
    config.navEnabled && "search-index.json",
    config.navEnabled && "tsuzuri-search.js",
    config.navEnabled && THEME_SCRIPT_NAME,
    config.siteOrigin && "sitemap.xml",
    config.siteOrigin && !config.basePath && "robots.txt",
    config.sitemapJson && "sitemap.json",
  ].filter(Boolean);
  if (config.navEnabled) {
    for (const tag of i18n.languages) {
      const prefix = i18n.prefixOf(tag);
      if (prefix) generatedFiles.push(`${prefix}/search-index.json`);
    }
  }
  generatedFiles.push(BUILD_MARKER);
  const writtenBy = new Map(generatedFiles.map((f) => [f, "(Tsuzuri が生成するファイル)"]));
  const collisions = [];
  // 前回 Tsuzuri が出力したディレクトリ(目印のファイルがある)だけを空にする。
  // 目印が無いディレクトリは利用者のファイルの可能性があるので、消さずに上書きする。
  if (fs.existsSync(path.join(OUT_DIR, BUILD_MARKER))) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    console.log(`Cleaned previous output: ${config.outDir}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, BUILD_MARKER),
    "Tsuzuri のビルドの出力先です。次のビルドの前に、このディレクトリの中身はすべて消されます。\n"
  );
  fs.writeFileSync(path.join(OUT_DIR, ".nojekyll"), "");

  if (config.customDomain) {
    fs.writeFileSync(path.join(OUT_DIR, "CNAME"), `${config.customDomain}\n`);
  }

  if (faviconHref) {
    writtenBy.set(faviconOutRel, config.faviconFile);
    const faviconDestAbs = path.join(OUT_DIR, faviconOutRel);
    fs.mkdirSync(path.dirname(faviconDestAbs), { recursive: true });
    fs.copyFileSync(faviconAbs, faviconDestAbs);
  }

  // ---------- 7. HTML 変換 ----------
  // 画面の文言(メニュー・検索・前後のページ・注意書きなど)は lib/i18n.mjs の表から、ページの言語で取る。
  // marked はこのビルド専用のインスタンスを使う(脚注の拡張機能を組み込むため)。
  // 脚注の見出しなどの文言が言語で変わるので、文言の言語ごとに1つ作って覚えておく。
  const markedByLang = new Map();
  function markedFor(tag) {
    const key = resolveUiLang(tag);
    if (!markedByLang.has(key)) {
      const strings = uiStrings(key);
      const instance = new Marked({ gfm: true, breaks: false });
      instance.use(
        markedFootnote({
          prefixId: "fn-",
          description: strings.footnotes,
          backRefLabel: strings.footnoteBack,
        })
      );
      markedByLang.set(key, instance);
    }
    return markedByLang.get(key);
  }

  // ナビゲーション・sitemap.json 用のサイトツリー(ディレクトリ階層)
  // フォルダの入口か(フォルダの並び順に使う)。印の無い名前は今の site-tree と同じ3つ(この綴りのとおり)だけ、
  // 印付きは README 型 readme.<tag>.md・index 型 index.<tag>.md を足す。印付きが無いサイトでは今と同じ並び
  function isDirIndexRel(rel) {
    const name = path.posix.basename(rel);
    if (PLAIN_DIR_INDEX_NAMES.includes(name)) return true;
    const tag = i18n.markerOf(rel);
    if (tag === null) return false;
    const { isReadme, isIndex } = i18n.dirIndexNames(i18n.langOf(rel));
    return isReadme(name) || isIndex(name);
  }
  // 言語ごとの材料(1言語なら1件だけ): その言語のページだけのナビの木・前後の並び・検索・文言。
  // 他の言語のページは、基本言語の版の見つかった順に並べ、基本言語の版の無いページは後ろに置く。
  const allRels = [...visitedMd.keys()];
  const foundIndex = new Map(allRels.map((rel, i) => [rel, i]));
  const langSites = new Map();
  for (const tag of i18n.languages) {
    const prefix = i18n.prefixOf(tag);
    const strings = uiStrings(tag);
    let rels = allRels.filter((rel) => i18n.langOf(rel) === tag);
    if (tag !== i18n.base) {
      const sortKey = (rel) => {
        const baseRel = tIndex.alternatesOf(rel).get(i18n.base);
        return baseRel !== undefined ? foundIndex.get(baseRel) : allRels.length + foundIndex.get(rel);
      };
      rels = rels.map((rel) => [sortKey(rel), rel]).sort((a, b) => a[0] - b[0]).map(([, rel]) => rel);
    }
    const rootRel = rootOfLang(tag);
    const tree = buildSiteTree(
      rels.map((rel) => [rel, visitedMd.get(rel)]),
      { rootMd: rootRel ?? "", siteName: config.siteName, isDirIndex: isDirIndexRel }
    );
    const order = flattenPages(tree);
    const search = config.navEnabled
      ? {
          indexUrl: `${config.basePath}/${prefix ? `${encodeUrlPath(prefix)}/` : ""}search-index.json`,
          scriptUrl: `${config.basePath}/tsuzuri-search.js`,
          placeholder: strings.searchPlaceholder,
          empty: strings.searchEmpty,
        }
      : null;
    langSites.set(tag, {
      tag,
      prefix,
      strings,
      rootRel,
      tree,
      order,
      orderIndex: new Map(order.map((page, i) => [page.rel, i])),
      search,
      searchPages: [], // { title, url, html }(本文のみ。前後ページリンクは含めない)
    });
  }

  // 最終更新日(LAST_UPDATED=true のとき)。git の履歴から各ページの最終コミット日を求める。
  // 履歴が浅い(shallow clone)と日付が正しく求まらないため、その場合は表示しない。
  let lastUpdatedEnabled = config.lastUpdated;
  if (lastUpdatedEnabled) {
    try {
      const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (shallow === "true") {
        console.warn("[build-docs] git の履歴が浅い(shallow clone)ため、最終更新日を表示しません。");
        lastUpdatedEnabled = false;
      }
    } catch {
      console.warn("[build-docs] git の履歴を読めないため、最終更新日を表示しません。");
      lastUpdatedEnabled = false;
    }
  }
  // ページと sitemap.xml の両方で使うので、ファイルごとに1回だけ git を実行する
  const lastUpdatedCache = new Map();
  function lastUpdatedOf(rel) {
    if (!lastUpdatedEnabled) return "";
    if (!lastUpdatedCache.has(rel)) {
      let date = "";
      try {
        date = execFileSync("git", ["log", "-1", "--format=%cs", "--", rel], {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        // 日付は表示しない
      }
      lastUpdatedCache.set(rel, date);
    }
    return lastUpdatedCache.get(rel);
  }

  // og:image は絶対URLでないとSNS等が読み込まないため、リポジトリ内の画像を指す相対パスは
  // サイトの絶対URLに変換し、その画像も出力にコピーする(ogImageSet)。
  //   - frontmatter の ogImage はそのページのファイルからの相対パス("/"始まりはリポジトリルートから)
  //   - OGP_DEFAULT_IMAGE はリポジトリルートからの相対パス
  // http(s):// などの外部URLはそのまま使う。リポジトリ外を指すものは出力しない。
  const ogImageSet = new Set();
  function resolveOgImage(rawImage, fromRel) {
    if (!rawImage) return "";
    if (isExternal(rawImage)) return rawImage;
    const resolved = resolveRepoRel(fromRel, rawImage);
    if (resolved.rejected || !resolveInsideRepo(REPO_ROOT, resolved.repoRel)) {
      console.warn(`og:image (${rawImage}) がリポジトリの外を指しているため出力しません。`);
      return "";
    }
    ogImageSet.add(resolved.repoRel);
    return `${config.siteOrigin}${config.basePath}/${encodeUrlPath(outputRelOf(resolved.repoRel))}${resolved.rest}`;
  }

  // サブディレクトリの README 型の入口(README.md・README.<言語>.md)は、そのディレクトリの index.html
  // としても出力する(`/docs/` のようなディレクトリのURLで開けるようにするため)。同じディレクトリに
  // index 型の入口(index.md・index.<言語>.md)がある場合はそちらを優先し、README からは index.html を
  // 作らない。基本言語では型ごとに印付きを優先する(翻訳の対応表の dirIndexOf)。
  const dirIndexRels = new Map(); // "言語\nフォルダ" -> README 型の入口の rel
  for (const rel of visitedMd.keys()) {
    const dir = path.posix.dirname(rel);
    if (dir === ".") continue;
    const tag = i18n.langOf(rel);
    const key = `${tag}\n${dir}`;
    if (dirIndexRels.has(key)) continue;
    const entry = tIndex.dirIndexOf(dir, tag);
    if (entry?.kind === "readme") dirIndexRels.set(key, entry.rel);
  }

  // ---- URL を決める関数(ナビ・前後・canonical・sitemap・検索結果・書き出し先はすべてここから) ----
  // ページの出力先の URL のパス(basePath より後ろ。パーセントエンコード済み)
  function pageOutPath(rel) {
    return encodeUrlPath(outputRelOf(i18n.outputHtmlRel(rel)));
  }
  const hrefFor = (rel) => `${config.basePath}/${pageOutPath(rel)}`;
  // フォルダの URL(basePath より後ろ)
  function dirUrlPath(dir, tag) {
    const prefix = i18n.prefixOf(tag);
    return `${prefix ? encodeUrlPath(prefix) + "/" : ""}${encodeUrlPath(outputRelOf(dir))}/`;
  }


  // サイトに出さないが実在するリンク先(LICENSE・ドットファイル・README の無いディレクトリ)は、
  // GitHub 上のファイル・一覧へのリンクにする。リポジトリのURLとコミットは、
  //   1. GitHub Actions が自動で設定する環境変数(GITHUB_SERVER_URL・GITHUB_REPOSITORY・GITHUB_SHA)
  //   2. 手元のビルドでは、git の origin のURLと今のブランチ名(push していないコミットを指して
  //      404 にならないように。ブランチが分からなければ HEAD のコミット)
  // の順に求める。どちらも分からなければ警告だけ出して、サイト内のパスのままにする(リンク先は実在するので
  // リンク切れ・STRICT_LINKS の対象にはしない)。
  const gitOut = (args) => {
    try {
      return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };
  const hasRepoLinks = [...linkTargets.values()].some((t) => t.kind === "repo");
  let repoBaseUrl = "";
  let repoRef = "";
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA) {
    repoBaseUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
    repoRef = process.env.GITHUB_SHA;
  } else if (hasRepoLinks) {
    repoBaseUrl = webUrlFromGitRemote(gitOut(["remote", "get-url", "origin"]));
    repoRef = repoBaseUrl ? gitOut(["branch", "--show-current"]) || gitOut(["rev-parse", "HEAD"]) : "";
  }
  function repoUrlOf(repoRel, isDir) {
    if (!repoBaseUrl || !repoRef) return null;
    return `${repoBaseUrl}/${isDir ? "tree" : "blob"}/${repoRef}/${encodeUrlPath(repoRel)}`;
  }
  for (const [repoRel, target] of linkTargets) {
    if (target.kind === "repo" && !repoUrlOf(repoRel, target.isDir)) {
      console.warn(
        `[build-docs] ${target.referencedFrom} から ${repoRel} へのリンクは、サイトに含めないファイル・ディレクトリを指しています。` +
          `GitHub上のURLが分からない(git の origin が無い等)ため、サイト内のパスのままリンクします(サイトには無いので開けません)。`
      );
    }
  }

  // Markdown・生のHTMLのリンク先を、サイト上のURLに書き換える。
  //   - サイト直下 → リンク元の言語のトップの URL(1言語では置き換え後の起点)
  //   - README.md / index.md のあるディレクトリ(末尾の "/" の有無を問わない) → サイトの "dir/"
  //     (多言語では入口のある言語の "<prefix>/dir/"。リンク元の言語 → 基本言語 → 他の言語の順)
  //   - サイトに出さない実在のファイル・ディレクトリ → GitHub 上のURL
  //   - 言語の印付きの Markdown → 印を取った出力先(pageOutPath)
  //   - それ以外 → toSiteAbsHref(.md → .html、basePath 付きの絶対パス)
  function siteHref(fromRel, href) {
    const resolved = resolveRepoRel(fromRel, href);
    if (!resolved.rejected) {
      const bare = resolved.repoRel.replace(/\/+$/, "");
      const target = linkTargets.get(bare);
      // サイト直下 → 置き換え後の起点の URL(1言語ではトップURL。今と同じ)
      // 多言語では、リンク元の言語のトップ・その言語の入口のフォルダ(無ければ基本言語 → 他の言語)
      const fromLang = visitedMd.has(fromRel) ? i18n.langOf(fromRel) : i18n.base;
      if (bare === "" || bare === ".") {
        return `${config.basePath}/${urlPathOf(rootOfLang(fromLang) ?? siteRootRel)}${resolved.rest}`;
      }
      if (target?.kind === "dir") {
        const tag = dirIndexFor(bare, fromLang)?.tag ?? i18n.base;
        return `${config.basePath}/${dirUrlPath(bare, tag)}${resolved.rest}`;
      }
      if (target?.kind === "repo") {
        const url = repoUrlOf(bare, target.isDir);
        if (url) return `${url}${resolved.rest}`;
      }
      // 言語の印付きの Markdown(基本言語の印を含む)→ 印を取った出力先。印が無ければ今と同じ
      if (isMarkdownPath(bare) && i18n.markerOf(bare) !== null) {
        return `${config.basePath}/${pageOutPath(bare)}${resolved.rest}`;
      }
    }
    return toSiteAbsHref(fromRel, href, config.basePath);
  }

  // ページの公開URLのうち basePath より後ろの部分(パーセントエンコード済み)。
  // canonical・og:url・sitemap.xml・検索結果で使う。
  //   起点 → ""(トップURL)、ディレクトリの README.md → "dir/"、それ以外 → "dir/page.html"
  function urlPathOf(rel) {
    const tag = i18n.langOf(rel);
    const prefix = i18n.prefixOf(tag);
    if (isLangRoot(rel)) return prefix ? `${encodeUrlPath(prefix)}/` : "";
    const dir = path.posix.dirname(rel);
    if (dirIndexRels.get(`${tag}\n${dir}`) === rel) return dirUrlPath(dir, tag);
    return pageOutPath(rel);
  }

  // 見出しへのリンク(page.md#見出し・#見出し)の確認用。描画しながらリンクを集め、
  // すべてのページを描画した後に、リンク先のページにその id があるかを調べる。
  const anchorRefs = []; // { from, target, frag }
  const pageIds = new Map(); // rel -> Set<id>
  function pageRelOfLink(fromRel, href) {
    if (href.startsWith("#")) return fromRel;
    const resolved = resolveRepoRel(fromRel, href);
    if (resolved.rejected) return null;
    const bare = resolved.repoRel.replace(/\/+$/, "");
    const fromLang = visitedMd.has(fromRel) ? i18n.langOf(fromRel) : i18n.base;
    if (bare === "" || bare === ".") return rootOfLang(fromLang) ?? siteRootRel;
    // 使わなかったファイル(印の無い方・重複)へのリンクは、代わりに使うファイルの見出しで調べる
    if (isMarkdownPath(bare)) return keptRelOf(bare);
    if (linkTargets.get(bare)?.kind === "dir") return dirIndexFor(bare, fromLang)?.rel ?? null;
    return null;
  }
  function noteAnchor(fromRel, href) {
    const hashIdx = href.indexOf("#");
    if (hashIdx < 0) return;
    const frag = href.slice(hashIdx + 1);
    if (!frag || frag === "top") return;
    const target = pageRelOfLink(fromRel, href);
    if (target && (visitedMd.has(target) || target === fromRel)) anchorRefs.push({ from: fromRel, target, frag });
  }
  function collectIds(rel, html) {
    const unescape = (v) =>
      v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const ids = new Set(["tsuzuri-main"]);
    for (const m of html.matchAll(/\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) ids.add(unescape(m[1] ?? m[2]));
    pageIds.set(rel, ids);
  }

  // Markdown の画像に付ける width・height(リポジトリ内の画像で、大きさを読み取れたときだけ)
  const imageSizeCache = new Map();
  function imageSizeAttrs(fromRel, href) {
    const resolved = resolveRepoRel(fromRel, href);
    if (resolved.rejected) return "";
    const repoRel = resolved.repoRel;
    if (!imageSizeCache.has(repoRel)) {
      let size = null;
      const abs = resolveInsideRepo(REPO_ROOT, repoRel);
      if (abs && isImagePath(repoRel) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        size = imageSizeOf(fs.readFileSync(abs), path.extname(repoRel).toLowerCase());
      }
      imageSizeCache.set(repoRel, size);
    }
    const size = imageSizeCache.get(repoRel);
    return size ? ` width="${size.width}" height="${size.height}"` : "";
  }

  // ページのCSSは、内容ごとに1つのファイル(tsuzuri-<内容のハッシュ>.css)に書き出して <link> で読み込む。
  // 全ページで同じファイルを使うのでブラウザのキャッシュが効き、内容が変わればファイル名も変わる。
  // (ページごとに theme・styleFile を変えたページは、その組み合わせのファイルを使う)
  const stylesheets = new Map(); // css -> href
  function stylesheetFor(css) {
    if (!stylesheets.has(css)) {
      const name = `tsuzuri-${createHash("sha256").update(css).digest("hex").slice(0, 10)}.css`;
      fs.writeFileSync(path.join(OUT_DIR, name), css);
      writtenBy.set(name, "(Tsuzuri が生成するファイル)");
      stylesheets.set(css, `${config.basePath}/${name}`);
    }
    return stylesheets.get(css);
  }

  // 本文の最初の(文字のある)段落を、説明文(meta description)用に短くする。
  // 注意書きの見出し(「補足」など)や、バッジ・画像だけの段落は使わない。
  let copyScriptUsed = false;
  function descriptionFromHtml(html) {
    for (const m of html.matchAll(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi)) {
      if (/markdown-alert-title/.test(m[1] ?? "")) continue;
      // 画像は代わりのテキスト(alt)にする
      const withAlt = m[2].replace(/<img\b[^>]*?\balt="([^"]*)"[^>]*>/gi, "$1");
      const text = htmlToText(withAlt).replace(/\s+/g, " ").trim();
      if (text) return text.length > 120 ? `${text.slice(0, 119)}…` : text;
    }
    return "";
  }

  // 1ページ分のHTMLを組み立てる。
  function renderPage(rel, content, meta, { canonical = true, extraHeadHtml = "" } = {}) {
    // ページの言語(集めたページ以外の 404 などは基本言語)で、文言・ナビ・前後・検索を選ぶ
    const pageLang = visitedMd.has(rel) ? i18n.langOf(rel) : i18n.base;
    const site = langSites.get(pageLang);
    const S = site.strings;
    const md = markedFor(pageLang);
    // marked v13以降のレンダラーAPI: 各メソッドは引数としてトークン(オブジェクト)を1つ受け取る。
    // リンクの表示テキストや見出しはインライン要素(強調・コード等)を含みうるため、
    // this.parser.parseInline(tokens) でHTMLにする(this を使うためアロー関数にしない)。
    const renderer = new md.Renderer();
    const linkHref = (fromRel, href) => {
      noteAnchor(fromRel, href);
      return siteHref(fromRel, href);
    };
    renderer.link = function ({ href, title, tokens }) {
      const newHref = linkHref(rel, href);
      const text = this.parser.parseInline(tokens);
      return `<a href="${escapeHtml(newHref)}"${title ? ` title="${escapeHtml(title)}"` : ""}>${text}</a>`;
    };
    // 画像は画面に入るまで読み込まない(loading="lazy")。ページの表示を速くするため。
    renderer.image = function ({ href, title, text }) {
      const newHref = siteHref(rel, href);
      return `<img src="${escapeHtml(newHref)}" alt="${escapeHtml(text || "")}"${
        title ? ` title="${escapeHtml(title)}"` : ""
      }${imageSizeAttrs(rel, href)} loading="lazy" decoding="async">`;
    };
    // 生のHTML(<a href>・<img src>)のリンク先も書き換える。marked はコードの中身を html トークンに
    // しないので、コードブロック・インラインコードに書いたHTMLの例は書き換わらない。
    renderer.html = function ({ text }) {
      return preprocessRawHtmlPaths(text, rel, config.basePath, linkHref);
    };
    // GitHub の注意書き(> [!NOTE] など)を、種類ごとの枠として表示する。
    renderer.blockquote = function ({ tokens }) {
      const inner = this.parser.parse(tokens);
      return renderAlert(inner, S.alerts) ?? `<blockquote>\n${inner}</blockquote>\n`;
    };
    // コードブロックは、言語名が書かれていて highlight.js が対応している場合だけ、ビルド時に
    // 色分けしたHTMLにする(閲覧時にJavaScriptは不要)。言語の自動判定は誤判定を避けるため行わない。
    let hasMermaid = false;
    let hasCode = false;
    renderer.code = function ({ text, lang }) {
      const language = (lang || "").trim().split(/\s+/)[0];
      // mermaid の図は、閲覧時に mermaid のスクリプトが <pre class="mermaid"> を図に変換する
      if (language === "mermaid") {
        hasMermaid = true;
        return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
      }
      hasCode = true;
      if (language && hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}\n</code></pre>\n`;
      }
      const cls = language ? ` class="language-${escapeHtml(language)}"` : "";
      return `<pre><code${cls}>${escapeHtml(text)}\n</code></pre>\n`;
    };
    // 見出しに GitHub と同じ規則の id を付け、`page.md#見出し` のリンクで飛べるようにする。
    // h2 以下には、その見出しへのリンク(#)を付ける(カーソルを当てると表示。base.css)。
    // 目次用に h2・h3 を集めておく。
    const slugger = createSlugger();
    const headings = [];
    let firstH1 = ""; // ページタイトルの候補(最初の h1 の表示テキスト。Markdown の記号は含まない)
    renderer.heading = function ({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const text = htmlToText(inner);
      if (depth === 1 && !firstH1) firstH1 = text.trim();
      const id = slugger.slug(text);
      if (!id) return `<h${depth}>${inner}</h${depth}>\n`;
      if (depth === 2 || depth === 3) headings.push({ depth, id, text });
      const anchor =
        depth >= 2
          ? `<a class="tsuzuri-anchor" href="#${escapeHtml(id)}" aria-label="${escapeHtml(
              formatUi(S.anchorLabel, { text })
            )}">#</a>`
          : "";
      return `<h${depth} id="${escapeHtml(id)}">${inner}${anchor}</h${depth}>\n`;
    };

    let bodyHtml = removeCjkLineBreaks(md.parse(content, { renderer }));
    collectIds(rel, bodyHtml);
    const autoDescription = descriptionFromHtml(bodyHtml);
    // タイトル: frontmatter の title > 最初の h1 の表示テキスト > (起点のページなら)サイト名 > ファイルパス。
    // ナビの表示名と同じ優先順。h1 は描画した見出し、無ければ crawler が集めた h1(生のHTMLの <h1> を含む)。
    // (コードブロック内の "# コメント" は見出しにならないので、誤って拾わない)
    const title =
      (typeof meta.title === "string" && meta.title) ||
      firstH1 ||
      visitedMd.get(rel)?.h1 ||
      (isLangRoot(rel) && config.siteName) ||
      rel;
    if (site.search && visitedMd.has(rel)) {
      site.searchPages.push({ title, url: `${config.basePath}/${urlPathOf(rel)}`, html: bodyHtml });
    }
    // ページ内の目次(NAV_ENABLED=true で、h2・h3 が3つ以上あるページ。frontmatter の toc: false で消せる)
    if (config.navEnabled && String(meta.toc).trim() !== "false" && headings.length >= 3) {
      const toc = renderToc(headings, S.toc);
      const h1End = bodyHtml.indexOf("</h1>");
      bodyHtml = h1End >= 0 ? bodyHtml.slice(0, h1End + 5) + "\n" + toc + bodyHtml.slice(h1End + 5) : toc + bodyHtml;
    }
    const updated = visitedMd.has(rel) ? lastUpdatedOf(rel) : "";
    if (updated) {
      bodyHtml += `<p class="tsuzuri-updated">${S.lastUpdated}: <time datetime="${escapeHtml(
        updated
      )}">${escapeHtml(updated)}</time></p>\n`;
    }
    if (hasMermaid) bodyHtml += MERMAID_SCRIPT;
    if (hasCode) {
      copyScriptUsed = true;
      bodyHtml += `<script src="${escapeHtml(`${config.basePath}/${COPY_SCRIPT_NAME}`)}" defer></script>\n`;
    }
    if (config.navEnabled && site.orderIndex.has(rel)) {
      const i = site.orderIndex.get(rel);
      const pagerLabels = { prev: S.pagerPrev, next: S.pagerNext, nav: S.pagerNav };
      bodyHtml += renderPager(site.order[i - 1] ?? null, site.order[i + 1] ?? null, config.basePath, pagerLabels, {
        hrefFor,
      });
    }

    // 言語切り替え(多言語の、集めたページだけ。404 には出さない)。翻訳が無い言語はその言語のトップへ、
    // トップも無い言語は出さない(renderLangSwitch が href の空の言語を除く)
    const alts = i18n.enabled && visitedMd.has(rel) ? tIndex.alternatesOf(rel) : new Map();
    let langSwitch = "";
    if (alts.size > 0) {
      const entries = i18n.languages.map((tag) => {
        if (alts.has(tag)) return { tag, href: `${config.basePath}/${urlPathOf(alts.get(tag))}`, untranslated: false };
        const root = rootOfLang(tag);
        return { tag, href: root ? `${config.basePath}/${urlPathOf(root)}` : "", untranslated: true };
      });
      langSwitch = renderLangSwitch({
        current: pageLang,
        entries,
        strings: S,
        placement: config.navEnabled ? "nav" : "bar",
      });
    }

    const navHtml = config.navEnabled
      ? renderNav(site.tree, rel, config.basePath, config.siteName, S.menu, site.search, S.navLabel, {
          hrefFor,
          langSwitchHtml: langSwitch,
        })
      : "";

    // SEOメタタグは「出力すべき情報が何もない」場合は metaTagsHtml="" のままとし、
    // pageTemplate の回帰テスト(navHtml=""・metaTagsHtml=""での完全一致)と
    // 整合させる(renderMetaTags は呼べば常に og:title/og:type を出力するため、
    // 何も設定されていないベースライン構成では意図的に呼び出し自体をスキップする)。
    // description が無いページは、本文の最初の段落から作る(検索結果・SNSでの説明文に使われる)
    const description = (typeof meta.description === "string" && meta.description) || autoDescription;
    const ogImage = meta.ogImage
      ? resolveOgImage(meta.ogImage, rel)
      : resolveOgImage(config.ogDefaultImage, siteRootRel);
    const ogType = meta.ogType || "website";
    const canonicalUrl =
      canonical && config.siteOrigin
        ? `${config.siteOrigin}${config.basePath}/${urlPathOf(rel)}`
        : "";
    const noindex = meta.noindex === true;

    // hreflang(多言語で SITE_ORIGIN があり、404・noindex でないページ)。noindex でない言語版が2つ以上のときだけ、
    // languages の順に並べ、基本言語版があれば x-default にする
    const alternates = [];
    if (alts.size > 0 && config.siteOrigin && canonical && !noindex) {
      const indexed = [...alts].filter(([, altRel]) => visitedMd.get(altRel)?.meta?.noindex !== true);
      if (indexed.length >= 2) {
        const urlOf = (altRel) => `${config.siteOrigin}${config.basePath}/${urlPathOf(altRel)}`;
        for (const [tag, altRel] of indexed) alternates.push({ hreflang: tag, href: urlOf(altRel) });
        const baseAlt = indexed.find(([tag]) => tag === i18n.base);
        if (baseAlt) alternates.push({ hreflang: "x-default", href: urlOf(baseAlt[1]) });
      }
    }

    const siteName = config.siteName;
    const hasMetaTags = Boolean(
      description || ogImage || canonicalUrl || noindex || faviconHref || siteName || alternates.length > 0
    );
    const metaTagsHtml = hasMetaTags
      ? renderMetaTags({
          description,
          ogTitle: title,
          ogImage,
          ogType,
          canonicalUrl,
          noindex,
          faviconHref,
          siteName,
          alternates,
        })
      : "";

    const pageStyle = resolveCustomStyleForPage(rel, meta.styleFile);
    const css = composeCss({
      baseCss,
      themeCss: resolveThemeCssForPage(rel, meta.theme),
      customCss: pageStyle.css,
      styleFileRel: pageStyle.rel,
    });
    return pageTemplate({
      title,
      body: bodyHtml,
      stylesheetHref: stylesheetFor(css),
      // ナビがあるページは、ライト/ダークの切り替えを使う(前に選んだ表示を、表示される前に反映する)
      headHtml: [
        config.navEnabled
          ? `${THEME_HEAD_SCRIPT}\n<script src="${escapeHtml(`${config.basePath}/${THEME_SCRIPT_NAME}`)}" defer></script>`
          : "",
        extraHeadHtml,
      ]
        .filter(Boolean)
        .join("\n"),
      lang: pageLang,
      navHtml,
      metaTagsHtml,
      skipLabel: S.skip,
      langBarHtml: config.navEnabled ? "" : langSwitch,
    });
  }

  // repoRel はリポジトリ内でのパス(outputRelOf で出力先のパスにする)。source は重複の報告用
  function writeOut(repoRel, html, source) {
    const outRel = outputRelOf(repoRel);
    const prev = writtenBy.get(outRel);
    if (prev && prev !== source) {
      console.warn(`[build-docs] 出力先 ${outRel} が重複しています(${prev} と ${source})。後の ${source} で上書きします。`);
      collisions.push(`${outRel} (${prev} と ${source})`);
    }
    writtenBy.set(outRel, source);
    const outAbs = path.join(OUT_DIR, outRel);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, html);
  }

  for (const [rel, { content, meta }] of visitedMd.entries()) {
    const html = renderPage(rel, content, meta);
    const tag = i18n.langOf(rel);
    const prefix = i18n.prefixOf(tag);
    writeOut(i18n.outputHtmlRel(rel), html, rel);
    if (isLangRoot(rel)) writeOut(prefix ? `${prefix}/index.html` : "index.html", html, rel);
    const dir = path.posix.dirname(rel);
    if (dirIndexRels.get(`${tag}\n${dir}`) === rel) writeOut(`${prefix ? `${prefix}/` : ""}${dir}/index.html`, html, rel);
  }

  // ---------- 7.5 404ページ ----------
  // GitHub Pages は存在しないURLへのアクセスに 404.html を返す。リポジトリ直下に 404.md が
  // あればそれを、無ければ既定の内容で作る(ナビ・テーマは通常のページと同じ)。
  // 基本言語の印付き(404.en.md など)があれば、404.md より優先する(他のページと同じ決まり)。
  // 404.md がどこかからリンクされていて既に 404.html として出力済みなら何もしない。
  // 多言語で 404.md が無いときは、トップのある言語ごとの案内を並べる(基本言語が先頭)。
  if (![...visitedMd.keys()].some((rel) => i18n.outputHtmlRel(rel) === "404.html")) {
    let notFoundRel = "404.md";
    let rootNames = [];
    try {
      rootNames = fs.readdirSync(REPO_ROOT);
    } catch {
      // 読めなければ 404.md だけを見る
    }
    const markedNotFound = rootNames
      .filter((name) => i18n.isVariantName(name, "404.md", i18n.base))
      .sort()
      .find((name) => fs.statSync(path.join(REPO_ROOT, name), { throwIfNoEntry: false })?.isFile());
    if (markedNotFound) notFoundRel = markedNotFound;
    const notFoundAbs = resolveInsideRepo(REPO_ROOT, notFoundRel);
    let raw;
    if (notFoundAbs && fs.existsSync(notFoundAbs)) {
      raw = fs.readFileSync(notFoundAbs, "utf-8");
    } else if (i18n.enabled) {
      const sections = i18n.languages
        .filter((tag) => rootOfLang(tag))
        .map((tag) => ({ tag, homeHref: i18n.prefixOf(tag) ? `/${i18n.prefixOf(tag)}/` : "/" }));
      raw = defaultNotFoundMarkdown(i18n.base, { sections });
    } else {
      raw = defaultNotFoundMarkdown(i18n.base);
    }
    const { meta, body } = parseFrontmatter(raw);
    // 404.md はクロールの対象外なので、中で使っている画像・ファイルはここで出力の対象に加える
    for (const href of extractLinks(body)) {
      const resolved = resolveRepoRel(notFoundRel, href);
      if (resolved.rejected) continue;
      if (isImagePath(resolved.repoRel)) imageSet.add(resolved.repoRel);
      else if (isLinkedFilePath(resolved.repoRel)) fileSet.add(resolved.repoRel);
    }
    writeOut(
      "404.html",
      renderPage(notFoundRel, body, { ...meta, noindex: true }, {
        canonical: false,
        // 多言語では、開かれたURLの言語の案内(<div lang="…">)だけを見せる
        extraHeadHtml: i18n.enabled
          ? notFoundLangScript({
              languages: i18n.languages,
              base: i18n.base,
              prefixOf: (tag) => i18n.prefixOf(tag),
              basePath: config.basePath,
            })
          : "",
      }),
      notFoundRel
    );
  }

  // ---------- 7.55 コードブロックのコピーボタンのスクリプト(コードブロックがあるページが読み込む) ----------
  if (copyScriptUsed) {
    fs.writeFileSync(path.join(OUT_DIR, COPY_SCRIPT_NAME), COPY_SCRIPT);
    writtenBy.set(COPY_SCRIPT_NAME, "(Tsuzuri が生成するファイル)");
  }

  // ---------- 7.6 サイト内検索の索引・スクリプト(NAV_ENABLED=true のとき) ----------
  // 索引は言語ごと(基本言語は search-index.json、他は <prefix>/search-index.json)
  if (config.navEnabled) {
    for (const site of langSites.values()) {
      const indexRel = `${site.prefix ? `${site.prefix}/` : ""}search-index.json`;
      fs.mkdirSync(path.dirname(path.join(OUT_DIR, indexRel)), { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, indexRel), JSON.stringify(buildSearchIndex(site.searchPages)));
    }
    fs.writeFileSync(path.join(OUT_DIR, "tsuzuri-search.js"), SEARCH_SCRIPT);
    fs.writeFileSync(path.join(OUT_DIR, THEME_SCRIPT_NAME), THEME_SCRIPT);
  }

  // ---------- 7.7 見出しへのリンクの確認 ----------
  const missingAnchors = [];
  for (const { from, target, frag } of anchorRefs) {
    let id = frag;
    try {
      id = decodeURIComponent(frag);
    } catch {
      // デコードできなければそのまま比べる
    }
    const ids = pageIds.get(target);
    if (ids && !ids.has(id) && !ids.has(frag)) missingAnchors.push(`${target}#${id} (referenced from ${from})`);
  }
  if (missingAnchors.length) {
    console.warn(`リンク先のページに見出しが見つからないリンク: ${missingAnchors.length} 件`);
    for (const a of missingAnchors) console.warn(`  - ${a}`);
  }

  // ---------- 8. 画像・その他のリンク先ファイルのコピー ----------
  const missingAssets = [];
  for (const assetRel of new Set([...imageSet, ...fileSet, ...ogImageSet])) {
    const src = resolveInsideRepo(REPO_ROOT, assetRel);
    if (!src) {
      console.warn(`リポジトリの外を指しているためコピーしません: ${assetRel}`);
      missingAssets.push(assetRel);
      continue;
    }
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      console.warn(`リンク先のファイルが見つかりません: ${assetRel}`);
      missingAssets.push(assetRel);
      continue;
    }
    const outRel = outputRelOf(assetRel);
    const prev = writtenBy.get(outRel);
    if (prev && prev !== assetRel && !(outRel === faviconOutRel && src === faviconAbs)) {
      console.warn(
        `[build-docs] リンクされた ${assetRel} は、出力先が ${prev} と重なるためコピーしません(生成したファイルを上書きしないため)。`
      );
      collisions.push(`${outRel} (${prev} と ${assetRel})`);
      continue;
    }
    writtenBy.set(outRel, assetRel);
    const dest = path.join(OUT_DIR, outRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  // ---------- 8.5 sitemap.xml / robots.txt(検索エンジン向け) ----------
  // 公開URLが分かる(SITE_ORIGIN がある)ときだけ出力する。noindex のページは含めない。
  if (config.siteOrigin) {
    const urls = [...visitedMd.entries()]
      .filter(([, { meta }]) => meta.noindex !== true)
      .map(([rel]) => ({
        loc: `${config.siteOrigin}${config.basePath}/${urlPathOf(rel)}`,
        lastmod: lastUpdatedOf(rel) || undefined,
      }));
    fs.writeFileSync(path.join(OUT_DIR, "sitemap.xml"), buildSitemapXml(urls));
    // robots.txt はドメイン直下にしか置けないため、サイトがドメイン直下にあるときだけ作る
    if (!config.basePath) {
      fs.writeFileSync(
        path.join(OUT_DIR, "robots.txt"),
        `User-agent: *\nAllow: /\n\nSitemap: ${config.siteOrigin}/sitemap.xml\n`
      );
    }
  }

  // ---------- 9. sitemap.json 書き込み(SITEMAP_JSON=true のときだけ) ----------
  // 出力先に置くと公開サイトに含まれ、リンク切れ・拒否したリンクのパスまで外から見えてしまうため、
  // 既定では書き出さない(リンクの問題はビルドログに出力済み)。
  if (config.sitemapJson) {
    const sitemap = buildSitemap({
      root: siteRootRel,
      basePath: config.basePath,
      styleFile: config.styleFile,
      customStyleApplied: Boolean(customCss),
      visitedMd,
      imageSet,
      fileSet,
      hierarchy,
      // tree は基本言語のナビの木(1言語では今と同じ)。多言語では言語ごとの木を trees にも入れる
      tree: langSites.get(i18n.base).tree,
      missing,
      rejected,
      lang: i18n.base,
      siteName: config.siteName,
      siteOrigin: config.siteOrigin,
      customDomain: config.customDomain,
      theme: config.theme,
      ...(i18n.enabled
        ? {
            languages: [...i18n.languages],
            langOf: (rel) => i18n.langOf(rel),
            trees: Object.fromEntries([...langSites].map(([tag, site]) => [tag, site.tree])),
          }
        : {}),
    });
    fs.writeFileSync(path.join(OUT_DIR, "sitemap.json"), JSON.stringify(sitemap, null, 2));
  }

  // ---------- 使わなかったファイル(情報。警告・STRICT_LINKS の対象にしない) ----------
  // crawler の置き換えには、印の無いファイルが実在しないもの(c.md へのリンク → c.en.md)も入るので、
  // 実在するものだけを出す
  // 多言語では、翻訳集め・入口探しで印付きを選んだため読まなかった印の無いファイル(docs/a.md など)も出す
  const notUsed = new Map();
  const markedBasePairs = [...visitedMd.keys()]
    .filter((rel) => i18n.markerOf(rel) === i18n.base)
    .map((rel) => [i18n.baseRelOf(rel), rel]);
  for (const [rel, keptRel] of [
    ...crawl.shadowed,
    ...tIndex.shadowed.map((e) => [e.rel, e.keptRel]),
    ...markedBasePairs,
  ]) {
    if (notUsed.has(rel) || visitedMd.has(rel)) continue;
    const abs = resolveInsideRepo(REPO_ROOT, rel);
    if (abs && fs.existsSync(abs)) notUsed.set(rel, keptRel);
  }
  if (notUsed.size) {
    console.log(
      `Not used (a marked base-language file is used instead): ${[...notUsed]
        .map(([rel, keptRel]) => `${rel} → ${keptRel}`)
        .join(", ")}`
    );
  }

  // ---------- STRICT_LINKS ----------
  // リンク切れ・拒否したリンクがあればビルドを失敗させる(ワークフローはここで止まり公開されない)。
  if (config.strictLinks) {
    const problems = [
      ...missing.map((m) => `リンク先が見つかりません: ${m.rel} (referenced from ${m.referencedFrom})`),
      ...rejected.map((r) => `拒否したリンク: ${r.rel} (referenced from ${r.referencedFrom}, reason: ${r.reason})`),
      ...missingAssets.map((a) => `コピーできなかったファイル: ${a}`),
      ...collisions.map((c) => `出力先の重複: ${c}`),
      ...missingAnchors.map((a) => `見出しが見つかりません: ${a}`),
      ...tIndex.excluded.map((e) => `翻訳の重複: ${e.rel}(${e.keptRel} を使用)`),
    ];
    if (problems.length) {
      console.error(`STRICT_LINKS=true のため、リンクの問題 ${problems.length} 件でビルドを失敗させます。`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
  }

  console.log(`Build complete. Output -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("ビルド中に予期しないエラーが発生しました:", err.message);
  process.exit(1);
});
