#!/usr/bin/env node
// npx github:akilasatolu/tsuzuri [init] のエントリーポイント。
// 利用者リポジトリに配布用ファイル(docs-pages.yml / docs-pages.config /
// 任意でdocs-pages.style.css)に加えて、ビルドスクリプト本体
// (build-docs.mjs / lib/*.mjs / styles/*.css)一式を `.github/tsuzuri/` 配下に
// コピー(ベンダリング)する。これにより、生成後のワークフローは実行のたびに
// OSS本体リポジトリ(tsuzuri)を参照する必要がなくなり、利用者リポジトリの中だけで
// ビルド・デプロイが完結する。
//
// 追加npm依存は増やさない方針のため、node:readline/promises と
// node:fs(existsSync/mkdirSync/writeFileSync/readFileSync/readdirSync)のみを使用する。

import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";

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

// 利用者リポジトリ側でビルドスクリプト一式を配置するディレクトリ。
// 利用者が独自に使っている可能性のある `.github/scripts/` と衝突しないよう、
// tsuzuri専用の名前空間を切っている。
export const VENDOR_DIR = ".github/tsuzuri";

// 利用者向けドキュメント(tsuzuri 自身で公開しているサイト)のURL。生成するファイルの案内に使う。
export const DOCS_URL = "https://akilasatolu.github.io/tsuzuri/";

// init が生成するワークフローのひな形(PACKAGE_ROOT からの相対パス)。
export const WORKFLOW_TEMPLATE_PATH = "templates/.github/workflows/docs-pages.yml";

// THEME選択肢(番号選択、1始まり)。
export const THEME_CHOICES = [
  { key: "wa", label: "和(推奨。生成り地に墨色の文字、朱色の控えめなリンク)" },
  { key: "muji", label: "無地(装飾を極力削った最小構成)" },
  { key: "sumi", label: "墨(ダークモード向け)" },
  { key: "ai", label: "藍(深い藍色を基調にした落ち着いた配色)" },
  { key: "shu", label: "朱(朱色を効かせた力強い配色)" },
  { key: "none", label: "装飾なし" },
];

const DEFAULT_ANSWERS = {
  triggerBranch: "main",
  rootMd: "README.md",
  theme: "wa",
  createStyleFile: false,
};

/**
 * package.json の devDependencies から、生成するワークフローで利用者側にインストールする
 * ビルド用パッケージ(marked・highlight.js)のバージョンを返す。
 *
 * 範囲指定ではなく "12.0.2" のような完全一致で書かれている前提で、その値をそのまま使うことで、
 * テストで使っている版と利用者に配る版を常に一致させる。Dependabot が package.json を
 * 更新すると、その PR 1つで生成ワークフローの版も追従する。
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
      `package.json の devDependencies.${name} は "12.0.2" のような完全一致のバージョンで指定してください(現在: ${version})`,
    );
  }
  return version;
}

// 利用者側のワークフローでインストールする、ビルド用のパッケージ。
// バージョンは package.json の devDependencies(完全一致)から読む。
export const BUILD_DEPENDENCIES = ["marked", "highlight.js", "marked-footnote"];

/**
 * 生成ワークフローの `npm install` に渡す "name@version ..." を組み立てる。
 * @param {{ packageRoot?: string, fsImpl?: {readFileSync}, markedVersion?: string }} [opts]
 * @returns {string}
 */
export function buildDependencySpecs({ packageRoot = PACKAGE_ROOT, fsImpl = { readFileSync }, markedVersion } = {}) {
  return BUILD_DEPENDENCIES.map((name) => {
    const version =
      name === "marked" && markedVersion ? markedVersion : readDependencyVersion(name, packageRoot, fsImpl);
    return `${name}@${version}`;
  }).join(" ");
}

