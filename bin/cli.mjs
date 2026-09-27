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
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
 * 生成するワークフローで利用者側にインストールする marked のバージョンを返す。
 *
 * package.json の devDependencies.marked(範囲指定ではなく "12.0.2" のような完全一致)を
 * そのまま使うことで、テストで使っている版と利用者に配る版を常に一致させる。
 * dependabot が package.json の marked を更新すると、その PR 1つで生成ワークフローの
 * 版も追従する。
 *
 * @param {string} [packageRoot] - 既定は`PACKAGE_ROOT`。テスト時に差し替え可能にするため引数化している。
 * @param {{readFileSync}} [fsImpl] - テスト用差し替え
 * @returns {string}
 */
export function readMarkedVersion(packageRoot = PACKAGE_ROOT, fsImpl = { readFileSync }) {
  const pkg = JSON.parse(fsImpl.readFileSync(join(packageRoot, "package.json"), "utf-8"));
  const version = pkg.devDependencies?.marked;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `package.json の devDependencies.marked は "12.0.2" のような完全一致のバージョンで指定してください(現在: ${version})`,
    );
  }
  return version;
}

/**
 * docs-pages.yml の内容を組み立てる。
 *
 * 自己完結型のワークフロー。ビルドスクリプト本体(build-docs.mjs等)は `init` 実行時に
 * `${VENDOR_DIR}/` 配下へコピー済みであることが前提。
 * 本体は templates/.github/workflows/docs-pages.yml に置いたひな形で、ここでは
 * プレースホルダー(__OSS_REPO__ / __VENDOR_DIR__ / __MARKED_VERSION__)を置き換えるだけ。
 * ひな形を独立したYAMLファイルにしているのは、中で使う actions のバージョンを
 * Dependabot で自動更新できるようにするため。
 *
 * @param {string} [markedVersion]
 * @param {string} [packageRoot] - テスト時に差し替え可能にするため引数化している
 * @param {{readFileSync}} [fsImpl] - テスト用差し替え
 * @returns {string}
 */
export function buildDocsPagesYml(
  markedVersion = readMarkedVersion(),
  packageRoot = PACKAGE_ROOT,
  fsImpl = { readFileSync },
) {
  const raw = fsImpl.readFileSync(join(packageRoot, WORKFLOW_TEMPLATE_PATH), "utf-8");
  const marker = "# --- template start ---\n";
  const markerIndex = raw.indexOf(marker);
  const template = markerIndex >= 0 ? raw.slice(markerIndex + marker.length) : raw;
  return template
    .replaceAll("__OSS_REPO__", OSS_REPO)
    .replaceAll("__VENDOR_DIR__", VENDOR_DIR)
    .replaceAll("__MARKED_VERSION__", markedVersion);
}

/**
 * docs-pages.config の内容を組み立てる。
 * T-015で確定したフォーマットに対話結果(TRIGGER_BRANCH/ROOT_MD/THEME)を埋め込み、
 * それ以外のキーはデフォルト値のまま出力する。
 */
export function buildDocsPagesConfig(answers) {
  const { triggerBranch, rootMd, theme } = { ...DEFAULT_ANSWERS, ...answers };
  return `# docs-pages 設定ファイル
#
# ここに書いた値を変更するだけで、ワークフロー本体
# (.github/workflows/docs-pages.yml) を編集せずに動作をカスタマイズできます。
# 「KEY=VALUE」形式で1行に1項目、空行や # で始まる行は無視されます。

# ビルド・デプロイをトリガーするブランチ名
# このブランチへの push (マージ含む) があったときだけ Pages への
# デプロイが実行されます。
# リポジトリの既定ブランチ(通常は main)以外を指定する場合は、GitHub の
# Settings > Environments > github-pages > Deployment branches and tags に
# このブランチを追加してください(追加しないとデプロイが失敗します)。
TRIGGER_BRANCH=${triggerBranch}

# 起点となる Markdown ファイル（リポジトリルートからの相対パス）
ROOT_MD=${rootMd}

# ビルド出力先ディレクトリ
OUT_DIR=_site

# カスタムスタイル CSS ファイル（任意）
# ここに指定したパスに CSS ファイルが存在すれば、その内容がページの
# スタイルに反映されます。組み込みテーマCSS一式(${VENDOR_DIR}/styles/)と
# 同じディレクトリに置くのが既定の配置です（テーマCSSを参考にしながら
# 独自CSSを書けるように、あえて同じ場所にまとめています）。
# ファイルが存在しない場合は既定のスタイルが使われます。
STYLE_FILE=${VENDOR_DIR}/styles/custom.css

# ── 新規キー(すべて省略可。省略時は現行動作と完全に同一になる) ──

# 出力HTMLの <html lang="..."> に設定する言語コード
# 省略時: "ja"(現行のハードコード値と同じ = 後方互換)
LANG=ja

# ページ間ナビゲーション(自動生成の簡易ページ一覧)を出力するか
# true/false のみ有効。それ以外の値が指定された場合は警告を出し false 扱いにする
# 省略時: false(現行の「ナビなし1カラム」動作と同一 = 後方互換)
NAV_ENABLED=false

# favicon として使う画像ファイル(リポジトリルートからの相対パス)
# 存在しない/未設定の場合は favicon リンクタグを出力しない(現行動作と同一)
FAVICON_FILE=

# サイト名(OGPのog:site_name、ナビのタイトル表示に使用)
# 省略時: build-docs.mjs 実行時の環境変数 GITHUB_REPOSITORY("owner/repo"形式。
# GitHub Actions実行時は常に自動設定される既定の環境変数で、ワークフローYAML側の
# 追加対応は不要)からリポジトリ名部分("/"以降)を算出して使う。
# GITHUB_REPOSITORY 自体が存在しない場合(Actions外でのローカル実行等)は空文字のまま。
SITE_NAME=

# カスタムドメインを使う場合のドメイン名(スキームなし。例: docs.example.com)
# 設定すると OUT_DIR 直下に CNAME ファイルを自動生成する
# 省略時: CNAME を生成しない(現行動作と同一)
CUSTOM_DOMAIN=

# frontmatterでogImageを指定しないページに使うデフォルトのOGP画像パス(相対 or 絶対URL)
# 省略時: og:image タグを出力しない
OGP_DEFAULT_IMAGE=

# ★v2新規: 組み込みテーマ名(3層カスケードの第2層。詳細は「スタイル3層カスケード詳細設計」節)
# 選択肢: wa(和) / muji(無地) / sumi(墨) / ai(藍) / shu(朱) / none
#   none を指定すると配色・装飾を含むテーマ層を丸ごと適用しない(基礎CSSのみになる)
# 省略時・不正値: "wa"(警告を出してフォールバック)
THEME=${theme}
`;
}

