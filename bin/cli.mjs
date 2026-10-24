#!/usr/bin/env node
// npx github:akilasatolu/tsuzuri [init] のエントリーポイント。
// 利用者リポジトリに配布用ファイル(tsuzuri-pages.yml / .github/tsuzuri/config /
// 独自CSSの空ひな形 custom.css)に加えて、ビルドスクリプト本体
// (build-docs.mjs / lib/*.mjs / styles/*.css)一式を `.github/tsuzuri/` 配下に
// コピー(ベンダリング)する。これにより、生成後のワークフローは実行のたびに
// OSS本体リポジトリ(tsuzuri)を参照する必要がなくなり、利用者リポジトリの中だけで
// ビルド・デプロイが完結する。
//
// 追加の npm 依存は使わない(Node.js の標準モジュールだけを使う)。

import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { runPreview } from "./preview.mjs";
import { t, setCliLang, detectLangFromArgv, isCliLang } from "./messages.mjs";
import {
  LANG_TAG_RE,
  resolveLanguages,
  ALLOWED_THEMES,
  VENDOR_DIR,
  WORKFLOW_PATH,
  CONFIG_FILE_PATH,
} from "../.github/scripts/lib/config.mjs";

// 実リポジトリ作成時に確定させる固定値。
// 「今動いているセットアップコマンド自体がどのバージョンか」を利用者に案内する際や、
// アップデート手順の案内文に埋め込む(生成されるワークフロー自体はもう
// このリポジトリを参照しないため、@v1のような`uses:`の埋め込みには使わない)。
export const OSS_REPO = "akilasatolu/tsuzuri";

// このファイル(bin/cli.mjs)自身が置かれているパッケージのルートディレクトリ。
// `npx github:akilasatolu/tsuzuri init` 実行時は、npxが一時的にcloneした
// tsuzuriリポジトリ自身がここに当たるため、ここを起点に
// `.github/scripts/`・`styles/`配下の実ファイルをそのまま利用者側へコピーできる。
export const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// 利用者リポジトリ側でビルドスクリプト一式を配置するディレクトリ(.github/tsuzuri)。
// 利用者が独自に使っている可能性のある `.github/scripts/` と衝突しないよう、
// tsuzuri専用の名前空間を切っている。値は lib/config.mjs で定義し、ここから再 export する。
export { VENDOR_DIR };

// 利用者向けドキュメント(tsuzuri 自身で公開しているサイト)のURL。生成するファイルの案内に使う。
export const DOCS_URL = "https://akilasatolu.github.io/tsuzuri/";

// init が生成するワークフローのひな形(PACKAGE_ROOT からの相対パス)。
export const WORKFLOW_TEMPLATE_PATH = "templates/.github/workflows/tsuzuri-pages.yml";

// THEME選択肢(番号選択、1始まり。順番は ALLOWED_THEMES の順)。
// 説明(label)は bin/messages.mjs の "theme.<key>"。言語は実行時に決まるので、読み出すたびに引く。
// テーマを足すときは、lib/config.mjs の ALLOWED_THEMES と messages.mjs の両方(en・ja)に足す。
export const THEME_CHOICES = ALLOWED_THEMES.map((key) => ({
  key,
  get label() {
    return t(`theme.${key}`);
  },
}));

const DEFAULT_ANSWERS = {
  triggerBranch: "main",
  rootMd: "README.md",
  theme: "material",
  // ナビ(サイドバー・検索・目次・前後のページ)は、新しく作るときは表示する
  navEnabled: true,
  // サイトの言語(LANGUAGES)。カンマ区切りで、先頭が基本言語
  languages: "en",
  // 空ならビルド時にリポジトリ名になる
  siteName: "",
};

/**
 * package.json の devDependencies から、ビルド用パッケージ(marked など)のバージョンを返す。
 * 利用者に配る、ビルド用の依存の package.json・package-lock.json の完成品を組み立てる
 * (buildBuildLockfiles。scripts/build-lockfiles.mjs が使う)ときに使う。
 *
 * 範囲指定ではなく "12.0.2" のような完全一致で書かれている前提で、その値をそのまま使うことで、
 * テストで使っている版と利用者に配る版を常に一致させる。
 *
 * @param {string} name - パッケージ名
 * @param {string} [packageRoot] - 既定は`PACKAGE_ROOT`。テスト時に差し替え可能にするため引数化している。
 * @param {{readFileSync}} [fsImpl] - テスト用差し替え
 * @returns {string}
 */
export function readDependencyVersion(name, packageRoot = PACKAGE_ROOT, fsImpl = { readFileSync }) {
  const pkg = JSON.parse(fsImpl.readFileSync(join(packageRoot, "package.json"), "utf-8"));
  const version = pkg.devDependencies?.[name];
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `devDependencies.${name} in package.json must be an exact version such as "12.0.2" (current: ${version})`,
    );
  }
  return version;
}

// 利用者に配る、ビルド用の依存の package.json・package-lock.json の完成品に入れるパッケージ
// (利用者側のワークフローが npm ci でインストールする)。
// バージョンは package.json の devDependencies(完全一致)から読む。
export const BUILD_DEPENDENCIES = ["marked", "highlight.js", "marked-footnote"];

// ビルド用の依存を入れる package.json の名前(${VENDOR_DIR}/package.json)
const BUILD_PACKAGE_NAME = "tsuzuri-build";