/** marked のバージョン(readDependencyVersion("marked") の短縮形) */
export function readMarkedVersion(packageRoot = PACKAGE_ROOT, fsImpl = { readFileSync }) {
  return readDependencyVersion("marked", packageRoot, fsImpl);
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
 * docs-pages.yml の内容を組み立てる。
 *
 * 自己完結型のワークフロー。ビルドスクリプト本体(build-docs.mjs等)は `init` 実行時に
 * `${VENDOR_DIR}/` 配下へコピー済みであることが前提。
 * 本体は templates/.github/workflows/docs-pages.yml に置いたひな形で、ここでは
 * プレースホルダー(__OSS_REPO__ / __VENDOR_DIR__ / __BUILD_DEPENDENCIES__ / __TSUZURI_VERSION__)を
 * 置き換えるだけ。
 * ひな形を独立したYAMLファイルにしているのは、中で使う actions のバージョンを
 * Dependabot で自動更新できるようにするため。
 *
 * @param {string} [markedVersion] - marked のバージョン(テスト時の差し替え用。既定は package.json の値)
 * @param {string} [packageRoot] - テスト時に差し替え可能にするため引数化している
 * @param {{readFileSync}} [fsImpl] - テスト用差し替え
 * @returns {string}
 */
export function buildDocsPagesYml(
  markedVersion = readMarkedVersion(),
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
    .replaceAll("__BUILD_DEPENDENCIES__", buildDependencySpecs({ packageRoot, fsImpl, markedVersion }))
    .replaceAll("__TSUZURI_VERSION__", tsuzuriVersion)
    .replaceAll("__MAJOR_TAG__", majorTagOf(tsuzuriVersion));
}

/**
 * docs-pages.config の内容を組み立てる。
 * T-015で確定したフォーマットに対話結果(TRIGGER_BRANCH/ROOT_MD/THEME)を埋め込み、
 * それ以外のキーはデフォルト値のまま出力する。
 */
export function buildDocsPagesConfig(answers) {
  const { triggerBranch, rootMd, theme } = { ...DEFAULT_ANSWERS, ...answers };
  return `# Tsuzuri の設定ファイル
#
# 「KEY=VALUE」の形で1行に1項目を書きます。# で始まる行と空行は無視されます。
# ワークフロー(.github/workflows/docs-pages.yml)を編集しなくても、ここを変えるだけで動作を変えられます。
# 各項目の詳しい説明: ${DOCS_URL}docs/configuration.html

# 公開(デプロイ)するブランチ。このブランチに push したときだけサイトが更新されます。
# リポジトリの既定ブランチ(通常は main)以外にする場合は、GitHub の
# Settings > Environments > github-pages > Deployment branches and tags にこのブランチを追加してください。
TRIGGER_BRANCH=${triggerBranch}

# サイトの入り口になる Markdown ファイル(リポジトリの直下からのパス)
ROOT_MD=${rootMd}

# ビルドしたサイトの出力先(リポジトリ内のフォルダ)
OUT_DIR=_site

# テーマ: wa(和) / muji(無地) / sumi(墨) / ai(藍) / shu(朱) / none(装飾なし)
# 見た目の比較: ${DOCS_URL}docs/gallery.html
THEME=${theme}

# 独自のCSSファイル。ファイルがあれば、テーマの後に読み込まれて最優先で反映されます(無ければ使いません)。
STYLE_FILE=${VENDOR_DIR}/styles/custom.css

# ページの言語(<html lang="...">)。ja / en / en-US などの言語タグで書きます。
LANG=ja

# サイドバーのナビゲーション・サイト内検索・ページ内の目次・前後のページへのリンクを表示するか(true/false)
NAV_ENABLED=false

# サイトの favicon にする画像(リポジトリの直下からのパス。例: assets/favicon.svg)。空なら使いません。
FAVICON_FILE=

# サイト名(ナビの見出しと og:site_name に使います)。空ならリポジトリ名になります。
SITE_NAME=

# 独自ドメインで公開する場合のドメイン名(例: docs.example.com)。空なら github.io で公開します。
CUSTOM_DOMAIN=

# SNSでシェアされたときの画像(OGP画像)の既定値。リポジトリの直下からのパスか、https:// から始まるURL。
# ページごとに変えたい場合は、そのページの frontmatter に ogImage を書きます。
OGP_DEFAULT_IMAGE=

# リンク切れがあるときにビルドを失敗させるか(true/false)。true にするとリンク切れのまま公開されません。
STRICT_LINKS=false

# 各ページの末尾に最終更新日(git の最終コミット日)を表示するか(true/false)
LAST_UPDATED=false

# 原因調査用の sitemap.json を出力するか(true/false)。公開サイトにも含まれるため、普段は false にしてください。
SITEMAP_JSON=false
`;
}

/**
 * docs-pages.style.css の空ひな形(コメントのみ)を組み立てる。
 */
export function buildStyleCssTemplate() {
  return `/* 独自のCSSをここに書くと、テーマの後に読み込まれて最優先で反映されます。
   色や幅を変えるCSS変数(--fg / --bg / --accent など)の一覧: ${DOCS_URL}docs/theming.html */
`;
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

  // 組み込み6テーマ全て(base.css含む)をコピーする。frontmatterの`theme`キーで
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

  // 手元でプレビューするときに入れる依存(.github/tsuzuri/node_modules)を誤ってコミットしないように
  targets.push({
    name: ".gitignore",
    relPath: `${VENDOR_DIR}/.gitignore`,
    content: "# 手元でビルドするときにインストールする依存(コミットしない)\nnode_modules/\n",
  });

  return targets;
}

/**
 * 生成対象ファイルの一覧(パス・中身)を組み立てる。
 * ファイル生成ロジックをテストしやすくするため、対話ロジックとは分離している。
 *
 * v3で、ワークフロー/設定ファイルに加えてビルドスクリプト本体一式
 * (buildVendorTargets)も生成対象に含めるようにした。これにより、
 * 生成されたワークフローは実行時にOSS本体リポジトリへ依存せず、
 * 利用者リポジトリの中だけでビルド・デプロイが完結する。
 */
export function buildTargets(answers) {
  const merged = { ...DEFAULT_ANSWERS, ...answers };
  const targets = [
    {
      name: "docs-pages.yml",
      relPath: ".github/workflows/docs-pages.yml",
      content: buildDocsPagesYml(),
    },
    {
      name: "docs-pages.config",
      relPath: ".github/docs-pages.config",
      content: buildDocsPagesConfig(merged),
    },
    ...buildVendorTargets(),
  ];
  if (merged.createStyleFile) {
    targets.push({
      name: "custom.css",
      // 組み込みテーマCSS一式(${VENDOR_DIR}/styles/)と同じディレクトリに置く。
      // テーマCSSを参考にしながら独自CSSを書けるよう、あえて同じ場所にまとめている。
      relPath: `${VENDOR_DIR}/styles/custom.css`,
      content: buildStyleCssTemplate(),
    });
  }
  return targets;
}

/**
 * ファイル単位で既存ファイルを検出しつつ書き出す。
 * ファイル単位で個別にexistsSyncをチェックし、既存ファイルは上書き確認を行う。
 * 1ファイルのスキップ(N回答)が他ファイルの処理を止めないようにする。
 *
 * @param {Array<{name:string, relPath:string, content:string}>} targets
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

    if (alreadyExists) {
      const overwrite = await confirmOverwrite(target.relPath);
      if (!overwrite) {
        log(`⏭ ${target.relPath} をスキップしました(既存ファイルを保持)`);
        results.push({ ...target, status: "skipped" });
        continue;
      }
    }

    fsImpl.mkdirSync(dirname(fullPath), { recursive: true });
    fsImpl.writeFileSync(fullPath, target.content);
    log(`✔ ${target.relPath} を${alreadyExists ? "上書き" : "作成"}しました`);
    results.push({ ...target, status: alreadyExists ? "overwritten" : "created" });
  }

  return results;
}

/**
 * THEME番号選択肢の入力文字列を key に変換する。
 * 不正値・空文字はデフォルト("1" = wa)扱いにする。
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
 * 対話プロンプトで4項目(TRIGGER_BRANCH/ROOT_MD/THEME/STYLE_FILEひな形作成有無)を収集する。
 * readlineインターフェースは呼び出し側から注入する(テスト時は標準入力をモックしたものを渡す)。
 */
export async function promptAnswers(rl, defaults = DEFAULT_ANSWERS) {
  const triggerBranchInput = await rl.question(
    `? トリガーブランチ (TRIGGER_BRANCH) [${defaults.triggerBranch}]: `,
  );
  const triggerBranch = triggerBranchInput.trim() || defaults.triggerBranch;

  const rootMdInput = await rl.question(
    `? ルートとなるMarkdownファイル (ROOT_MD) [${DEFAULT_ANSWERS.rootMd}]: `,
  );
  const rootMd = rootMdInput.trim() || DEFAULT_ANSWERS.rootMd;

  const themeMenu = THEME_CHOICES.map(
    (choice, i) => `    ${i + 1}) ${choice.key} - ${choice.label}`,
  ).join("\n");
  const themeInput = await rl.question(
    `? テーマ (THEME) を選択してください:\n${themeMenu}\n  番号を入力 [1]: `,
  );
  const theme = resolveThemeChoice(themeInput);

  const createStyleFileInput = await rl.question(
    `? 独自CSS用の空ひな形ファイル(${VENDOR_DIR}/styles/custom.css)を作成しますか? (y/N): `,
  );
  const createStyleFile = parseYesNo(createStyleFileInput, false);

  return { triggerBranch, rootMd, theme, createStyleFile };
}

/**
 * コマンドライン引数に `--update` が含まれるかを判定する。
 * @param {string[]} argv - process.argv.slice(2) 相当
 */
export function isUpdateMode(argv = []) {
  return argv.includes("--update");
}

/**
 * `init --update`: 対話なしで、既存の利用者リポジトリの tsuzuri を最新化する。
 *
 * - ワークフロー(docs-pages.yml)とビルドスクリプト一式(VENDOR_DIR 配下)は上書きする
 * - 設定ファイル(docs-pages.config)と独自CSS(custom.css)は一切触らない
 * - 新しく増えたビルドスクリプトは追加される
 * - 本体側で削除されたビルドスクリプト(VENDOR_DIR/lib/*.mjs のうち配布対象に無いもの)は削除する
 *   (VENDOR_DIR/styles/ は利用者の独自CSSも置かれるため、削除の対象にしない)
 *
 * 設定ファイルが無い(=まだ init していない)リポジトリではエラーにする。
 * CI(mainブランチの更新をdocsブランチへ自動反映するワークフロー等)からも使う。
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
  const configRel = ".github/docs-pages.config";
  if (!fsImpl.existsSync(join(cwd, configRel))) {
    throw new Error(
      `${configRel} が見つかりません。初回は --update を付けずに init を実行してください`,
    );
  }
  const updateTargets = targets ?? [
    { name: "docs-pages.yml", relPath: ".github/workflows/docs-pages.yml", content: buildDocsPagesYml() },
    ...buildVendorTargets(),
  ];
  // 新しいバージョンで増えた設定項目のうち、利用者の設定ファイルに無いものを案内する
  // (設定ファイルは書き換えないので、無い項目は既定値で動く)
  if (fsImpl.readFileSync) {
    const missingKeys = missingConfigKeys(fsImpl.readFileSync(join(cwd, configRel), "utf-8"));
    if (missingKeys.length) {
      log(
        `ℹ 設定ファイルに無い項目があります(既定値で動きます): ${missingKeys.join(", ")}\n` +
          `  使う場合は ${configRel} に追記してください。説明: ${DOCS_URL}docs/configuration.html`,
      );
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
      log(`✖ ${relPath} を削除しました(最新版では使われていないため)`);
      results.push({ relPath, status: "deleted" });
    }
  }
  return results;
}

export const HELP_TEXT = `使い方: npx github:${OSS_REPO}[#v1] init [オプション]

オプションを付けずに実行すると、対話形式で設定を聞きながらファイルを生成します。

  --update           対話なしで最新版に更新する(ワークフローとビルドスクリプトだけを上書きし、
                     設定ファイル・独自CSSは変更しない)
  -y, --yes          対話なしで、すべて既定値(または下のオプションで指定した値)で生成する
      --branch <名前> トリガーブランチ(TRIGGER_BRANCH)。既定: リポジトリの既定ブランチ
                     (origin/HEAD。分からなければ main)
      --root <パス>   起点となるMarkdownファイル(ROOT_MD)。既定: README.md
      --theme <名前>  テーマ(THEME)。${THEME_CHOICES.map((c) => c.key).join(" / ")}。既定: wa
      --style        独自CSSの空ひな形(${VENDOR_DIR}/styles/custom.css)も作る
      --force        対話なしのとき、既存ファイルも上書きする(既定では既存ファイルはスキップ)
  -v, --version      バージョンを表示する
  -h, --help         この説明を表示する

--branch / --root / --theme / --style のいずれかを指定した場合も、対話なしで実行します。`;

/**
 * コマンドライン引数を解析する。不明なオプション・サブコマンドや不正なテーマ名はエラーにする。
 *
 * @param {string[]} argv - process.argv.slice(2) 相当
 * @returns {{ update: boolean, yes: boolean, force: boolean, style: boolean, version: boolean,
 *   help: boolean, branch?: string, root?: string, theme?: string, nonInteractive: boolean }}
 */
export function parseCliArgs(argv = []) {
  let parsed;
  try {
    parsed = parseCliArgsRaw(argv);
  } catch (err) {
    if (String(err.code).startsWith("ERR_PARSE_ARGS")) {
      throw new Error(`引数が正しくありません: ${err.message}(--help で使い方を表示します)`, {
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
      style: { type: "boolean", default: false },
      version: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const unknown = positionals.filter((p) => p !== "init");
  if (unknown.length) {
    throw new Error(`不明なサブコマンドです: ${unknown.join(" ")}(--help で使い方を表示します)`);
  }
  if (values.theme !== undefined && !THEME_CHOICES.some((c) => c.key === values.theme)) {
    throw new Error(
      `--theme には ${THEME_CHOICES.map((c) => c.key).join(" / ")} のいずれかを指定してください(指定: ${values.theme})`,
    );
  }
  for (const key of ["branch", "root"]) {
    if (values[key] !== undefined && !values[key].trim()) {
      throw new Error(`--${key} に空の値は指定できません`);
    }
  }
  const nonInteractive =
    values.yes || values.style || ["branch", "root", "theme"].some((k) => values[k] !== undefined);
  return { ...values, nonInteractive };
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
    createStyleFile: args.style,
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
    return ["git リポジトリの中ではないようです。公開したいリポジトリの直下で実行してください。"];
  }
  if (root !== cwd) {
    return [
      `リポジトリの直下ではありません(直下: ${root})。` +
        "ワークフローはリポジトリ直下の .github/workflows に置かないと GitHub で動きません。",
    ];
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
 * CLI本体。サブコマンドは init のみ(省略しても init 相当)。
 *   --version / --help … 表示して終了
 *   --update           … 対話なしの更新モード(runUpdate)
 *   --yes 等           … 対話なしで生成(既存ファイルは --force が無ければスキップ)
 *   それ以外           … 対話形式で生成
 * どのモードでも最初に実行中の tsuzuri のバージョンを表示する
 * (npx のキャッシュで古い版が動いていないかを利用者が確認できるように)。
 */
export async function main({ cwd = process.cwd(), argv = process.argv.slice(2) } = {}) {
  const args = parseCliArgs(argv);
  const version = readPackageVersion();

  if (args.version) {
    console.log(version);
    return;
  }
  if (args.help) {
    console.log(`tsuzuri v${version}\n\n${HELP_TEXT}`);
    return;
  }

  console.log(`tsuzuri v${version}\n`);

  if (args.update) {
    console.log("最新版に更新します(設定ファイル・独自CSSは変更しません)\n");
    await runUpdate({ cwd, log: console.log });
    console.log("\n更新が完了しました。変更内容は 'git diff' で確認できます。");
    return;
  }

  const locationWarnings = checkSetupLocation(cwd);
  for (const warning of locationWarnings) console.warn(`⚠ ${warning}`);
  const defaults = {
    ...DEFAULT_ANSWERS,
    triggerBranch: guessDefaultBranch(cwd, undefined, { useCurrentBranch: !args.nonInteractive }),
  };
  const warnMissingRoot = (rootMd) => {
    if (!existsSync(join(cwd, rootMd))) {
      console.warn(`⚠ 起点の ${rootMd} がまだありません。push する前に作成してください(無いとビルドが失敗します)。`);
    }
  };

  if (args.nonInteractive) {
    const answers = answersFromArgs(args, defaults);
    warnMissingRoot(answers.rootMd);
    const targets = buildTargets(answers);
    await writeGeneratedFiles(targets, {
      cwd,
      confirmOverwrite: () => args.force,
      log: console.log,
    });
    console.log(buildCompletionMessage(answers));
    return;
  }

  console.log("README → GitHub Pages 自動デプロイパッケージ セットアップ\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const asker = createAsker(rl);

  let answers;
  try {
    if (locationWarnings.length) {
      const proceed = parseYesNo(await asker.question("このまま続けますか? (y/N): "), false);
      if (!proceed) {
        console.log("中止しました。リポジトリの直下で実行し直してください。");
        return;
      }
    }
    answers = await promptAnswers(asker, defaults);
    warnMissingRoot(answers.rootMd);
    const targets = buildTargets(answers);

    console.log("\n--- 以下のファイルを生成します ---");
    for (const target of targets) {
      console.log(`  ${target.relPath}  (対象)`);
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
 * ワークフロー(docs-pages.yml)とビルドスクリプト一式(VENDOR_DIR 配下)の組か。
 * これらは同じバージョンでそろっていないと動かないため、上書きするかどうかをまとめて決める。
 * @param {string} relPath
 */
export function isBundledPath(relPath) {
  return relPath === ".github/workflows/docs-pages.yml" ||
    (relPath.startsWith(`${VENDOR_DIR}/`) && relPath !== `${VENDOR_DIR}/styles/custom.css`);
}

/**
 * 対話形式の init で使う上書き確認を作る。
 *   - ワークフローとビルドスクリプト一式は、最初に既存ファイルが見つかったときに1回だけ聞き、
 *     その答えを一式すべてに適用する(一部だけ上書きしてバージョンがずれるのを防ぐ)
 *   - 設定ファイル・独自CSSは、ファイルごとに聞く
 *
 * @param {(question: string) => Promise<boolean>} ask
 * @returns {(relPath: string) => Promise<boolean>}
 */
export function createBundledConfirm(ask) {
  let bundleAnswer = null;
  return async (relPath) => {
    if (isBundledPath(relPath)) {
      if (bundleAnswer === null) {
        bundleAnswer = await ask(
          `ワークフローとビルドスクリプト一式(${VENDOR_DIR}/ 配下)は既に存在します。最新版で上書きしますか? (y/N): `,
        );
      }
      return bundleAnswer;
    }
    return ask(`${relPath} は既に存在します。上書きしますか? (y/N): `);
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
  return [
    "",
    "セットアップが完了しました。次の手順で GitHub Pages に公開できます。",
    "",
    `  1. ${rootMd} がリポジトリにあることを確認する(サイトの起点になります)`,
    `  2. GitHub の Settings > Pages で、Source を「GitHub Actions」にする(初回のみ)`,
    `  3. ${triggerBranch} がリポジトリの既定ブランチでない場合は、Settings > Environments >`,
    `     github-pages の「Deployment branches and tags」に ${triggerBranch} を追加する(初回のみ)`,
    `  4. 生成されたファイルをコミットし、${triggerBranch} ブランチへ push する`,
    "",
    "push すると Actions タブでワークフローが動き、完了すると Settings > Pages に公開URLが表示されます。",
    `ビルドスクリプト本体(${VENDOR_DIR}/ 配下)もこのリポジトリにコピー済みのため、`,
    "実行時に外部リポジトリを参照することはありません。",
    "",
    `最新版に更新するときは npx github:${OSS_REPO}#${majorTagOf(readPackageVersion())} init --update を実行してください`,
    "(設定ファイル・独自CSSはそのままに、ワークフローとスクリプトだけが更新されます)。",
  ].join("\n");
}

/**
 * 致命的なI/Oエラー等を分かりやすいメッセージとして報告し、
 * 非ゼロ終了コードを返す。process.exit呼び出しをmain()の外に切り出すことで
 * テストしやすくしている。
 */
export function reportFatalError(err, logger = console.error) {
  logger(`エラー: セットアップに失敗しました。 (${err.message})`);
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