/**
 * docs-pages.style.css の空ひな形(コメントのみ)を組み立てる。
 */
export function buildStyleCssTemplate() {
  return `/* ここに独自CSSを追記すると、テーマの後に最優先で適用されます。利用可能なCSSカスタムプロパティはREADME.mdの「スタイルのカスタマイズ」セクションを参照してください。 */
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
export async function promptAnswers(rl) {
  const triggerBranchInput = await rl.question(
    `? トリガーブランチ (TRIGGER_BRANCH) [${DEFAULT_ANSWERS.triggerBranch}]: `,
  );
  const triggerBranch = triggerBranchInput.trim() || DEFAULT_ANSWERS.triggerBranch;

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
 *
 * 設定ファイルが無い(=まだ init していない)リポジトリではエラーにする。
 * CI(mainブランチの更新をdocsブランチへ自動反映するワークフロー等)からも使う。
 *
 * @param {object} opts
 * @param {string} opts.cwd
 * @param {(msg: string) => void} [opts.log]
 * @param {{existsSync, mkdirSync, writeFileSync}} [opts.fsImpl] - テスト用差し替え
 * @param {Array<{name:string, relPath:string, content:string}>} [opts.targets] - テスト用差し替え
 * @returns {Promise<Array<{name:string, relPath:string, status: "created"|"overwritten"|"skipped"}>>}
 */
export async function runUpdate({
  cwd,
  log = () => {},
  fsImpl = { existsSync, mkdirSync, writeFileSync },
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
  return writeGeneratedFiles(updateTargets, {
    cwd,
    confirmOverwrite: () => true,
    log,
    fsImpl,
  });
}

/**
 * CLI本体。サブコマンドは init のみをサポートし、それ以外(省略含む)は init 相当の
 * デフォルト動作とする。`--update` を付けると対話なしの更新モード(runUpdate)になる。
 */
export async function main({ cwd = process.cwd(), argv = process.argv.slice(2) } = {}) {
  if (isUpdateMode(argv)) {
    console.log("tsuzuri を最新版に更新します(設定ファイル・独自CSSは変更しません)\n");
    await runUpdate({ cwd, log: console.log });
    console.log("\n更新が完了しました。変更内容は 'git diff' で確認できます。");
    return;
  }

  console.log("README → GitHub Pages 自動デプロイパッケージ セットアップ\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const asker = createAsker(rl);

  try {
    const answers = await promptAnswers(asker);
    const targets = buildTargets(answers);

    console.log("\n--- 以下のファイルを生成します ---");
    for (const target of targets) {
      console.log(`  ${target.relPath}  (対象)`);
    }
    console.log("");

    const confirmOverwrite = async (relPath) => {
      const answer = await asker.question(
        `${relPath} は既に存在します。上書きしますか? (y/N): `,
      );
      return parseYesNo(answer, false);
    };

    await writeGeneratedFiles(targets, { cwd, confirmOverwrite, log: console.log });
  } finally {
    rl.close();
  }

  console.log(
    `\nセットアップが完了しました。README.md をリポジトリ直下に配置し、\n` +
      `mainブランチへpushするとGitHub Pagesへの初回デプロイが始まります。\n` +
      `ビルドスクリプト本体(${VENDOR_DIR}/ 配下)もこのリポジトリにコピーされているため、\n` +
      `実行時に外部リポジトリを参照することはありません。\n` +
      `スクリプトを最新版に更新したい場合は、このコマンドに --update を付けて実行してください\n` +
      `(設定ファイル・独自CSSはそのままに、ワークフローとスクリプトだけが更新されます)。\n` +
      `変更内容は 'git diff' で確認できます。`,
  );
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
  // サブコマンドはinitのみ。argv[2]の値に関わらずinit相当を実行する(--updateのみ解釈する)。
  main().catch((err) => {
    process.exitCode = reportFatalError(err);
  });
}