// ビルド用の依存の package.json・package-lock.json の完成品を置くディレクトリ(PACKAGE_ROOT からの相対パス)。
// npm はパッケージを作るときにルートの package-lock.json を必ず外すので、
// `npx github:akilasatolu/tsuzuri init` の取得物には本体の lockfile が入らない。
// そのため、本体の lockfile から組み立てた完成品をここにコミットしておき、init はこれをコピーする。
// 本体の lockfile を更新したら `node scripts/build-lockfiles.mjs` で作り直す(ずれるとテストが失敗する)。
export const BUILD_LOCKFILES_DIR = "templates/tsuzuri";

/**
 * ビルド用の依存(BUILD_DEPENDENCIES)だけを入れる package.json と package-lock.json を、このパッケージの
 * package-lock.json から組み立てる。利用者のワークフローはこれを `npm ci` でインストールするので、
 * ダウンロードした中身のハッシュ(integrity)が lockfile と違えばインストールが止まる。
 * 依存がさらに依存しているパッケージも含める。package-lock.json が無ければ null。
 * @param {string} [packageRoot]
 * @param {{ existsSync, readFileSync }} [fsImpl]
 * @returns {{ packageJson: string, packageLock: string } | null}
 */
export function buildBuildLockfiles(packageRoot = PACKAGE_ROOT, fsImpl = { existsSync, readFileSync }) {
  const lockAbs = join(packageRoot, "package-lock.json");
  if (!fsImpl.existsSync(lockAbs)) return null;
  const rootLock = JSON.parse(fsImpl.readFileSync(lockAbs, "utf-8"));
  const dependencies = Object.fromEntries(
    BUILD_DEPENDENCIES.map((name) => [name, readDependencyVersion(name, packageRoot, fsImpl)])
  );
  const packages = { "": { name: BUILD_PACKAGE_NAME, dependencies } };
  const queue = Object.keys(dependencies);
  while (queue.length) {
    const name = queue.shift();
    const key = `node_modules/${name}`;
    if (packages[key]) continue;
    const entry = rootLock.packages?.[key];
    if (!entry?.integrity) throw new Error(`package-lock.json has no integrity for ${name}`);
    // 本体では開発用の依存なので付いている dev の印は外す(利用者側では通常の依存)
    const copied = { ...entry };
    delete copied.dev;
    delete copied.devOptional;
    packages[key] = copied;
    queue.push(...Object.keys(entry.dependencies ?? {}));
  }
  const packageJson = {
    name: BUILD_PACKAGE_NAME,
    private: true,
    description: "Build dependencies of Tsuzuri (generated by init; do not edit)",
    dependencies,
  };
  const packageLock = { name: BUILD_PACKAGE_NAME, lockfileVersion: 3, requires: true, packages };
  return {
    packageJson: `${JSON.stringify(packageJson, null, 2)}\n`,
    packageLock: `${JSON.stringify(packageLock, null, 2)}\n`,
  };
}

/**
 * init が利用者側にコピーする、ビルド用の依存の package.json・package-lock.json の完成品
 * (BUILD_LOCKFILES_DIR)を読む。無ければ、壊れた取得物で init が中途半端に終わらないようエラーにする。
 * @param {string} [packageRoot]
 * @param {{ existsSync, readFileSync }} [fsImpl]
 * @returns {{ packageJson: string, packageLock: string }}
 */
export function readBuildLockfiles(packageRoot = PACKAGE_ROOT, fsImpl = { existsSync, readFileSync }) {
  const pkgAbs = join(packageRoot, BUILD_LOCKFILES_DIR, "package.json");
  const lockAbs = join(packageRoot, BUILD_LOCKFILES_DIR, "package-lock.json");
  if (!fsImpl.existsSync(pkgAbs) || !fsImpl.existsSync(lockAbs)) {
    throw new Error(t("error.lockfilesMissing", { dir: BUILD_LOCKFILES_DIR }));
  }
  return {
    packageJson: fsImpl.readFileSync(pkgAbs, "utf-8"),
    packageLock: fsImpl.readFileSync(lockAbs, "utf-8"),
  };
}

/**
 * バージョン("1.2.3")からメジャーバージョンのタグ("v1")を作る。
 * 利用者に案内する npx コマンドは、未リリースの main ではなくこのタグを指定する。
 * @param {string} version
 * @returns {string}
 */
export function majorTagOf(version) {
  return `v${String(version).split(".")[0]}`;
}

/**
 * tsuzuri 自身のバージョン(package.json の version)を返す。
 * 実行中の CLI がどの版かを表示するのに使う(npx のキャッシュで古い版が動いていないかの確認用)。
 *
 * @param {string} [packageRoot]
 * @param {{readFileSync}} [fsImpl]
 * @returns {string}
 */
export function readPackageVersion(packageRoot = PACKAGE_ROOT, fsImpl = { readFileSync }) {
  return JSON.parse(fsImpl.readFileSync(join(packageRoot, "package.json"), "utf-8")).version;
}

/**
 * tsuzuri-pages.yml の内容を組み立てる。
 *
 * 自己完結型のワークフロー。ビルドスクリプト本体(build-docs.mjs等)は `init` 実行時に
 * `${VENDOR_DIR}/` 配下へコピー済みであることが前提。
 * 本体は templates/.github/workflows/tsuzuri-pages.yml に置いたひな形で、ここでは
 * プレースホルダー(__OSS_REPO__ / __VENDOR_DIR__ / __TSUZURI_VERSION__ / __MAJOR_TAG__)を
 * 置き換えるだけ。
 * ひな形を独立したYAMLファイルにしているのは、中で使う actions のバージョンを
 * 本体のワークフローと同じ形で管理し、版がそろっているかをテストで確かめられるようにするため。
 *
 * @param {string} [packageRoot] - テスト時に差し替え可能にするため引数化している
 * @param {{readFileSync}} [fsImpl] - テスト用差し替え
 * @returns {string}
 */
