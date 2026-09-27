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
 *   8. 各ページの HTML 生成ループ
 *   9. 画像コピー
 *   10. sitemap.buildSitemap() 書き込み
 *   11. 完了ログ
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
import { marked } from "marked";

import { loadConfig, ALLOWED_THEMES } from "./lib/config.mjs";
import { crawlSite } from "./lib/crawler.mjs";
import { toSiteAbsHref, resolveInsideRepo } from "./lib/path-utils.mjs";
import {
  escapeHtml,
  renderTitle,
  renderNav,
  renderMetaTags,
  preprocessRawHtmlPaths,
  pageTemplate,
} from "./lib/html-renderer.mjs";
import { buildSitemap } from "./lib/sitemap.mjs";
import { buildSiteTree } from "./lib/site-tree.mjs";

async function main() {
  const REPO_ROOT = process.cwd();
  const config = loadConfig(process.env);
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
  if (!fs.existsSync(rootMdAbs)) {
    console.error(`起点となる ${config.rootMd} が見つかりません。処理を中止します。`);
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
  const pageThemeCssCache = new Map(); // "builtin:wa" | "path:styles/custom.css" -> css文字列
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
  const { visitedMd, imageSet, hierarchy, missing, rejected } = crawlSite({
    repoRoot: REPO_ROOT,
    rootRel: config.rootMd,
  });

  console.log(`Markdown files mapped: ${visitedMd.size}`);
  console.log(`Image resources mapped: ${imageSet.size}`);
  console.log(`Base path: "${config.basePath || "(none)"}"`);
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
      console.warn(`Custom style file not found (${config.styleFile}); using default style.`);
    }
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
      faviconOutRel = path.relative(REPO_ROOT, faviconAbs).split(path.sep).join("/");
      faviconHref = `${config.basePath}/${faviconOutRel}`;
    } else {
      console.warn(`Favicon file not found (${config.faviconFile}); skipping <link rel="icon">.`);
    }
  }

  // ---------- 6. 出力ディレクトリ準備 ----------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, ".nojekyll"), "");

  if (config.customDomain) {
    fs.writeFileSync(path.join(OUT_DIR, "CNAME"), `${config.customDomain}\n`);
  }

  if (faviconHref) {
    const faviconDestAbs = path.join(OUT_DIR, faviconOutRel);
    fs.mkdirSync(path.dirname(faviconDestAbs), { recursive: true });
    fs.copyFileSync(faviconAbs, faviconDestAbs);
  }

  // ---------- 7. HTML 変換 ----------
  marked.setOptions({ gfm: true, breaks: false });

  // ナビゲーション・sitemap.json 用のサイトツリー(ディレクトリ階層)
  const siteTree = buildSiteTree(visitedMd.entries());

  for (const [rel, { content, meta }] of visitedMd.entries()) {
    // marked v13以降のレンダラーAPI: 各メソッドは引数としてトークン(オブジェクト)を1つ受け取る。
    // リンクの表示テキストはインライン要素(強調・コード等)を含みうるため、
    // this.parser.parseInline(tokens) でHTMLにする(this を使うためアロー関数にしない)。
    const renderer = new marked.Renderer();
    renderer.link = function ({ href, title, tokens }) {
      const newHref = toSiteAbsHref(rel, href, config.basePath);
      const text = this.parser.parseInline(tokens);
      return `<a href="${newHref}"${title ? ` title="${escapeHtml(title)}"` : ""}>${text}</a>`;
    };
    renderer.image = function ({ href, title, text }) {
      const newHref = toSiteAbsHref(rel, href, config.basePath);
      return `<img src="${newHref}" alt="${escapeHtml(text || "")}"${
        title ? ` title="${escapeHtml(title)}"` : ""
      }>`;
    };

    const preprocessed = preprocessRawHtmlPaths(content, rel, config.basePath);
    const bodyHtml = marked.parse(preprocessed, { renderer });
    const title = renderTitle(content, rel, meta.title);

    const navHtml = config.navEnabled
      ? renderNav(siteTree, rel, config.basePath, config.siteName)
      : "";

    const outRel = rel.replace(/\.md$/i, ".html");

    // SEOメタタグは「出力すべき情報が何もない」場合は metaTagsHtml="" のままとし、
    // pageTemplate の回帰テスト(navHtml=""・metaTagsHtml=""での完全一致)と
    // 整合させる(renderMetaTags は呼べば常に og:title/og:type を出力するため、
    // 何も設定されていないベースライン構成では意図的に呼び出し自体をスキップする)。
    const description = meta.description || "";
    const ogImage = meta.ogImage || config.ogDefaultImage || "";
    const ogType = meta.ogType || "website";
    const canonicalUrl = config.siteOrigin
      ? `${config.siteOrigin}${config.basePath}/${outRel}`
      : "";
    const noindex = meta.noindex === true;

    const siteName = config.siteName;
    const hasMetaTags = Boolean(
      description || ogImage || canonicalUrl || noindex || faviconHref || siteName
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
        })
      : "";

    const html = pageTemplate({
      title,
      body: bodyHtml,
      baseCss,
      themeCss: resolveThemeCssForPage(rel, meta.theme),
      customCss,
      styleFileRel: config.styleFile,
      lang: config.lang,
      navHtml,
      metaTagsHtml,
    });

    const outAbs = path.join(OUT_DIR, outRel);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, html);

    if (rel === config.rootMd) {
      fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
    }
  }

  // ---------- 8. 画像コピー ----------
  for (const imgRel of imageSet) {
    const src = resolveInsideRepo(REPO_ROOT, imgRel);
    if (!src) {
      console.warn(`リポジトリの外を指しているため画像をコピーしません: ${imgRel}`);
      continue;
    }
    if (!fs.existsSync(src)) {
      console.warn(`画像が見つかりません: ${imgRel}`);
      continue;
    }
    const dest = path.join(OUT_DIR, imgRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  // ---------- 9. sitemap.json 書き込み ----------
  const sitemap = buildSitemap({
    root: config.rootMd,
    basePath: config.basePath,
    styleFile: config.styleFile,
    customStyleApplied: Boolean(customCss),
    visitedMd,
    imageSet,
    hierarchy,
    tree: siteTree,
    missing,
    rejected,
    lang: config.lang,
    siteName: config.siteName,
    siteOrigin: config.siteOrigin,
    customDomain: config.customDomain,
    theme: config.theme,
  });
  fs.writeFileSync(path.join(OUT_DIR, "sitemap.json"), JSON.stringify(sitemap, null, 2));

  console.log(`Build complete. Output -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("ビルド中に予期しないエラーが発生しました:", err.message);
  process.exit(1);
});