export function buildDocsPagesYml(
  packageRoot = PACKAGE_ROOT,
  fsImpl = { readFileSync },
  { tsuzuriVersion = readPackageVersion(packageRoot, fsImpl) } = {},
) {
  const raw = fsImpl.readFileSync(join(packageRoot, WORKFLOW_TEMPLATE_PATH), "utf-8");
  const marker = "# --- template start ---\n";
  const markerIndex = raw.indexOf(marker);
  const template = markerIndex >= 0 ? raw.slice(markerIndex + marker.length) : raw;
  return template
    .replaceAll("__OSS_REPO__", OSS_REPO)
    .replaceAll("__VENDOR_DIR__", VENDOR_DIR)
    .replaceAll("__TSUZURI_VERSION__", tsuzuriVersion)
    .replaceAll("__MAJOR_TAG__", majorTagOf(tsuzuriVersion));
}

/**
 * 生成するワークフロー(tsuzuri-pages.yml)の生成対象({name, relPath, content})。
 * init と init --update の両方が使う。
 */
export function buildWorkflowTarget() {
  return { name: "tsuzuri-pages.yml", relPath: WORKFLOW_PATH, content: buildDocsPagesYml() };
}

/**
 * .github/tsuzuri/config の内容を組み立てる。
 * 対話結果(TRIGGER_BRANCH/ROOT_MD/THEME など)を埋め込み、
 * それ以外のキーはデフォルト値のまま出力する。
 */
export function buildDocsPagesConfig(answers) {
  const { triggerBranch, rootMd, theme, navEnabled, languages, siteName } = { ...DEFAULT_ANSWERS, ...answers };
  // コメントは bin/messages.mjs の "config.<名前>"(--lang に従う)。KEY=値 の行はここに1つだけ持つ
  const vars = { docs: DOCS_URL, vendorDir: VENDOR_DIR };
  const item = (name, line) => `${t(`config.${name}`, vars)}\n${line}`;
  const blocks = [
    t("config.header", vars),
    item("triggerBranch", `TRIGGER_BRANCH=${triggerBranch}`),
    item("rootMd", `ROOT_MD=${rootMd}`),
    item("outDir", "OUT_DIR=_site"),
    item("theme", `THEME=${theme}`),
    item("styleFile", "STYLE_FILE=custom.css"),
    item("languages", `LANGUAGES=${languages}`),
    item("navEnabled", `NAV_ENABLED=${navEnabled ? "true" : "false"}`),
    item("favicon", "FAVICON_FILE="),
    item("siteName", `SITE_NAME=${siteName}`),
    item("customDomain", "CUSTOM_DOMAIN="),
    item("ogp", "OGP_DEFAULT_IMAGE="),
    item("strictLinks", "STRICT_LINKS=false"),
    item("lastUpdated", "LAST_UPDATED=false"),
    item("editLink", "EDIT_LINK=false"),
    item("repoLink", "REPO_LINK=false"),
    item("repoVersion", "REPO_VERSION="),
    item("repoLicense", "REPO_LICENSE="),
    item("llmsTxt", "LLMS_TXT=true"),
    item("sitemapJson", "SITEMAP_JSON=false"),
  ];
  return `${blocks.join("\n\n")}\n`;
}

/**
 * 独自CSS(custom.css)の空ひな形(コメントのみ)を組み立てる。コメントは --lang に従う。
 */
export function buildStyleCssTemplate() {
  return `${t("css.template", { docs: DOCS_URL })}\n`;
}

/**
 * 独自CSS(custom.css)の空ひな形の生成対象({name, relPath, content, keepExisting})。
 * 組み込みテーマCSS一式(${VENDOR_DIR}/styles/)と同じディレクトリに置く。
 * テーマCSSを参考にしながら独自CSSを書けるよう、あえて同じ場所にまとめている。
 * keepExisting: 既にあれば上書きしない(確認もしない。--force でも、init --update でも)。
 */
export function buildCustomCssTarget() {
  return {
    name: "custom.css",
    relPath: `${VENDOR_DIR}/styles/custom.css`,
    content: buildStyleCssTemplate(),
    keepExisting: true,
  };
}

/**
 * ベンダリング対象のビルドスクリプト一式(build-docs.mjs / lib/*.mjs / styles/*.css)を
 * `packageRoot`(このパッケージ自身の実ファイル)から読み取り、生成ターゲット形式
 * ({name, relPath, content})の配列として返す。
 *
 * ディレクトリの中身を都度readdirSyncで列挙するため、本体側でlib/やstylesに
 * ファイルを追加・削除しても、このリストは自動的に追従する
 * (`bin/cli.mjs`自体の修正は不要)。
 *
 * @param {string} [packageRoot] - 既定は`PACKAGE_ROOT`(このファイル自身が属するパッケージ)。
 *   テスト時に差し替え可能にするため引数化している。
 * @param {{existsSync, readdirSync, readFileSync}} [fsImpl] - テスト用差し替え
 * @returns {Array<{name:string, relPath:string, content:string}>}
 */
export function buildVendorTargets(packageRoot = PACKAGE_ROOT, fsImpl = { existsSync, readdirSync, readFileSync }) {
  const targets = [];

  const scriptsDir = join(packageRoot, ".github/scripts");
  const buildDocsAbs = join(scriptsDir, "build-docs.mjs");
  if (fsImpl.existsSync(buildDocsAbs)) {
    targets.push({
      name: "build-docs.mjs",
      relPath: `${VENDOR_DIR}/build-docs.mjs`,
      content: fsImpl.readFileSync(buildDocsAbs, "utf-8"),
    });
  }

  const libDir = join(scriptsDir, "lib");
  if (fsImpl.existsSync(libDir)) {
    for (const entry of fsImpl.readdirSync(libDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
      targets.push({
        name: `lib/${entry.name}`,
        relPath: `${VENDOR_DIR}/lib/${entry.name}`,
        content: fsImpl.readFileSync(join(libDir, entry.name), "utf-8"),
      });
    }
  }

  // 組み込みテーマ全て(base.css含む)をコピーする。frontmatterの`theme`キーで
  // サイト全体のTHEMEとは違う組み込みテーマをページ単位で指定できるため、
  // 選択されたTHEME以外のCSSも含めて一式コピーしておく必要がある。
  const stylesDir = join(packageRoot, "styles");
  if (fsImpl.existsSync(stylesDir)) {
    for (const entry of fsImpl.readdirSync(stylesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
      targets.push({
        name: `styles/${entry.name}`,
        relPath: `${VENDOR_DIR}/styles/${entry.name}`,
        content: fsImpl.readFileSync(join(stylesDir, entry.name), "utf-8"),
      });
    }
  }

  // ビルド用の依存の package.json・package-lock.json(ワークフローと preview が npm ci でインストールする)
  const lockfiles = readBuildLockfiles(packageRoot, fsImpl);
  targets.push(
    { name: "package.json", relPath: `${VENDOR_DIR}/package.json`, content: lockfiles.packageJson },
    { name: "package-lock.json", relPath: `${VENDOR_DIR}/package-lock.json`, content: lockfiles.packageLock }
  );

  // 手元でプレビューするときに入れる依存(.github/tsuzuri/node_modules)を誤ってコミットしないように
  targets.push({
    name: ".gitignore",
    relPath: `${VENDOR_DIR}/.gitignore`,
    content: "# Dependencies installed for local builds (do not commit)\nnode_modules/\n",
  });

  return targets;
}

/**
 * 生成対象ファイルの一覧(パス・中身)を組み立てる。
 * ファイル生成ロジックをテストしやすくするため、対話ロジックとは分離している。
 *
 * ワークフロー/設定ファイルに加えて、ビルドスクリプト本体一式
 * (buildVendorTargets)も生成対象に含める。これにより、
 * 生成されたワークフローは実行時にOSS本体リポジトリへ依存せず、
 * 利用者リポジトリの中だけでビルド・デプロイが完結する。
 */
export function buildTargets(answers) {
  const merged = { ...DEFAULT_ANSWERS, ...answers };
  const targets = [
    buildWorkflowTarget(),
    {
      name: "config",
      relPath: CONFIG_FILE_PATH,
      content: buildDocsPagesConfig(merged),
    },
    ...buildVendorTargets(),
  ];
  targets.push(buildCustomCssTarget());
  return targets;
}

/**
 * ファイル単位で既存ファイルを検出しつつ書き出す。
 * ファイル単位で個別にexistsSyncをチェックし、既存ファイルは上書き確認を行う。
 * 1ファイルのスキップ(N回答)が他ファイルの処理を止めないようにする。
 * keepExisting が真の対象(独自CSSのひな形)は、既にあれば確認せずに保持する。
 *
 * @param {Array<{name:string, relPath:string, content:string, keepExisting?:boolean}>} targets
 * @param {object} opts
 * @param {string} opts.cwd - 書き出し先のルートディレクトリ
 * @param {(relPath: string) => Promise<boolean>|boolean} opts.confirmOverwrite -
 *   既存ファイルを検出したときに呼ばれ、上書きするかどうかを返す(デフォルトNの実装は呼び出し側の責務)
 * @param {(msg: string) => void} [opts.log]
 * @param {{existsSync, mkdirSync, writeFileSync}} [opts.fsImpl] - テスト用差し替え
 * @returns {Promise<Array<{name:string, relPath:string, status: "created"|"overwritten"|"skipped"}>>}
 */
export async function writeGeneratedFiles(targets, opts) {
  const {
    cwd,
    confirmOverwrite,
    log = () => {},
    fsImpl = { existsSync, mkdirSync, writeFileSync },
  } = opts;

  const results = [];
  for (const target of targets) {
    const fullPath = join(cwd, target.relPath);
    const alreadyExists = fsImpl.existsSync(fullPath);

    if (alreadyExists && target.keepExisting) {
      log(t("log.kept", { path: target.relPath }));
      results.push({ ...target, status: "skipped" });
      continue;
    }

    if (alreadyExists) {
      const overwrite = await confirmOverwrite(target.relPath);
      if (!overwrite) {
        log(t("log.skipped", { path: target.relPath }));
        results.push({ ...target, status: "skipped" });
        continue;
      }
    }

    fsImpl.mkdirSync(dirname(fullPath), { recursive: true });
    fsImpl.writeFileSync(fullPath, target.content);
    log(alreadyExists ? t("log.overwritten", { path: target.relPath }) : t("log.created", { path: target.relPath }));
    results.push({ ...target, status: alreadyExists ? "overwritten" : "created" });
  }

  return results;
}

/**
 * THEME番号選択肢の入力文字列を key に変換する。
 * 不正値・空文字はデフォルト("1" = material)扱いにする。
 */
export function resolveThemeChoice(input) {
  const trimmed = (input ?? "").trim();
  if (trimmed === "") return THEME_CHOICES[0].key;
  const index = Number.parseInt(trimmed, 10) - 1;
  if (Number.isNaN(index) || index < 0 || index >= THEME_CHOICES.length) {
    return THEME_CHOICES[0].key;
  }
  return THEME_CHOICES[index].key;
}

/**
 * y/N形式の入力を真偽値に変換する。
 * @param {string} input
 * @param {boolean} defaultValue - 空入力時に返す値
 */
export function parseYesNo(input, defaultValue) {
  const trimmed = (input ?? "").trim().toLowerCase();
  if (trimmed === "") return defaultValue;
  return trimmed === "y" || trimmed === "yes";
}

/**
 * readlineのInterfaceから、`{ question(promptText) => Promise<string> }`という
 * 単純なインターフェースを組み立てる。
 *
 * 標準の`rl.question()`は非TTY(パイプ/リダイレクト)の入力に対して2回目以降の呼び出しが
 * 応答を受け取れず無限に待機してしまう既知の癖があるため、代わりにInterfaceの
 * 非同期イテレータ(1行ずつyieldする)を手動で進める方式を採る。TTY・非TTYのどちらでも
 * 同じ挙動になる。
 */
export function createAsker(rl) {
  const lines = rl[Symbol.asyncIterator]();
  return {
    question: async (promptText) => {
      process.stdout.write(promptText);
      const { value, done } = await lines.next();
      return done ? "" : value;
    },
  };
}

/**
 * 対話プロンプトで6項目(TRIGGER_BRANCH/ROOT_MD/THEME/NAV_ENABLED/LANGUAGES/SITE_NAME)を収集する。
 * readlineインターフェースは呼び出し側から注入する(テスト時は標準入力をモックしたものを渡す)。
 */
export async function promptAnswers(rl, defaults = DEFAULT_ANSWERS) {
  const triggerBranchInput = await rl.question(t("prompt.triggerBranch", { default: defaults.triggerBranch }));
  const triggerBranch = triggerBranchInput.trim() || defaults.triggerBranch;

  const rootMdInput = await rl.question(t("prompt.rootMd", { default: DEFAULT_ANSWERS.rootMd }));
  const rootMd = rootMdInput.trim() || DEFAULT_ANSWERS.rootMd;

  const themeMenu = THEME_CHOICES.map(
    (choice, i) => `    ${i + 1}) ${choice.key} - ${choice.label}`,
  ).join("\n");
  const themeInput = await rl.question(t("prompt.theme", { menu: themeMenu }));
  const theme = resolveThemeChoice(themeInput);

  const navInput = await rl.question(t("prompt.nav"));
  const navEnabled = parseYesNo(navInput, DEFAULT_ANSWERS.navEnabled);

  const languagesInput = await rl.question(t("prompt.languages", { default: DEFAULT_ANSWERS.languages }));
  // config.mjs と同じ決まりで確かめる(不正なタグは同じ警告を出して捨てる。空なら en)。入力した順のまま書く
  const languages = resolveLanguages(languagesInput).join(",");

  const siteNameInput = await rl.question(t("prompt.siteName"));
  const siteName = siteNameInput.trim();

  return { triggerBranch, rootMd, theme, navEnabled, languages, siteName };
}

/**
 * `init --update`: 対話なしで、既存の利用者リポジトリの tsuzuri を最新化する。
 *
 * - ワークフロー(tsuzuri-pages.yml)とビルドスクリプト一式(VENDOR_DIR 配下)は上書きする
 * - 設定ファイル(.github/tsuzuri/config)は一切触らない
 * - 独自CSS(custom.css)は、既にあれば触らない。無ければ空のひな形を作る
 * - 新しく増えたビルドスクリプトは追加される
 * - 本体側で削除されたビルドスクリプト(VENDOR_DIR/lib/*.mjs のうち配布対象に無いもの)は削除する
 *   (VENDOR_DIR/styles/ は利用者の独自CSSも置かれるため、削除の対象にしない)
 *
 * 設定ファイルが無い(=まだ init していない)リポジトリではエラーにする。
 * リリース時に main で実行する init --update からも使う。
 *
 * @param {object} opts
 * @param {string} opts.cwd
 * @param {(msg: string) => void} [opts.log]
 * @param {{existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync}} [opts.fsImpl] - テスト用差し替え
 * @param {Array<{name:string, relPath:string, content:string}>} [opts.targets] - テスト用差し替え
 * @returns {Promise<Array<{relPath:string, status: "created"|"overwritten"|"skipped"|"deleted"}>>}
 */
export async function runUpdate({
  cwd,
  log = () => {},
  fsImpl = { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync },
  targets,
}) {
  const configRel = CONFIG_FILE_PATH;
  if (!fsImpl.existsSync(join(cwd, configRel))) {
    throw new Error(t("update.noConfig", { config: configRel }));
  }
  const updateTargets = targets ?? [
    buildWorkflowTarget(),
    ...buildVendorTargets(),
    buildCustomCssTarget(),
  ];
  // 新しいバージョンで増えた設定項目のうち、利用者の設定ファイルに無いものを案内する
  // (設定ファイルは書き換えないので、無い項目は既定値で動く)
  if (fsImpl.readFileSync) {
    const missingKeys = missingConfigKeys(fsImpl.readFileSync(join(cwd, configRel), "utf-8"));
    if (missingKeys.length) {
      log(t("update.missingKeys", { keys: missingKeys.join(", "), config: configRel, docs: DOCS_URL }));
    }
  }

  const results = await writeGeneratedFiles(updateTargets, {
    cwd,
    confirmOverwrite: () => true,
    log,
    fsImpl,
  });

  // 本体側で削除されたビルドスクリプトを、利用者リポジトリからも削除する
  const libRel = `${VENDOR_DIR}/lib`;
  const libAbs = join(cwd, libRel);
  const keep = new Set(updateTargets.map((t) => t.relPath));
  if (fsImpl.existsSync(libAbs)) {
    for (const entry of fsImpl.readdirSync(libAbs, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
      const relPath = `${libRel}/${entry.name}`;
      if (keep.has(relPath)) continue;
      fsImpl.unlinkSync(join(cwd, relPath));
      log(t("update.deleted", { path: relPath }));
      results.push({ relPath, status: "deleted" });
    }
  }
  return results;
}

export function buildHelpText() {
  return t("help.text", { repo: OSS_REPO, themes: THEME_CHOICES.map((c) => c.key).join(" / ") });
}

/**
 * コマンドライン引数を解析する。不明なオプション・サブコマンドや不正なテーマ名はエラーにする。
 *
 * @param {string[]} argv - process.argv.slice(2) 相当
 * @returns {{ update: boolean, yes: boolean, force: boolean, version: boolean,
 *   help: boolean, branch?: string, root?: string, theme?: string, languages?: string, port: number, command: "init" | "preview",
 *   nonInteractive: boolean }}
 */
export function parseCliArgs(argv = []) {
  let parsed;
  try {
    parsed = parseCliArgsRaw(argv);
  } catch (err) {
    if (String(err.code).startsWith("ERR_PARSE_ARGS")) {
      throw new Error(t("error.args", { message: err.message }), {
        cause: err,
      });
    }
    throw err;
  }
  return parsed;
}

function parseCliArgsRaw(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      update: { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false },
      force: { type: "boolean", default: false },
      branch: { type: "string" },
      root: { type: "string" },
      theme: { type: "string" },
      languages: { type: "string" },
      lang: { type: "string" },
      "site-name": { type: "string" },
      "no-nav": { type: "boolean", default: false },
      port: { type: "string" },
      "no-watch": { type: "boolean", default: false },
      open: { type: "boolean", default: false },
      version: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const unknown = positionals.filter((p) => p !== "init" && p !== "preview");
  if (unknown.length || positionals.length > 1) {
    throw new Error(t("error.subcommand", { name: positionals.join(" ") }));
  }
  const command = positionals[0] ?? "init";
  let port = 4000;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!/^\d+$/.test(values.port) || port < 1 || port > 65535) {
      throw new Error(t("error.port", { value: values.port }));
    }
  }
  if (values.theme !== undefined && !THEME_CHOICES.some((c) => c.key === values.theme)) {
    throw new Error(
      t("error.theme", { themes: THEME_CHOICES.map((c) => c.key).join(" / "), value: values.theme }),
    );
  }
  for (const key of ["branch", "root", "languages"]) {
    if (values[key] !== undefined && !values[key].trim()) {
      throw new Error(t("error.emptyValue", { name: key }));
    }
  }
  if (values.languages !== undefined && !isValidLanguagesOption(values.languages)) {
    throw new Error(t("error.languages", { value: values.languages }));
  }
  if (values.lang !== undefined && !isCliLang(values.lang)) {
    throw new Error(t("error.lang", { value: values.lang }));
  }
  const nonInteractive =
    values.yes ||
    values["no-nav"] ||
    ["branch", "root", "theme", "languages", "site-name"].some((k) => values[k] !== undefined);
  return { ...values, command, port, nonInteractive };
}

// --languages で明示した値が正しいか。空でない要素が1つ以上あり、すべて言語タグの形であること。
// (対話の答えと違い、明示した値の書き間違いは警告で済ませずにエラーにする)
function isValidLanguagesOption(raw) {
  const items = raw.split(",").map((item) => item.trim()).filter((item) => item !== "");
  return items.length > 0 && items.every((item) => LANG_TAG_RE.test(item));
}

/**
 * 対話なし実行のときの回答を、コマンドライン引数(指定が無ければ既定値)から作る。
 * @param {ReturnType<typeof parseCliArgs>} args
 */
export function answersFromArgs(args, defaults = DEFAULT_ANSWERS) {
  return {
    triggerBranch: args.branch?.trim() ?? defaults.triggerBranch,
    rootMd: args.root?.trim() ?? DEFAULT_ANSWERS.rootMd,
    theme: args.theme ?? DEFAULT_ANSWERS.theme,
    navEnabled: !args["no-nav"],
    languages: args.languages !== undefined ? resolveLanguages(args.languages).join(",") : DEFAULT_ANSWERS.languages,
    siteName: args["site-name"]?.trim() ?? DEFAULT_ANSWERS.siteName,
  };
}

/**
 * 設定ファイルの内容と比べて、最新の設定ファイルのひな形にあるのに書かれていないキーを返す。
 * @param {string} configText
 * @returns {string[]}
 */
export function missingConfigKeys(configText) {
  const keysOf = (text) =>
    [...text.matchAll(/^\s*([A-Z_]+)\s*=/gm)].map((m) => m[1]);
  const present = new Set(keysOf(configText));
  return keysOf(buildDocsPagesConfig({})).filter((key) => !present.has(key));
}

/**
 * cwd から親をたどって git リポジトリの直下(.git がある場所)を探す。見つからなければ null。
 * @param {string} cwd
 * @param {(p: string) => boolean} [exists]
 */
export function findRepoRoot(cwd, exists = existsSync) {
  let dir = cwd;
  for (;;) {
    if (exists(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * init を実行する場所についての注意を返す(問題なければ空配列)。
 * ワークフローは .github/workflows がリポジトリの直下にないと GitHub で動かないため。
 * @param {string} cwd
 * @param {(p: string) => boolean} [exists]
 * @returns {string[]}
 */
export function checkSetupLocation(cwd, exists = existsSync) {
  const root = findRepoRoot(cwd, exists);
  if (!root) {
    return [t("warn.notGit")];
  }
  if (root !== cwd) {
    return [t("warn.notRoot", { root })];
  }
  return [];
}

/**
 * トリガーブランチの既定値を、リポジトリの既定ブランチ(origin/HEAD)か、今のブランチから推測する。
 * 分からなければ "main"。
 * 今のブランチを使うのは対話形式のときだけ(既定値として表示され、利用者が確かめられるため)。
 * 対話なし(--yes)では、作業ブランチがそのまま公開ブランチにならないよう origin/HEAD だけを見る。
 * @param {string} cwd
 * @param {(args: string[]) => string} [git] - テスト用差し替え
 * @param {{ useCurrentBranch?: boolean }} [options]
 */
export function guessDefaultBranch(
  cwd,
  git = (args) => execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }),
  { useCurrentBranch = true } = {},
) {
  const candidates = [["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]];
  if (useCurrentBranch) candidates.push(["branch", "--show-current"]);
  for (const args of candidates) {
    try {
      const out = git(args).trim().replace(/^origin\//, "");
      if (out) return out;
    } catch {
      // git が無い・リモートが無い場合は次の方法を試す
    }
  }
  return DEFAULT_ANSWERS.triggerBranch;
}

/**
 * 起点の Markdown がまだ無ければ、push する前に作るよう警告する(無いとビルドが失敗する)。
 * @param {string} cwd
 * @param {string} rootMd - 起点の Markdown の、cwd からの相対パス
 */
function warnMissingRoot(cwd, rootMd) {
  if (!existsSync(join(cwd, rootMd))) {
    console.warn(`⚠ ${t("warn.missingRoot", { rootMd })}`);
  }
}

/** --version: バージョンだけを表示する(バージョン行や空行は付けない)。 */
function runVersion({ version }) {
  console.log(version);
}

/** --help: バージョン行と使い方を表示する。 */
function runHelp({ version }) {
  console.log(`tsuzuri v${version}\n\n${buildHelpText()}`);
}

/**
 * preview: 手元でサイトをビルドして配信する。配信を始められなかったときは終了コードを 1 にする。
 * @param {{ cwd: string, args: ReturnType<typeof parseCliArgs>, version: string }} opts
 */
async function runPreviewMode({ cwd, args, version }) {
  const server = await runPreview({ cwd, port: args.port, version, watch: !args["no-watch"], open: args.open });
  if (!server) process.exitCode = 1;
}

/**
 * --update: 対話なしで、既存の利用者リポジトリの tsuzuri を最新化する(runUpdate)。
 * @param {{ cwd: string }} opts
 */
async function runUpdateMode({ cwd }) {
  console.log(t("update.intro"));
  await runUpdate({ cwd, log: console.log });
  console.log(t("update.done"));
}

/**
 * 対話なしの init(--yes など)。コマンドライン引数(指定が無ければ既定値)から回答を作って生成する。
 * 既存ファイルは --force が無ければスキップする。
 * @param {{ cwd: string, args: ReturnType<typeof parseCliArgs>, defaults: typeof DEFAULT_ANSWERS }} opts
 */
async function runInitNonInteractive({ cwd, args, defaults }) {
  const answers = answersFromArgs(args, defaults);
  warnMissingRoot(cwd, answers.rootMd);
  const targets = buildTargets(answers);
  await writeGeneratedFiles(targets, {
    cwd,
    confirmOverwrite: () => args.force,
    log: console.log,
  });
  console.log(buildCompletionMessage(answers));
}

/**
 * 対話形式の init。場所の警告があれば続行するかを尋ね、質問に答えてもらって生成する。
 * 標準入力は、終わったら(中止も含めて)必ず閉じる。
 * @param {{ cwd: string, defaults: typeof DEFAULT_ANSWERS, locationWarnings: string[] }} opts
 */
async function runInitInteractive({ cwd, defaults, locationWarnings }) {
  console.log(t("init.heading"));

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const asker = createAsker(rl);

  let answers;
  try {
    if (locationWarnings.length) {
      const proceed = parseYesNo(await asker.question(t("prompt.continue")), false);
      if (!proceed) {
        console.log(t("init.cancelled"));
        return;
      }
    }
    answers = await promptAnswers(asker, defaults);
    warnMissingRoot(cwd, answers.rootMd);
    const targets = buildTargets(answers);

    console.log(t("init.listHeader"));
    for (const target of targets) {
      console.log(t("init.listItem", { path: target.relPath }));
    }
    console.log("");

    const confirmOverwrite = createBundledConfirm(async (question) =>
      parseYesNo(await asker.question(question), false),
    );

    await writeGeneratedFiles(targets, { cwd, confirmOverwrite, log: console.log });
  } finally {
    rl.close();
  }

  console.log(buildCompletionMessage(answers));
}

/**
 * CLI本体。サブコマンドは init(省略しても init 相当)と preview。
 *   --version / --help … 表示して終了
 *   --update           … 対話なしの更新モード(runUpdate)
 *   --yes 等           … 対話なしで生成(既存ファイルは --force が無ければスキップ)
 *   それ以外           … 対話形式で生成
 * どのモードでも最初に実行中の tsuzuri のバージョンを表示する
 * (npx のキャッシュで古い版が動いていないかを利用者が確認できるように)。
 * ここでは引数とバージョンを読み、モードごとの関数に振り分けるだけにしている。
 */
export async function main({ cwd = process.cwd(), argv = process.argv.slice(2) } = {}) {
  // 引数の解析エラーも --lang の言語で出すため、先に argv を先読みして言語を決める(毎回 en に戻す)
  setCliLang(detectLangFromArgv(argv));
  const args = parseCliArgs(argv);
  setCliLang(args.lang ?? "en");
  const version = readPackageVersion();

  if (args.version) return runVersion({ version });
  if (args.help) return runHelp({ version });

  console.log(`tsuzuri v${version}\n`);

  if (args.command === "preview") return runPreviewMode({ cwd, args, version });
  if (args.update) return runUpdateMode({ cwd });

  const locationWarnings = checkSetupLocation(cwd);
  for (const warning of locationWarnings) console.warn(`⚠ ${warning}`);
  const defaults = {
    ...DEFAULT_ANSWERS,
    triggerBranch: guessDefaultBranch(cwd, undefined, { useCurrentBranch: !args.nonInteractive }),
  };

  if (args.nonInteractive) return runInitNonInteractive({ cwd, args, defaults });
  return runInitInteractive({ cwd, defaults, locationWarnings });
}

/**
 * ワークフロー(tsuzuri-pages.yml)とビルドスクリプト一式(VENDOR_DIR 配下。設定ファイルと独自CSSを除く)の組か。
 * これらは同じバージョンでそろっていないと動かないため、上書きするかどうかをまとめて決める。
 * 設定ファイル(VENDOR_DIR/config)と独自CSS(VENDOR_DIR/styles/custom.css。styles/ に利用者が足した CSS も同様)は、利用者が編集するので対象外。
 * @param {string} relPath
 */
export function isBundledPath(relPath) {
  return relPath === WORKFLOW_PATH ||
    (relPath.startsWith(`${VENDOR_DIR}/`) &&
      relPath !== CONFIG_FILE_PATH &&
      relPath !== `${VENDOR_DIR}/styles/custom.css`);
}

/**
 * 対話形式の init で使う上書き確認を作る。
 *   - ワークフローとビルドスクリプト一式は、最初に既存ファイルが見つかったときに1回だけ聞き、
 *     その答えを一式すべてに適用する(一部だけ上書きしてバージョンがずれるのを防ぐ)
 *   - 設定ファイルは、ファイルごとに聞く(独自CSSは、既にあれば聞かずに保持する)
 *
 * @param {(question: string) => Promise<boolean>} ask
 * @returns {(relPath: string) => Promise<boolean>}
 */
export function createBundledConfirm(ask) {
  let bundleAnswer = null;
  return async (relPath) => {
    if (isBundledPath(relPath)) {
      if (bundleAnswer === null) {
        bundleAnswer = await ask(t("prompt.overwriteBundle", { vendorDir: VENDOR_DIR }));
      }
      return bundleAnswer;
    }
    return ask(t("prompt.overwriteFile", { path: relPath }));
  };
}

/**
 * init 完了時に表示する「次にやること」の案内を組み立てる。
 * 対話で選んだトリガーブランチ・起点のMarkdownを使う。
 *
 * @param {{ triggerBranch?: string, rootMd?: string }} answers
 * @returns {string}
 */
export function buildCompletionMessage(answers = {}) {
  const { triggerBranch, rootMd } = { ...DEFAULT_ANSWERS, ...answers };
  return t("complete.message", {
    rootMd,
    triggerBranch,
    vendorDir: VENDOR_DIR,
    repo: OSS_REPO,
    tag: majorTagOf(readPackageVersion()),
  });
}

/**
 * 致命的なI/Oエラー等を分かりやすいメッセージとして報告し、
 * 非ゼロ終了コードを返す。process.exit呼び出しをmain()の外に切り出すことで
 * テストしやすくしている。
 */
export function reportFatalError(err, logger = console.error) {
  logger(t("error.fatal", { message: err.message }));
  return 1;
}

// `node bin/cli.mjs` として直接実行されたか(テストからimportされただけではないか)を判定する。
// npx は node_modules/.bin/ 配下のシンボリックリンク経由で起動するため、パス文字列の
// 単純比較ではなく、シンボリックリンクを解決した実体パス同士で比較する。
export function isDirectRunOf(moduleUrl, argv1, realpath = realpathSync) {
  try {
    return Boolean(argv1) && realpath(fileURLToPath(moduleUrl)) === realpath(argv1);
  } catch {
    return false;
  }
}

const isDirectRun = isDirectRunOf(import.meta.url, process.argv[1]);

if (isDirectRun) {
  // 引数の解釈は main() 内の parseCliArgs() で行う(不正な引数はエラーとして報告する)。
  main().catch((err) => {
    process.exitCode = reportFatalError(err);
  });
}
