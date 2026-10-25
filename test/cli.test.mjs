import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync, symlinkSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OSS_REPO,
  VENDOR_DIR,
  PACKAGE_ROOT,
  buildDocsPagesYml,
  buildDocsPagesConfig,
  buildVendorTargets,
  buildTargets,
  buildWorkflowTarget,
  writeGeneratedFiles,
  parseYesNo,
  promptAnswers,
  reportFatalError,
  createAsker,
  runUpdate,
  isDirectRunOf,
  WORKFLOW_TEMPLATE_PATH,
  buildCompletionMessage,
  parseCliArgs,
  answersFromArgs,
  readPackageVersion,
  readDependencyVersion,
  buildHelpText,
  BUILD_DEPENDENCIES,
  buildBuildLockfiles,
  readBuildLockfiles,
  BUILD_LOCKFILES_DIR,
  majorTagOf,
  isBundledPath,
  createBundledConfirm,
  missingConfigKeys,
  findRepoRoot,
  checkSetupLocation,
  guessDefaultBranch,
} from "../bin/cli.mjs";
import { parseConfigText, loadConfig, CONFIG_FILE_PATH } from "../.github/scripts/lib/config.mjs";
import { setCliLang } from "../bin/messages.mjs";
import { vendoredVersionOf } from "../bin/preview.mjs";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "cli-test-"));
}

/** 表示の言語を一時的に lang にして fn を実行し、終わったら en に戻す(状態を他のテストに残さない) */
function withLang(lang, fn) {
  setCliLang(lang);
  try {
    return fn();
  } finally {
    setCliLang("en");
  }
}

function fakeRl(answers) {
  const queue = [...answers];
  return {
    question: async () => {
      if (queue.length === 0) {
        throw new Error("fakeRl: no more scripted answers");
      }
      return queue.shift();
    },
  };
}

// --- 対話ロジック(promptAnswers)のテスト ---
// 標準入力を直接モックする代わりに、question()を差し替えたrlオブジェクトを注入する。
// 質問の順番: TRIGGER_BRANCH / ROOT_MD / NAV_ENABLED / LANGUAGES / SITE_NAME(テーマ(THEME)は聞かない。設定ファイルは THEME=default.css で始まる)

test("promptAnswers: 全てデフォルト値で応答すると既定値が返る", async () => {
  const rl = fakeRl(["", "", "", "", ""]);
  const answers = await promptAnswers(rl);
  assert.deepEqual(answers, {
    triggerBranch: "main",
    rootMd: "README.md",
    navEnabled: true,
    languages: "en",
    siteName: "",
  });
});

test("promptAnswers: テーマ(THEME)とカスタムスタイルは聞かない(5つの質問で終わる。6つ目を聞くと答えが足りずに失敗する)", async () => {
  const asked = [];
  const rl = { question: async (prompt) => (asked.push(prompt), "") };
  const answers = await promptAnswers(rl);
  assert.equal(asked.length, 5);
  assert.ok(!asked.some((q) => /THEME|theme|custom style|custom CSS|custom\.css/i.test(q)));
  assert.equal("theme" in answers, false);
  assert.equal("createStyleFile" in answers, false);
});

test("promptAnswers: ナビ(n で無効)とサイト名を聞き、設定ファイルに書く", async () => {
  const answers = await promptAnswers(fakeRl(["", "", "n", "", "  My Docs  "]));
  assert.equal(answers.navEnabled, false);
  assert.equal(answers.siteName, "My Docs");
  const config = buildDocsPagesConfig(answers);
  assert.ok(config.includes("\nNAV_ENABLED=false\n"));
  assert.ok(config.includes("\nSITE_NAME=My Docs\n"));
  assert.ok(buildDocsPagesConfig({}).includes("\nNAV_ENABLED=true\n"), "既定ではナビを表示する");
});

// console.warn を一時的に差し替えて、出た警告を集める
async function captureWarn(fn) {
  const calls = [];
  const original = console.warn;
  console.warn = (...args) => calls.push(args.join(" "));
  try {
    return { result: await fn(), calls };
  } finally {
    console.warn = original;
  }
}

test("promptAnswers: サイトの言語(LANGUAGES)をサイト名の前に聞き、入力した順のまま設定ファイルに書く", async () => {
  const cases = [
    ["", "en"],
    ["ja", "ja"],
    ["ja, en", "ja,en"],
    [" en , ja ", "en,ja"],
  ];
  for (const [input, expected] of cases) {
    const prompts = [];
    const rl = fakeRl(["", "", "", input, "Site"]);
    const { result: answers, calls } = await captureWarn(() =>
      promptAnswers({ question: (q) => (prompts.push(q), rl.question(q)) }),
    );
    assert.equal(answers.languages, expected, input);
    assert.equal(answers.siteName, "Site", "次の質問はサイト名");
    assert.deepEqual(calls, [], input);
    assert.equal(
      prompts[3],
      "? Site languages (LANGUAGES; comma-separated, the first is the language of your README; e.g. ja / en / ja,en) [en]: ",
    );
    assert.match(prompts[4], /Site name/);
    assert.ok(buildDocsPagesConfig(answers).includes(`\nLANGUAGES=${expected}\n`), input);
  }
});

test("promptAnswers: 不正な言語タグ(ja_JP)は警告して en にする", async () => {
  const { result: answers, calls } = await captureWarn(() => promptAnswers(fakeRl(["", "", "", "ja_JP", ""])));
  assert.equal(answers.languages, "en");
  assert.deepEqual(calls, [
    '[config] "ja_JP" in LANGUAGES is ignored because it is not a valid language tag.',
    '[config] LANGUAGES has no valid language tag. Using "en".',
  ]);
});

test("--languages で対話なしに指定できる。--yes だけなら en", () => {
  const args = parseCliArgs(["--languages", "ja,en"]);
  assert.equal(args.nonInteractive, true);
  assert.equal(answersFromArgs(args).languages, "ja,en");
  assert.equal(answersFromArgs(parseCliArgs(["--languages", " ja , en "])).languages, "ja,en");
  assert.equal(answersFromArgs(parseCliArgs(["--yes"])).languages, "en");
  assert.throws(() => parseCliArgs(["--languages", " "]), /--languages cannot be empty/);
  // 明示した値の書き間違いは --port と同じくエラーで止める(対話の答えは警告して en)
  assert.throws(() => parseCliArgs(["--languages", "ja_JP"]), /^Error: --languages needs language tags separated by commas \(e\.g\. ja \/ en \/ ja,en\) \(given: ja_JP\)$/);
  assert.throws(() => parseCliArgs(["--languages", "ja,ja_JP"]), /--languages needs/);
  assert.throws(() => parseCliArgs(["--languages", ","]), /--languages needs.*\(given: ,\)$/);
  assert.doesNotThrow(() => parseCliArgs(["--languages", "ja,en"]));
  assert.match(buildHelpText(), /--languages <list>\n\s+Site languages \(LANGUAGES; the first is the base language\)\. Default: en\n/);
  assert.match(buildHelpText(), /Giving any of --branch \/ --root \/ --languages \/ --site-name .* also runs without questions/);
  withLang("ja", () => {
    assert.match(buildHelpText(), /--languages <一覧>\n\s+サイトの言語\(LANGUAGES。先頭が基本言語\)。既定: en\n/);
    assert.match(buildHelpText(), /--root \/ --languages \/ --site-name .*のいずれかを指定した場合も、対話なしで実行します/);
  });
});

test("CLI: --languages の不正な値は --port の不正な値と同じ終了コード・形のエラーで止まり、ファイルを作らない", () => {
  const dir = makeTmpDir();
  try {
    const cli = join(PACKAGE_ROOT, "bin/cli.mjs");
    const port = spawnSync(process.execPath, [cli, "--port", "abc"], { cwd: dir, encoding: "utf8" });
    for (const value of ["ja_JP", ","]) {
      const result = spawnSync(process.execPath, [cli, "--languages", value], { cwd: dir, encoding: "utf8" });
      assert.notEqual(result.status, 0, value);
      assert.equal(result.status, port.status, value);
      assert.ok(result.stderr.includes(`--languages needs language tags separated by commas (e.g. ja / en / ja,en) (given: ${value})`), result.stderr);
      // 前後の文言の形も --port のエラーと同じ
      assert.equal(
        result.stderr.replace(/--languages needs.*?\(given: [^)]*\)/, "X"),
        port.stderr.replace(/--port needs.*?\(given: [^)]*\)/, "X"),
        value,
      );
      assert.ok(!existsSync(join(dir, ".github")), value);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: --yes --languages ja で、設定ファイルに LANGUAGES=ja を書く", () => {
  const dir = makeTmpDir();
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    writeFileSync(join(dir, "README.md"), "# x\n");
    const result = spawnSync(process.execPath, [join(PACKAGE_ROOT, "bin/cli.mjs"), "-y", "--languages", "ja"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const config = readFileSync(join(dir, ".github/tsuzuri/config"), "utf8");
    assert.match(config, /^LANGUAGES=ja$/m);
    assert.doesNotMatch(config, /^LANG=/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildDocsPagesConfig: LANG の行は無く、LANGUAGES と説明があり、読み直すと書いた値になる", () => {
  const config = buildDocsPagesConfig({ languages: "ja,en" });
  assert.doesNotMatch(config, /^LANG=/m);
  assert.ok(
    config.includes(
      [
        "# Site languages, comma-separated; the first is the base language (the language of the starting README). Examples: ja / en / ja,en",
        '# With one language you get a single-language site (<html lang="..."> and the interface text use that language).',
        "# With two or more you get a multilingual site (how to place pages: https://akilasatolu.github.io/tsuzuri/docs/i18n.html). If empty, it is en.",
        "LANGUAGES=ja,en",
      ].join("\n"),
    ),
  );
  withLang("ja", () => {
    assert.ok(
      buildDocsPagesConfig({ languages: "ja,en" }).includes(
        [
          "# サイトの言語。カンマ区切りで、先頭が基本言語(起点の README の言語)です。例: ja / en / ja,en",
          '# 1つなら1言語のサイト(ページの言語 <html lang="..."> と画面の文言がその言語になります)。',
          "# 2つ以上なら多言語のサイトになります(ページの置き方: https://akilasatolu.github.io/tsuzuri/docs/i18n.html)。空なら en です。",
          "LANGUAGES=ja,en",
        ].join("\n"),
      ),
    );
  });
  const loaded = loadConfig(parseConfigText(config));
  assert.deepEqual(loaded.languages, ["ja", "en"]);
  assert.deepEqual(loadConfig(parseConfigText(buildDocsPagesConfig({}))).languages, ["en"], "既定は en");
});

test("--site-name / --no-nav で対話なしに指定できる", () => {
  const args = parseCliArgs(["--site-name", "Docs", "--no-nav"]);
  assert.equal(args.nonInteractive, true);
  const answers = answersFromArgs(args);
  assert.equal(answers.siteName, "Docs");
  assert.equal(answers.navEnabled, false);
  assert.equal(answersFromArgs(parseCliArgs(["-y"])).navEnabled, true);
});

test("parseYesNo: y/yes/大文字小文字を真、それ以外・空文字はデフォルト値", () => {
  assert.equal(parseYesNo("y", false), true);
  assert.equal(parseYesNo("Y", false), true);
  assert.equal(parseYesNo("yes", false), true);
  assert.equal(parseYesNo("n", true), false);
  assert.equal(parseYesNo("", false), false);
  assert.equal(parseYesNo("", true), true);
});

// --- ファイル生成の中身のテスト ---

test("buildDocsPagesYml: 自己完結型(OSS本体リポジトリへのuses:呼び出しを持たない)", () => {
  const yml = buildDocsPagesYml();
  // v3以降、OSS本体の再利用可能ワークフロー(build.yml)へのuses:呼び出しは行わない。
  assert.ok(!yml.includes(`uses: ${OSS_REPO}/.github/workflows/build.yml`));
  assert.doesNotMatch(yml, /^\s*uses:\s*akilasatolu\/tsuzuri/m);
});

test("buildDocsPagesYml: build/deployの2ジョブを持ち、ベンダリング先(VENDOR_DIR)のbuild-docs.mjsを実行する", () => {
  const yml = buildDocsPagesYml();
  assert.match(yml, /^\s*build:\s*$/m);
  assert.match(yml, /^\s*deploy:\s*$/m);
  assert.ok(yml.includes(`run: node ${VENDOR_DIR}/build-docs.mjs`));
  assert.ok(yml.includes(`STYLE_DIR: ${VENDOR_DIR}/styles`));
  assert.ok(yml.includes("path: ${{ env.OUT_DIR || '_site' }}"), "OUT_DIR が空でも _site を上げる");
});

test("buildDocsPagesYml: TRIGGER_BRANCH判定・BASE_PATH算出・デプロイの各ステップを持つ", () => {
  const yml = buildDocsPagesYml();
  assert.ok(yml.includes("Check trigger branch"));
  assert.ok(yml.includes("Determine base path / site origin"));
  assert.ok(yml.includes("uses: actions/deploy-pages@"));
});

test("buildDocsPagesYml: 権限は最小限(トップレベルはcontents: readのみ、pages/id-tokenはdeployジョブだけ)", () => {
  const yml = buildDocsPagesYml();
  const [top, jobs] = yml.split("\njobs:\n");
  assert.ok(top.includes("permissions:\n  contents: read\n"));
  assert.doesNotMatch(top, /pages: write|id-token: write/);
  const [buildJob, deployJob] = jobs.split("\n  deploy:\n");
  assert.doesNotMatch(buildJob, /pages: write|id-token: write/);
  assert.ok(deployJob.includes("permissions:\n      pages: write\n      id-token: write\n"));
});

test("buildDocsPagesYml: 設定ファイルは既知のキーだけを取り込み、xargsを使わない", () => {
  const yml = buildDocsPagesYml();
  assert.match(
    yml,
    /TRIGGER_BRANCH\|ROOT_MD\|OUT_DIR\|LANGUAGES\|NAV_ENABLED\|FAVICON_FILE\|SITE_NAME\|CUSTOM_DOMAIN\|OGP_DEFAULT_IMAGE\|THEME\|STRICT_LINKS\|SITEMAP_JSON\|LAST_UPDATED\|EDIT_LINK\|REPO_LINK\|REPO_VERSION\|REPO_LICENSE\|LLMS_TXT\)/
  );
  assert.ok(!yml.includes("| xargs"));
  assert.ok(yml.includes("--ignore-scripts"));
});

test("readDependencyVersion: package.jsonのdevDependenciesの版をそのまま返す", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
  assert.equal(readDependencyVersion("marked"), pkg.devDependencies.marked);
});

test("readDependencyVersion: ^や~などの範囲指定は受け付けない", () => {
  for (const range of ["^12.0.2", "~12.0.2", "12.x", undefined]) {
    const fsImpl = {
      readFileSync: () => JSON.stringify({ devDependencies: { marked: range } }),
    };
    assert.throws(() => readDependencyVersion("marked", "/pkg", fsImpl), /exact version/);
  }
});

test("package.jsonのmarkedとpackage-lock.jsonで実際に入る版が一致している(テストと配布物の版が揃う)", () => {
  const lock = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package-lock.json"), "utf8"));
  assert.equal(lock.packages["node_modules/marked"].version, readDependencyVersion("marked"));
});

test("buildDocsPagesYml: ワークフローのコメントは、ビルド用の依存の版が書いてある package.json を指す", () => {
  const yml = buildDocsPagesYml();
  assert.ok(yml.includes(`The build dependencies go into ${VENDOR_DIR}/node_modules, `));
  assert.ok(yml.includes(`Their versions are written in ${VENDOR_DIR}/package.json and `));
});

test("ビルド用の依存の package.json・package-lock.json を、本体の lockfile の版とハッシュで作る", () => {
  const files = buildBuildLockfiles();
  const pkg = JSON.parse(files.packageJson);
  const lock = JSON.parse(files.packageLock);
  const rootLock = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package-lock.json"), "utf8"));
  assert.equal(pkg.private, true);
  assert.deepEqual(Object.keys(pkg.dependencies), BUILD_DEPENDENCIES);
  assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies);
  for (const name of BUILD_DEPENDENCIES) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.version, pkg.dependencies[name]);
    assert.equal(entry.integrity, rootLock.packages[`node_modules/${name}`].integrity);
    assert.equal(entry.dev, undefined, "dev の印は外す");
  }
  const vendor = buildVendorTargets().map((t) => t.relPath);
  assert.ok(vendor.includes(`${VENDOR_DIR}/package.json`));
  assert.ok(vendor.includes(`${VENDOR_DIR}/package-lock.json`));
  assert.equal(buildBuildLockfiles("/nonexistent", { existsSync: () => false, readFileSync }), null);
});

test("コミットしてあるビルド用の lockfile の完成品が、本体の lockfile から作ったものと一致する", () => {
  // npx の取得物には本体の package-lock.json が入らないので、init はこの完成品をコピーする。
  // 一致しないときは `node scripts/build-lockfiles.mjs` で作り直してコミットする。
  const built = buildBuildLockfiles();
  const committed = readBuildLockfiles();
  const hint =
    `${BUILD_LOCKFILES_DIR}/ が古い。node scripts/build-lockfiles.mjs で作り直して同じPRにコミットする` +
    "(依存を手で更新するときの手順は MAINTAINING.md の「Updating dependencies」)";
  assert.equal(committed.packageJson, built.packageJson, hint);
  assert.equal(committed.packageLock, built.packageLock, hint);
  const vendor = Object.fromEntries(buildVendorTargets().map((t) => [t.relPath, t.content]));
  assert.equal(vendor[`${VENDOR_DIR}/package-lock.json`], committed.packageLock);
  assert.equal(vendor[`${VENDOR_DIR}/package.json`], committed.packageJson);
});

test("ビルド用の lockfile の完成品が無い取得物では、init が中途半端に終わらないようエラーにする", () => {
  assert.throws(() => readBuildLockfiles("/nonexistent", { existsSync: () => false, readFileSync }), /were not found/);
});

test("buildDocsPagesConfig: デフォルト応答でTRIGGER_BRANCH=main/ROOT_MD=README.md、THEME=default.css(STYLE_FILE は無い)", () => {
  const config = buildDocsPagesConfig({
    triggerBranch: "main",
    rootMd: "README.md",
  });
  assert.ok(config.includes("TRIGGER_BRANCH=main"));
  assert.ok(config.includes("ROOT_MD=README.md"));
  assert.ok(config.includes("\nTHEME=default.css\n"));
  assert.ok(config.includes("OUT_DIR=_site"));
  assert.ok(!config.includes("STYLE_FILE"));
});

test("buildDocsPagesConfig: THEME の値は、答えにかかわらず default.css(THEME の質問と --theme は無い)", () => {
  const config = buildDocsPagesConfig({ triggerBranch: "main", rootMd: "README.md", theme: "nineties" });
  assert.ok(config.includes("\nTHEME=default.css\n"));
  assert.ok(!config.includes("nineties"));
});

test("buildDocsPagesConfig: THEME のコメントは、カスタムスタイルをギャラリーからダウンロードして置く手順を案内する", () => {
  const config = buildDocsPagesConfig({});
  assert.ok(config.includes("# The custom style of the whole site: the file name of a CSS file in .github/tsuzuri/styles/"));
  assert.ok(config.includes("# (https://akilasatolu.github.io/tsuzuri/docs/gallery.html), put it in .github/tsuzuri/styles/ and write its file name here."));
  withLang("ja", () => {
    const ja = buildDocsPagesConfig({});
    assert.ok(ja.includes("# サイト全体のカスタムスタイル。.github/tsuzuri/styles/ の中のCSSファイルのファイル名"));
    assert.ok(ja.includes("ダウンロードして .github/tsuzuri/styles/ に置き、ここにそのファイル名を書きます。"));
  });
});

// --- ベンダリング(buildVendorTargets)のテスト ---

test("buildVendorTargets: build-docs.mjs・lib/*.mjs・styles/*.cssが実ファイルの内容そのままでVENDOR_DIR配下として列挙される", () => {
  const targets = buildVendorTargets();

  const buildDocsTarget = targets.find((t) => t.relPath === `${VENDOR_DIR}/build-docs.mjs`);
  assert.ok(buildDocsTarget, "build-docs.mjsが含まれること");
  assert.equal(
    buildDocsTarget.content,
    readFileSync(join(PACKAGE_ROOT, ".github/scripts/build-docs.mjs"), "utf8"),
  );

  const configLibTarget = targets.find((t) => t.relPath === `${VENDOR_DIR}/lib/config.mjs`);
  assert.ok(configLibTarget, "lib/config.mjsが含まれること");
  assert.equal(
    configLibTarget.content,
    readFileSync(join(PACKAGE_ROOT, ".github/scripts/lib/config.mjs"), "utf8"),
  );

  const defaultTarget = targets.find((t) => t.relPath === `${VENDOR_DIR}/styles/default.css`);
  assert.ok(defaultTarget, "styles/default.cssが含まれること");
  assert.equal(defaultTarget.content, readFileSync(join(PACKAGE_ROOT, "styles/default.css"), "utf8"));
  const styleTargets = targets.filter((t) => t.relPath.startsWith(`${VENDOR_DIR}/styles/`)).map((t) => t.relPath).sort();
  assert.deepEqual(styleTargets, [`${VENDOR_DIR}/styles/base.css`, `${VENDOR_DIR}/styles/default.css`], "置くのはベースと default だけ");

  // styles/README.md や styles/fixtures/ のような .css 以外・ディレクトリは対象外
  assert.ok(!targets.some((t) => t.relPath.includes("styles/README.md")));
  assert.ok(!targets.some((t) => t.relPath.includes("fixtures")));
});

test("buildTargets: ワークフロー・設定ファイル・ビルドスクリプト一式を含み、custom.css のひな形は含まない", () => {
  const targets = buildTargets({});
  const vendorCount = buildVendorTargets().length;
  assert.equal(targets.length, 2 + vendorCount);
  assert.ok(!targets.some((t) => t.relPath.endsWith("custom.css")));
  assert.ok(targets.some((t) => t.relPath === `${VENDOR_DIR}/styles/default.css`));
  assert.ok(targets.some((t) => t.relPath === `${VENDOR_DIR}/build-docs.mjs`));
  // どの対象も、既にあれば確認する(確認せずに保持する対象は無い)
  assert.ok(targets.every((t) => !("keepExisting" in t)));
});

// --- ファイル書き出し(writeGeneratedFiles)のテスト ---

test("writeGeneratedFiles: 空ディレクトリに全てデフォルト値で新規生成される", async () => {
  const dir = makeTmpDir();
  try {
    const targets = buildTargets({
      triggerBranch: "main",
      rootMd: "README.md",
    });
    const confirmOverwrite = async () => {
      throw new Error("既存ファイルが無いので呼ばれないはず");
    };
    const results = await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite });

    assert.ok(results.every((r) => r.status === "created"));
    assert.equal(results.length, targets.length);

    const yml = readFileSync(join(dir, ".github/workflows/tsuzuri-pages.yml"), "utf8");
    assert.ok(!yml.includes(`uses: ${OSS_REPO}/.github/workflows/build.yml`));

    const config = readFileSync(join(dir, ".github/tsuzuri/config"), "utf8");
    assert.ok(config.includes("TRIGGER_BRANCH=main"));
    assert.ok(config.includes("ROOT_MD=README.md"));
    assert.ok(config.includes("THEME=default.css"));

    // ベンダリングされたファイルも実際に書き出されていること
    const vendoredBuildDocs = readFileSync(join(dir, VENDOR_DIR, "build-docs.mjs"), "utf8");
    assert.equal(
      vendoredBuildDocs,
      readFileSync(join(PACKAGE_ROOT, ".github/scripts/build-docs.mjs"), "utf8"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: styles/ に base.css と default.css だけが生成され、custom.css は作られない", async () => {
  const dir = makeTmpDir();
  try {
    const targets = buildTargets({});
    await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite: async () => true });
    assert.deepEqual(readdirSync(join(dir, VENDOR_DIR, "styles")).sort(), ["base.css", "default.css"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: 既存ファイルはconfirmOverwriteがfalse(デフォルトN)ならスキップされ内容は変わらない", async () => {
  const dir = makeTmpDir();
  try {
    const ymlPath = join(dir, ".github/workflows/tsuzuri-pages.yml");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    const original = "# 既存のユーザーカスタム内容\n";
    writeFileSync(ymlPath, original);

    const targets = buildTargets({});
    let promptedFor = [];
    const confirmOverwrite = async (relPath) => {
      promptedFor.push(relPath);
      return false; // デフォルトN相当
    };
    const results = await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite });

    assert.deepEqual(promptedFor, [".github/workflows/tsuzuri-pages.yml"]);
    assert.equal(
      results.find((r) => r.relPath === ".github/workflows/tsuzuri-pages.yml").status,
      "skipped",
    );
    assert.equal(readFileSync(ymlPath, "utf8"), original);

    // 他のファイル(config)は確認なしで新規作成されている
    assert.equal(
      results.find((r) => r.relPath === ".github/tsuzuri/config").status,
      "created",
    );
    assert.ok(readFileSync(join(dir, ".github/tsuzuri/config"), "utf8").includes("THEME=default.css"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: 既存ファイルにyで応答すると上書きされる", async () => {
  const dir = makeTmpDir();
  try {
    const ymlPath = join(dir, ".github/workflows/tsuzuri-pages.yml");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(ymlPath, "# 古い内容\n");

    const targets = buildTargets({});
    const results = await writeGeneratedFiles(targets, {
      cwd: dir,
      confirmOverwrite: async () => true,
    });

    assert.equal(
      results.find((r) => r.relPath === ".github/workflows/tsuzuri-pages.yml").status,
      "overwritten",
    );
    const newContent = readFileSync(ymlPath, "utf8");
    assert.ok(!newContent.includes(`uses: ${OSS_REPO}/.github/workflows/build.yml`));
    assert.ok(newContent.includes(`node ${VENDOR_DIR}/build-docs.mjs`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: 全対象のうち1つだけ既存の場合、その1つのみ確認プロンプトが出て残りは確認なしで新規作成される", async () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "# 既存のconfig\n");

    const targets = buildTargets({});

    const promptedFor = [];
    const confirmOverwrite = async (relPath) => {
      promptedFor.push(relPath);
      return true;
    };
    const results = await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite });

    assert.deepEqual(promptedFor, [".github/tsuzuri/config"]);
    assert.equal(results.length, targets.length);
    assert.equal(
      results.find((r) => r.relPath === ".github/tsuzuri/config").status,
      "overwritten",
    );
    assert.ok(
      results
        .filter((r) => r.relPath !== ".github/tsuzuri/config")
        .every((r) => r.status === "created"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: I/Oエラー(書き込み不可)時は例外が送出される", async () => {
  const dir = makeTmpDir();
  try {
    const targets = buildTargets({});
    const fsImpl = {
      existsSync: () => false,
      mkdirSync: () => {
        const err = new Error("EACCES: permission denied, mkdir '.github'");
        err.code = "EACCES";
        throw err;
      },
      writeFileSync: () => {
        throw new Error("should not reach writeFileSync");
      },
    };

    await assert.rejects(
      () =>
        writeGeneratedFiles(targets, {
          cwd: dir,
          confirmOverwrite: async () => false,
          fsImpl,
        }),
      /EACCES/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// createAsker: 非TTY(パイプ相当)の入力を模したReadableでも、複数回question()を
// 呼び出して順番に行を取得できることを確認する(readlineの`question()`単体では
// 非TTY入力で2回目以降が応答を受け取れないという既知の癖の回避策になっている)。
test("createAsker: 非TTY相当の入力でも複数回のquestion()が順に解決する", async () => {
  const input = Readable.from(["\n", "\n", "3\n", "y\n"]);
  const rl = createInterface({ input, terminal: false });
  const asker = createAsker(rl);
  try {
    assert.equal(await asker.question("A: "), "");
    assert.equal(await asker.question("B: "), "");
    assert.equal(await asker.question("C: "), "3");
    assert.equal(await asker.question("D: "), "y");
  } finally {
    rl.close();
  }
});

test("reportFatalError: 分かりやすいエラーメッセージを出力し非ゼロを返す", () => {
  const logs = [];
  const code = reportFatalError(new Error("EACCES: permission denied"), (msg) => logs.push(msg));
  assert.equal(code, 1);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].includes("Error: setup failed."));
  assert.ok(logs[0].includes("EACCES"));
});

// 実際の権限エラー(可能な環境でのみ実行。root実行時はパーミッションチェックが
// バイパスされるためスキップする)によるI/Oエラー時の終了コードを確認する。
test("実ファイルシステムで書き込み権限がない場合、非ゼロ終了コードに相当する例外になる", async (t) => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("root実行環境ではパーミッションチェックがバイパスされるためスキップ");
    return;
  }
  const dir = makeTmpDir();
  try {
    chmodSync(dir, 0o500); // 書き込み不可(読み取り+実行のみ)
    const targets = buildTargets({});
    let caught = null;
    try {
      await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite: async () => false });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "書き込み権限が無い場合は例外が送出されること");
    const exitCode = reportFatalError(caught, () => {});
    assert.equal(exitCode, 1);
  } finally {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- init --update / 直接実行判定 ---

test("buildWorkflowTarget: init と init --update が使うワークフローの生成対象", () => {
  const target = buildWorkflowTarget();
  assert.equal(target.relPath, ".github/workflows/tsuzuri-pages.yml");
  assert.equal(target.content, buildDocsPagesYml());
  assert.deepEqual(buildTargets({}).find((t) => t.name === "tsuzuri-pages.yml"), target);
});

test("runUpdate: ワークフロー・ビルドスクリプト・default.css は上書き・追加し、設定ファイルと利用者のカスタムスタイルは変更しない", async () => {
  const dir = makeTmpDir();
  try {
    const configPath = join(dir, ".github/tsuzuri/config");
    const customCssPath = join(dir, VENDOR_DIR, "styles/my.css");
    const defaultCssPath = join(dir, VENDOR_DIR, "styles/default.css");
    const ymlPath = join(dir, ".github/workflows/tsuzuri-pages.yml");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    mkdirSync(join(dir, VENDOR_DIR, "styles"), { recursive: true });
    writeFileSync(configPath, "TRIGGER_BRANCH=docs\nFAVICON_FILE=assets/favicon.svg\n");
    writeFileSync(customCssPath, "/* my css */");
    writeFileSync(defaultCssPath, "/* edited */");
    writeFileSync(ymlPath, "old workflow");

    const results = await runUpdate({ cwd: dir });

    assert.equal(readFileSync(configPath, "utf8"), "TRIGGER_BRANCH=docs\nFAVICON_FILE=assets/favicon.svg\n");
    assert.equal(readFileSync(customCssPath, "utf8"), "/* my css */");
    assert.equal(readFileSync(ymlPath, "utf8"), buildDocsPagesYml());
    assert.ok(existsSync(join(dir, VENDOR_DIR, "build-docs.mjs")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "lib/site-tree.mjs")));
    assert.ok(!results.some((r) => r.relPath.endsWith("tsuzuri/config")));
    assert.ok(!results.some((r) => r.relPath.endsWith("my.css")), "利用者のカスタムスタイルは結果に出ない(触らない)");
    assert.equal(readFileSync(defaultCssPath, "utf8"), readFileSync(join(PACKAGE_ROOT, "styles/default.css"), "utf8"), "default.css は上書きされる");
    assert.equal(results.find((r) => r.relPath === `${VENDOR_DIR}/styles/default.css`).status, "overwritten");
    assert.equal(results.find((r) => r.relPath === ".github/workflows/tsuzuri-pages.yml").status, "overwritten");
    assert.deepEqual(results.filter((r) => r.status === "skipped"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runUpdate: 設定ファイルだけのリポジトリでも default.css を作り、custom.css のひな形は作らない", async () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "TRIGGER_BRANCH=main\n");
    const results = await runUpdate({ cwd: dir });
    assert.equal(results.find((r) => r.relPath === `${VENDOR_DIR}/styles/default.css`).status, "created");
    assert.ok(!existsSync(join(dir, VENDOR_DIR, "styles/custom.css")));
    assert.deepEqual(readdirSync(join(dir, VENDOR_DIR, "styles")).sort(), ["base.css", "default.css"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runUpdate: 設定ファイルが無い(未init)リポジトリではエラーにして何も書き込まない", async () => {
  const dir = makeTmpDir();
  try {
    await assert.rejects(() => runUpdate({ cwd: dir }), /\.github\/tsuzuri\/config not found/);
    assert.ok(!existsSync(join(dir, ".github")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("isDirectRunOf: シンボリックリンク経由(npxの.bin)でも直接実行と判定する", () => {
  const dir = makeTmpDir();
  try {
    const cliPath = join(PACKAGE_ROOT, "bin/cli.mjs");
    const linkPath = join(dir, "tsuzuri");
    symlinkSync(cliPath, linkPath);
    const moduleUrl = pathToFileURL(cliPath).href;
    assert.equal(isDirectRunOf(moduleUrl, cliPath), true);
    assert.equal(isDirectRunOf(moduleUrl, linkPath), true);
    assert.equal(isDirectRunOf(moduleUrl, join(PACKAGE_ROOT, "package.json")), false);
    assert.equal(isDirectRunOf(moduleUrl, undefined), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("シンボリックリンク経由で実行した init --update が実際にファイルを更新する", () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "TRIGGER_BRANCH=main\n");
    const linkPath = join(dir, "tsuzuri-bin");
    symlinkSync(join(PACKAGE_ROOT, "bin/cli.mjs"), linkPath);

    const result = spawnSync(process.execPath, [linkPath, "init", "--update"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(dir, ".github/workflows/tsuzuri-pages.yml")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "build-docs.mjs")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- ワークフローのひな形 ---

test("buildDocsPagesYml: ひな形のプレースホルダーとヘッダーコメントが出力に残らない", () => {
  const yml = buildDocsPagesYml();
  assert.doesNotMatch(yml, /__[A-Z_]+__/);
  assert.doesNotMatch(yml, /template start/);
  assert.ok(yml.startsWith('name: "Tsuzuri: Deploy to GitHub Pages"\n'));
  assert.ok(yml.includes(`CONFIG_FILE="${CONFIG_FILE_PATH}"\n`), "Load config が読む設定ファイルは CONFIG_FILE_PATH と同じ");
  assert.ok(yml.includes(`STYLE_DIR: ${VENDOR_DIR}/styles`));
});

test("buildDocsPagesYml: Node.js 24を使い、SITE_ORIGINにはパスを含めない(canonicalのパス二重化を防ぐ)", () => {
  const yml = buildDocsPagesYml();
  assert.ok(yml.includes("node-version: 24"));
  assert.ok(yml.includes('SITE_ORIGIN="https://${OWNER}.github.io"\n'));
  assert.doesNotMatch(yml, /SITE_ORIGIN="[^"]*\$\{BASE_PATH\}/);
});

test("ワークフローのactionsはコミットSHAで固定され、本体のCIと生成ワークフローで版がそろっている", () => {
  const usesOf = (text) =>
    Object.fromEntries([...text.matchAll(/uses: (actions\/[\w-]+)@([0-9a-f]+) # (v[\d.]+)/g)].map((m) => [m[1], m[2]]));
  const template = readFileSync(join(PACKAGE_ROOT, WORKFLOW_TEMPLATE_PATH), "utf8");
  const ci = readFileSync(join(PACKAGE_ROOT, ".github/workflows/ci.yml"), "utf8");
  const release = readFileSync(join(PACKAGE_ROOT, ".github/workflows/release.yml"), "utf8");
  const pages = readFileSync(join(PACKAGE_ROOT, ".github/workflows/tsuzuri-pages.yml"), "utf8");
  const tplUses = usesOf(template);
  for (const sha of Object.values(tplUses)) assert.match(sha, /^[0-9a-f]{40}$/);
  for (const other of [usesOf(ci), usesOf(release), usesOf(pages)]) {
    for (const [action, sha] of Object.entries(other)) {
      if (tplUses[action]) assert.equal(tplUses[action], sha, `${action} の版が本体のワークフローとひな形で異なる`);
    }
  }
  assert.ok(tplUses["actions/upload-pages-artifact"] && tplUses["actions/deploy-pages"]);
});

// --- 完了メッセージ・--update の不要ファイル削除・STRICT_LINKS ---

test("buildCompletionMessage: 選んだトリガーブランチ・起点のMarkdownとGitHub側の設定手順を案内する", () => {
  const msg = buildCompletionMessage({ triggerBranch: "docs", rootMd: "index.md" });
  assert.match(msg, /Make sure index\.md is in the repository/);
  assert.match(msg, /push to the docs branch/);
  assert.match(msg, /add docs under Settings > Environments >\n\s+github-pages > "Deployment branches and tags"/);
  assert.match(msg, /set Source to "GitHub Actions"/);
  assert.match(msg, /init --update/);
  assert.doesNotMatch(msg, /push to the main branch/);
  withLang("ja", () => {
    const ja = buildCompletionMessage({ triggerBranch: "docs", rootMd: "index.md" });
    assert.match(ja, /index\.md がリポジトリにあることを確認/);
    assert.match(ja, /docs ブランチへ push/);
    assert.match(ja, /github-pages の「Deployment branches and tags」に docs を追加/);
    assert.match(ja, /Source を「GitHub Actions」/);
    assert.match(ja, /init --update/);
    assert.doesNotMatch(ja, /mainブランチへpush/);
  });
});

test("runUpdate: 配布対象に無くなった lib/*.mjs は削除し、styles/ の利用者のカスタムスタイルは残す", async () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "TRIGGER_BRANCH=main\n");
    mkdirSync(join(dir, VENDOR_DIR, "lib"), { recursive: true });
    mkdirSync(join(dir, VENDOR_DIR, "styles"), { recursive: true });
    writeFileSync(join(dir, VENDOR_DIR, "lib/removed-module.mjs"), "// old");
    writeFileSync(join(dir, VENDOR_DIR, "lib/notes.txt"), "keep");
    writeFileSync(join(dir, VENDOR_DIR, "styles/my.css"), "/* mine */");
    writeFileSync(join(dir, VENDOR_DIR, "styles/material.css"), "/* old built-in */");

    const results = await runUpdate({ cwd: dir });

    assert.ok(!existsSync(join(dir, VENDOR_DIR, "lib/removed-module.mjs")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "lib/notes.txt")), ".mjs 以外は削除しない");
    assert.ok(existsSync(join(dir, VENDOR_DIR, "lib/config.mjs")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "styles/my.css")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "styles/material.css")), "styles/ は削除の対象にしない(古い material.css も消さない)");
    assert.deepEqual(
      results.filter((r) => r.status === "deleted").map((r) => r.relPath),
      [`${VENDOR_DIR}/lib/removed-module.mjs`]
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runUpdate: 利用者が編集する config と styles/ のカスタムスタイルは書き換えず、VENDOR_DIR 直下の未知のファイルも削除しない", async () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, VENDOR_DIR, "styles"), { recursive: true });
    writeFileSync(join(dir, CONFIG_FILE_PATH), "TRIGGER_BRANCH=keep\nTHEME=my.css\n");
    writeFileSync(join(dir, VENDOR_DIR, "styles/my.css"), "/* mine */");
    writeFileSync(join(dir, VENDOR_DIR, "styles/plain.css"), "/* mine 2 */");
    writeFileSync(join(dir, VENDOR_DIR, "stray.txt"), "keep");

    const results = await runUpdate({ cwd: dir });

    assert.equal(readFileSync(join(dir, CONFIG_FILE_PATH), "utf8"), "TRIGGER_BRANCH=keep\nTHEME=my.css\n");
    assert.equal(readFileSync(join(dir, VENDOR_DIR, "styles/my.css"), "utf8"), "/* mine */");
    assert.equal(readFileSync(join(dir, VENDOR_DIR, "styles/plain.css"), "utf8"), "/* mine 2 */", "styles/ に足したカスタムスタイルも残る");
    assert.ok(existsSync(join(dir, VENDOR_DIR, "stray.txt")));
    assert.ok(!results.some((r) => r.relPath === CONFIG_FILE_PATH), "config は更新の結果に出ない");
    assert.ok(!results.some((r) => r.status === "deleted"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildCompletionMessage: VENDOR_DIR の中で編集してよいのは config と styles/ の自分のカスタムスタイルだけ、と案内する", () => {
  const msg = buildCompletionMessage({});
  assert.ok(msg.includes(`(In ${VENDOR_DIR}/, you may edit only the settings file config and your own custom styles in styles/. Do not edit base.css, default.css and the scripts.)`));
  withLang("ja", () => {
    assert.ok(buildCompletionMessage({}).includes(`(${VENDOR_DIR}/ 配下で編集してよいのは、設定ファイル config と、styles/ に置く自分のカスタムスタイルだけです。base.css・default.css・スクリプトは編集しないでください)`));
  });
});

test("init の生成物: VENDOR_DIR の外に作られるのはワークフローだけで、旧名のファイルは作らない", () => {
  const rels = buildTargets({}).map((t) => t.relPath);
  assert.deepEqual(
    rels.filter((r) => !r.startsWith(`${VENDOR_DIR}/`)),
    [".github/workflows/tsuzuri-pages.yml"]
  );
  assert.ok(rels.includes(CONFIG_FILE_PATH));
  assert.ok(!rels.includes(".github/docs-pages.config"));
  assert.ok(!rels.includes(".github/workflows/docs-pages.yml"));
});

test("STRICT_LINKS: 設定ファイルのひな形に既定値falseで含まれ、ワークフローの許可リストを通って環境変数になる", () => {
  assert.ok(buildDocsPagesConfig({}).includes("\nSTRICT_LINKS=false\n"));
  const yml = buildDocsPagesYml();
  assert.match(yml, /\|STRICT_LINKS\|/);
  assert.ok(!yml.includes("STRICT_LINKS: ${{ env.STRICT_LINKS }}"), "Build の env には書き写さない");
});

// --- コマンドライン引数・バージョン表示 ---

test("parseCliArgs: 引数なし・init だけなら対話モード", () => {
  for (const argv of [[], ["init"]]) {
    const args = parseCliArgs(argv);
    assert.equal(args.nonInteractive, false);
    assert.equal(args.update, false);
  }
});

test("parseCliArgs: --yes や値の指定があれば対話なし。値は answersFromArgs で回答になる", () => {
  assert.equal(parseCliArgs(["-y"]).nonInteractive, true);
  const args = parseCliArgs(["init", "--branch", "docs", "--root", "index.md"]);
  assert.equal(args.nonInteractive, true);
  assert.deepEqual(answersFromArgs(args), {
    triggerBranch: "docs",
    rootMd: "index.md",
    navEnabled: true,
    languages: "en",
    siteName: "",
  });
  assert.deepEqual(answersFromArgs(parseCliArgs(["--yes"])), {
    triggerBranch: "main",
    rootMd: "README.md",
    navEnabled: true,
    languages: "en",
    siteName: "",
  });
});

test("parseCliArgs: 不明なオプション・サブコマンド、空の値はエラー(--theme は削除した)", () => {
  assert.throws(() => parseCliArgs(["--bogus"]), /Invalid arguments/);
  assert.throws(() => parseCliArgs(["--style"]), /Invalid arguments/, "--style は削除した");
  assert.throws(() => parseCliArgs(["--theme", "nineties"]), /Invalid arguments/, "--theme は削除した(THEME の質問もない)");
  assert.throws(() => parseCliArgs(["deploy"]), /Unknown subcommand/);
  assert.throws(() => parseCliArgs(["--branch", " "]), /--branch cannot be empty/);
  withLang("ja", () => {
    assert.throws(() => parseCliArgs(["--bogus"]), /引数が正しくありません/);
    assert.throws(() => parseCliArgs(["deploy"]), /不明なサブコマンド/);
    assert.throws(() => parseCliArgs(["--theme", "nineties"]), /引数が正しくありません/);
    assert.throws(() => parseCliArgs(["--branch", " "]), /--branch に空の値/);
  });
});

test("parseCliArgs: preview サブコマンドと --port", () => {
  assert.equal(parseCliArgs([]).command, "init");
  const args = parseCliArgs(["preview"]);
  assert.equal(args.command, "preview");
  assert.equal(args.port, 4000);
  assert.equal(parseCliArgs(["preview", "--port", "4001"]).port, 4001);
  assert.equal(parseCliArgs(["preview"])["no-watch"], false);
  assert.equal(parseCliArgs(["preview", "--no-watch"])["no-watch"], true);
  assert.equal(parseCliArgs(["preview", "--open"]).open, true);
  assert.equal(parseCliArgs(["preview"]).open, false);
  assert.throws(() => parseCliArgs(["preview", "--port", "abc"]), /--port needs/);
  assert.throws(() => parseCliArgs(["preview", "--port", "70000"]), /--port needs/);
  assert.throws(() => parseCliArgs(["init", "preview"]), /Unknown subcommand/);
});

test("preview: init していないリポジトリではエラーにする", () => {
  const dir = mkdtempSync(join(tmpdir(), "tsuzuri-preview-cli-"));
  try {
    const result = spawnSync(process.execPath, [join(PACKAGE_ROOT, "bin/cli.mjs"), "preview"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Run init first/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseCliArgs: -v / -h / --update / --force", () => {
  assert.equal(parseCliArgs(["-v"]).version, true);
  assert.equal(parseCliArgs(["-h"]).help, true);
  assert.equal(parseCliArgs(["init", "--update"]).update, true);
  assert.equal(parseCliArgs(["-y", "--force"]).force, true);
});

test("buildHelpText: 主なオプションを説明している(en・ja とも。--theme は無い)", () => {
  for (const lang of ["en", "ja"]) {
    withLang(lang, () => {
      const help = buildHelpText();
      for (const word of ["--update", "--yes", "--branch", "--root", "--force", "--version", "--lang"]) {
        assert.ok(help.includes(word), `${lang}: ${word}`);
      }
      assert.ok(!help.includes("--style"));
      assert.ok(!help.includes("--theme"));
      assert.ok(!help.includes("nineties"));
    });
  }
});

test("readPackageVersion / readDependencyVersion: package.json の値を返す", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
  assert.equal(readPackageVersion(), pkg.version);
  assert.equal(readDependencyVersion("marked"), pkg.devDependencies.marked);
  assert.throws(() => readDependencyVersion("not-a-dependency"), /exact version/);
});

test("buildDocsPagesYml: 生成に使った tsuzuri のバージョンを先頭のコメントに入れる", () => {
  assert.ok(buildDocsPagesYml().includes(`# tsuzuri v${readPackageVersion()} generated this self-contained workflow with npx github:`));
});

test("CLIを実行すると最初にバージョンを表示し、--yes で対話なしに生成し、既存ファイルは --force が無ければスキップ", () => {
  const dir = makeTmpDir();
  try {
    const cli = join(PACKAGE_ROOT, "bin/cli.mjs");
    const version = readPackageVersion();
    let result = spawnSync(process.execPath, [cli, "--version"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.stdout.trim(), version);

    result = spawnSync(process.execPath, [cli, "init", "--yes", "--branch", "docs"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.startsWith(`tsuzuri v${version}\n`));
    assert.match(readFileSync(join(dir, ".github/tsuzuri/config"), "utf8"), /^TRIGGER_BRANCH=docs$/m);

    writeFileSync(join(dir, ".github/tsuzuri/config"), "TRIGGER_BRANCH=keep\n");
    result = spawnSync(process.execPath, [cli, "-y"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, ".github/tsuzuri/config"), "utf8"), "TRIGGER_BRANCH=keep\n");

    result = spawnSync(process.execPath, [cli, "-y", "--force"], { cwd: dir, encoding: "utf8" });
    assert.match(readFileSync(join(dir, ".github/tsuzuri/config"), "utf8"), /^TRIGGER_BRANCH=main$/m);

    result = spawnSync(process.execPath, [cli, "--bogus"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid arguments/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("package.json の engines で対応する Node.js の最低バージョンを示している", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.engines.node, ">=20");
});

test("ビルド用の依存(BUILD_DEPENDENCIES)はすべて package.json の版(完全一致)で、lockfileと一致している", () => {
  const lock = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package-lock.json"), "utf8"));
  for (const name of BUILD_DEPENDENCIES) {
    assert.equal(lock.packages[`node_modules/${name}`].version, readDependencyVersion(name), name);
  }
  assert.deepEqual(BUILD_DEPENDENCIES, ["marked", "highlight.js", "marked-footnote"]);
});

test("LAST_UPDATED=true のときだけ git の全履歴を取得するステップがある", () => {
  const yml = buildDocsPagesYml();
  assert.ok(
    yml.includes(
      "if: steps.trigger.outputs.should_deploy != 'false' && env.LAST_UPDATED == 'true'\n" +
        "        run: git fetch --unshallow --quiet || true"
    )
  );
  assert.ok(buildDocsPagesConfig({}).includes("\nLAST_UPDATED=false\n"));
});

test("生成ワークフロー: 依存は利用者の package.json と切り離して VENDOR_DIR に lockfile どおり入れ、署名を確かめる", () => {
  const yml = buildDocsPagesYml();
  assert.ok(yml.includes(`npm ci --prefix ${VENDOR_DIR} --ignore-scripts --no-audit --no-fund\n`));
  assert.ok(yml.includes(`npm audit signatures --prefix ${VENDOR_DIR}\n`));
  assert.doesNotMatch(yml, /npm install/);
});

test("生成ワークフロー: 実行はブランチごとに順番に進め(他ブランチは別グループ)、公開は全体で1つずつ", () => {
  const yml = buildDocsPagesYml();
  const [top, jobs] = yml.split("\njobs:\n");
  assert.ok(top.includes("concurrency:\n  group: tsuzuri-pages-${{ github.ref }}\n  cancel-in-progress: false\n"));
  const [buildJob, deployJob] = jobs.split("\n  deploy:\n");
  assert.doesNotMatch(buildJob, /concurrency:/);
  assert.ok(deployJob.includes("    concurrency:\n      group: pages\n      cancel-in-progress: false\n"));
});

test("更新の案内はメジャーバージョンのタグ付き(未リリースの main を使わせない)", () => {
  const tag = majorTagOf(readPackageVersion());
  assert.equal(majorTagOf("1.2.3"), "v1");
  assert.ok(buildDocsPagesYml().includes(`npx github:${OSS_REPO}#${tag} init --update`));
  assert.ok(buildCompletionMessage({}).includes(`npx github:${OSS_REPO}#${tag} init --update`));
  assert.doesNotMatch(buildDocsPagesYml(), /npx github:[^#\s]+ init/);
});

test("isBundledPath: ワークフローとビルドスクリプト一式(base.css・default.css を含む)が対象(設定ファイルは対象外)", () => {
  assert.equal(isBundledPath(".github/workflows/tsuzuri-pages.yml"), true);
  assert.equal(isBundledPath(`${VENDOR_DIR}/build-docs.mjs`), true);
  assert.equal(isBundledPath(`${VENDOR_DIR}/styles/base.css`), true);
  assert.equal(isBundledPath(`${VENDOR_DIR}/styles/default.css`), true);
  assert.equal(isBundledPath(CONFIG_FILE_PATH), false);
  assert.equal(isBundledPath(".github/tsuzuri/config"), false);
});

test("createBundledConfirm: 一式は1回だけ聞いて同じ答えを使い、設定ファイルは個別に聞く", async () => {
  const questions = [];
  const answers = [true, false];
  const confirm = createBundledConfirm(async (q) => {
    questions.push(q);
    return answers.shift();
  });
  assert.equal(await confirm(".github/workflows/tsuzuri-pages.yml"), true);
  assert.equal(await confirm(`${VENDOR_DIR}/build-docs.mjs`), true);
  assert.equal(await confirm(`${VENDOR_DIR}/lib/config.mjs`), true);
  assert.equal(await confirm(".github/tsuzuri/config"), false);
  assert.equal(questions.length, 2);
  assert.match(questions[0], /The workflow and the build scripts/);
  assert.match(questions[0], /except config\)/);
  assert.equal(await confirm(`${VENDOR_DIR}/styles/default.css`), true, "default.css も一式の答えに従う");
  assert.match(questions[1], /\.github\/tsuzuri\/config already exists/);
});

test("buildDocsPagesConfig: LLMS_TXT=true をコメント付きで書く", () => {
  const config = buildDocsPagesConfig({});
  assert.match(config, /^LLMS_TXT=true$/m);
  assert.match(config, /# [^\n]*llms\.txt[^\n]*\n# [^\n]*SITE_ORIGIN[^\n]*\n# [^\n]*llms\.txt[^\n]*\nLLMS_TXT=true/);
  assert.ok(config.indexOf("LLMS_TXT=true") < config.indexOf("SITEMAP_JSON=false"));
});

test("生成する設定ファイル・CSSひな形に、開発側の内部的な言い回しを含めない", () => {
  const config = buildDocsPagesConfig({});
  for (const word of ["★", "詳細設計", "後方互換", "現行", "build-docs.mjs", "ハードコード"]) {
    assert.ok(!config.includes(word), `設定ファイルに「${word}」が含まれる`);
  }
  for (const key of ["TRIGGER_BRANCH", "ROOT_MD", "OUT_DIR", "THEME", "LANGUAGES", "NAV_ENABLED", "FAVICON_FILE", "SITE_NAME", "CUSTOM_DOMAIN", "OGP_DEFAULT_IMAGE", "STRICT_LINKS", "LAST_UPDATED", "EDIT_LINK", "REPO_LINK", "REPO_VERSION", "REPO_LICENSE", "SITEMAP_JSON", "LLMS_TXT"]) {
    assert.match(config, new RegExp(`^${key}=`, "m"), key);
  }
  assert.doesNotMatch(config, /^STYLE_FILE=/m);
});

test("missingConfigKeys: 最新のひな形にあって設定ファイルに無いキーを返す(コメント内のキーは数えない)", () => {
  const old = ["TRIGGER_BRANCH=main", "# LAST_UPDATED=true", "THEME=default.css", "NAV_ENABLED=true"].join("\n");
  const missing = missingConfigKeys(old);
  assert.ok(missing.includes("LAST_UPDATED"));
  assert.ok(missing.includes("STRICT_LINKS"));
  assert.ok(!missing.includes("THEME"));
  assert.deepEqual(missingConfigKeys(buildDocsPagesConfig({})), []);
  // リポジトリ情報の3キー(REPO_VERSION・REPO_LICENSE は値が空のひな形 "KEY=")も、古い設定ファイルには案内される
  for (const key of ["REPO_LINK", "REPO_VERSION", "REPO_LICENSE"]) assert.ok(missing.includes(key), key);
  assert.deepEqual(missingConfigKeys(`${old}\nREPO_LINK=true\nREPO_VERSION=\nREPO_LICENSE=MIT\n`).filter((k) => k.startsWith("REPO_")), []);
  // LLMS_TXT は既定で有効のキー。古い設定ファイルには案内されるが、書かなくても有効で動く
  assert.ok(missing.includes("LLMS_TXT"));
  assert.deepEqual(missingConfigKeys(`${old}\nLLMS_TXT=false\n`).filter((k) => k === "LLMS_TXT"), []);
  // 古い設定ファイル(LANG だけで LANGUAGES が無いもの)には、LANGUAGES が「設定ファイルに無い項目」として出る
  const oldLang = missingConfigKeys("TRIGGER_BRANCH=main\nLANG=ja\nTHEME=default.css\n");
  assert.ok(oldLang.includes("LANGUAGES"));
  assert.ok(!oldLang.includes("LANG"));
});

test("runUpdate: 設定ファイルに無い新しい項目を案内する(設定ファイルは書き換えない)", async () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "TRIGGER_BRANCH=main\nTHEME=default.css\n");
    const logs = [];
    await runUpdate({ cwd: dir, log: (m) => logs.push(m) });
    const notice = logs.find((m) => m.includes("Keys missing from the settings file"));
    assert.ok(notice && notice.includes("LAST_UPDATED") && notice.includes("configuration.html"));
    assert.equal(readFileSync(join(dir, ".github/tsuzuri/config"), "utf8"), "TRIGGER_BRANCH=main\nTHEME=default.css\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- init を実行する場所・既定ブランチ・.gitignore ---

test("checkSetupLocation: リポジトリ直下なら注意なし、サブディレクトリ・git外なら注意を返す", () => {
  const exists = (p) => p === "/repo/.git";
  assert.equal(findRepoRoot("/repo/sub/dir", exists), "/repo");
  assert.deepEqual(checkSetupLocation("/repo", exists), []);
  assert.match(checkSetupLocation("/repo/sub", exists)[0], /This is not the root of the repository \(root: \/repo\)/);
  assert.match(checkSetupLocation("/elsewhere", exists)[0], /does not look like a git repository/);
  withLang("ja", () => {
    assert.match(checkSetupLocation("/repo/sub", exists)[0], /リポジトリの直下ではありません\(直下: \/repo\)/);
    assert.match(checkSetupLocation("/elsewhere", exists)[0], /git リポジトリの中ではない/);
  });
});

test("guessDefaultBranch: origin/HEAD → 今のブランチ → main の順に推測する", () => {
  assert.equal(guessDefaultBranch("/r", () => "origin/develop\n"), "develop");
  const noRemote = (args) => {
    if (args[0] === "symbolic-ref") throw new Error("no remote");
    return "docs\n";
  };
  assert.equal(guessDefaultBranch("/r", noRemote), "docs");
  assert.equal(guessDefaultBranch("/r", () => { throw new Error("no git"); }), "main");
  // 対話なし(useCurrentBranch: false)では今のブランチを使わない
  assert.equal(guessDefaultBranch("/r", noRemote, { useCurrentBranch: false }), "main");
  assert.equal(guessDefaultBranch("/r", () => "origin/develop\n", { useCurrentBranch: false }), "develop");
});

test("init は .github/tsuzuri/.gitignore(node_modules/)も生成し、--update でも更新対象になる", () => {
  const target = buildVendorTargets().find((t) => t.relPath === `${VENDOR_DIR}/.gitignore`);
  assert.ok(target);
  assert.match(target.content, /^node_modules\/$/m);
  assert.equal(isBundledPath(`${VENDOR_DIR}/.gitignore`), true);
});

test("CLI: リポジトリ直下以外・ROOT_MDが無いときは警告し、--yes の既定ブランチは今のブランチを使わない", () => {
  const dir = makeTmpDir();
  try {
    const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q", "-b", "pages");
    mkdirSync(join(dir, "sub"));
    const cli = join(PACKAGE_ROOT, "bin/cli.mjs");
    let result = spawnSync(process.execPath, [cli, "-y", "--root", "nope.md"], { cwd: join(dir, "sub"), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /This is not the root of the repository/);
    assert.match(result.stderr, /The root file nope\.md does not exist yet/);

    writeFileSync(join(dir, "README.md"), "# x\n");
    result = spawnSync(process.execPath, [cli, "-y"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /not the root of the repository|does not exist yet/);
    // origin が無いので、作業中のブランチ(pages)ではなく main になる
    assert.match(readFileSync(join(dir, ".github/tsuzuri/config"), "utf8"), /^TRIGGER_BRANCH=main$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 生成ワークフローのシェル部分を実際に動かす ---

test("生成ワークフローの Load config: CRLF・引用符・=を含む値・未知のキー・末尾に改行の無い行を正しく読む", () => {
  const dir = makeTmpDir();
  try {
    const yml = buildDocsPagesYml();
    const m = yml.match(/- name: Load config\n {8}run: \|\n((?: {10}.*\n|\n)+?)(?= {6}[-#])/);
    assert.ok(m, "Load config ステップを取り出せること");
    const script = m[1].split("\n").map((line) => line.slice(10)).join("\n");
    writeFileSync(join(dir, "load.sh"), script);
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(
      join(dir, ".github/tsuzuri/config"),
      "# comment\r\nSITE_NAME = Bob's \"docs\"  \r\nOGP_DEFAULT_IMAGE=https://x.example/a.png?w=1&h=2\r\n\r\nNODE_OPTIONS=--require x\nTHEME=nineties.css  # 暗い配色\nLANG=en\nLANGUAGES=en"
    );
    const envFile = join(dir, "github.env");
    const result = spawnSync("bash", ["-e", "load.sh"], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_ENV: envFile } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Ignoring unknown setting key NODE_OPTIONS/);
    const env = readFileSync(envFile, "utf8");
    assert.match(env, /^SITE_NAME=Bob's "docs"$/m);
    assert.match(env, /^OGP_DEFAULT_IMAGE=https:\/\/x\.example\/a\.png\?w=1&h=2$/m);
    assert.match(env, /^THEME=nineties\.css {2}# 暗い配色$/m, "行の途中の#はコメントにならない(ドキュメントどおり)");
    assert.match(env, /^LANGUAGES=en$/m, "末尾に改行の無い最後の行も読む");
    // LANG は設定キーではない(言語は LANGUAGES だけ): ほかの未知のキーと同じく警告して、GITHUB_ENV には入れない
    assert.match(result.stdout, /::warning::Ignoring unknown setting key LANG/);
    assert.doesNotMatch(env, /^LANG=/m);
    assert.doesNotMatch(env, /NODE_OPTIONS|\r/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("生成ワークフローの Load config: 値が空の TRIGGER_BRANCH= は、空の値として取り込む", () => {
  const dir = makeTmpDir();
  try {
    const m = buildDocsPagesYml().match(/- name: Load config\n {8}run: \|\n((?: {10}.*\n|\n)+?)(?= {6}[-#])/);
    assert.ok(m, "Load config ステップを取り出せること");
    writeFileSync(join(dir, "load.sh"), m[1].split("\n").map((line) => line.slice(10)).join("\n"));
    mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "TRIGGER_BRANCH=  \nTHEME=default.css\n");
    const envFile = join(dir, "github.env");
    const result = spawnSync("bash", ["-e", "load.sh"], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_ENV: envFile } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(envFile, "utf8"), /^TRIGGER_BRANCH=$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Check trigger branch ステップの run を取り出して動かす。
// triggerBranch / defaultBranch が undefined のときは、その環境変数を渡さない(設定ファイルにキーが無い場合)。
// テストを動かす側の環境に同じ名前の変数があっても結果が変わらないよう、先に2つとも外す。
function runCheckTriggerBranch({ triggerBranch, defaultBranch, currentBranch, eventName = "push" }) {
  const dir = makeTmpDir();
  try {
    const m = buildDocsPagesYml().match(
      /- name: Check trigger branch\n(?: {8}.*\n)*? {8}run: \|\n((?: {10}.*\n|\n)+?)(?= {6}[-#])/
    );
    assert.ok(m, "Check trigger branch ステップを取り出せること");
    const script = m[1].split("\n").map((line) => line.slice(10)).join("\n");
    assert.ok(!script.includes("${{"), "式(${{ }})をシェルに直接埋め込まない");
    writeFileSync(join(dir, "check.sh"), script);
    const outputFile = join(dir, "github.output");
    writeFileSync(outputFile, "");
    const env = { ...process.env };
    delete env.TRIGGER_BRANCH;
    delete env.DEFAULT_BRANCH;
    if (triggerBranch !== undefined) env.TRIGGER_BRANCH = triggerBranch;
    if (defaultBranch !== undefined) env.DEFAULT_BRANCH = defaultBranch;
    Object.assign(env, { CURRENT_BRANCH: currentBranch, EVENT_NAME: eventName, GITHUB_OUTPUT: outputFile });
    const result = spawnSync("bash", ["-e", "check.sh"], { cwd: dir, encoding: "utf8", env });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, output: readFileSync(outputFile, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const DEFAULT_BRANCH_LOG = (branch) =>
  `The settings file has no TRIGGER_BRANCH (or it is empty), so the repository's default branch ${branch} is used`;

test("生成ワークフローの Check trigger branch: リポジトリの既定ブランチを環境変数 DEFAULT_BRANCH で受け取る", () => {
  assert.ok(buildDocsPagesYml().includes("          DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}\n"));
});

test("生成ワークフローの Check trigger branch: TRIGGER_BRANCH が無い・空なら、リポジトリの既定ブランチへの push で公開する", () => {
  // キーが無い。既定ブランチは main でも master でも、そのブランチへの push で公開する
  for (const branch of ["main", "master"]) {
    const r = runCheckTriggerBranch({ defaultBranch: branch, currentBranch: branch });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.output, "should_deploy=true\n");
    assert.ok(r.stdout.includes(DEFAULT_BRANCH_LOG(branch)), r.stdout);
  }
  // 値が空(TRIGGER_BRANCH=)でも同じ
  const empty = runCheckTriggerBranch({ triggerBranch: "", defaultBranch: "main", currentBranch: "main" });
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.output, "should_deploy=true\n");
  assert.ok(empty.stdout.includes(DEFAULT_BRANCH_LOG("main")), empty.stdout);
});

test("生成ワークフローの Check trigger branch: TRIGGER_BRANCH が無いとき、既定ブランチ以外への push は公開しない(手動実行は公開する)", () => {
  // 既定ブランチが master のリポジトリで main に push
  let r = runCheckTriggerBranch({ defaultBranch: "master", currentBranch: "main" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=false\n");
  assert.ok(r.stdout.includes(DEFAULT_BRANCH_LOG("master")), r.stdout);
  assert.ok(r.stdout.includes("Skipping because this push (main) is not to TRIGGER_BRANCH=master"), r.stdout);

  r = runCheckTriggerBranch({ defaultBranch: "main", currentBranch: "feature/foo" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=false\n");
  assert.ok(r.stdout.includes(DEFAULT_BRANCH_LOG("main")), r.stdout);
  assert.ok(r.stdout.includes("Skipping because this push (feature/foo) is not to TRIGGER_BRANCH=main"), r.stdout);

  r = runCheckTriggerBranch({ defaultBranch: "main", currentBranch: "feature/foo", eventName: "workflow_dispatch" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=true\n");
  assert.ok(r.stdout.includes(DEFAULT_BRANCH_LOG("main")), r.stdout);
  assert.ok(r.stdout.includes("Skipping the branch check because this is a manual run"), r.stdout);
});

test("生成ワークフローの Check trigger branch: TRIGGER_BRANCH に値があれば、その値で判定する(既定ブランチは使わない)", () => {
  let r = runCheckTriggerBranch({ triggerBranch: "docs", defaultBranch: "main", currentBranch: "docs" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=true\n");
  assert.doesNotMatch(r.stdout, /default branch/);

  r = runCheckTriggerBranch({ triggerBranch: "docs", defaultBranch: "main", currentBranch: "main" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=false\n");
  assert.ok(r.stdout.includes("Skipping because this push (main) is not to TRIGGER_BRANCH=docs"), r.stdout);
  assert.doesNotMatch(r.stdout, /default branch/);

  r = runCheckTriggerBranch({ triggerBranch: "docs", defaultBranch: "main", currentBranch: "main", eventName: "workflow_dispatch" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=true\n");
  assert.doesNotMatch(r.stdout, /default branch/);

  // 値があれば、既定ブランチが取れなくても動く
  r = runCheckTriggerBranch({ triggerBranch: "docs", defaultBranch: "", currentBranch: "docs" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.output, "should_deploy=true\n");
});

test("生成ワークフローの Check trigger branch: TRIGGER_BRANCH が無い・空で、既定ブランチも取れないときはエラーで止まる", () => {
  for (const triggerBranch of [undefined, ""]) {
    const r = runCheckTriggerBranch({ triggerBranch, defaultBranch: "", currentBranch: "main" });
    assert.equal(r.status, 1, r.stdout);
    assert.ok(
      r.stdout.includes(
        "::error::The settings file has no TRIGGER_BRANCH (or it is empty), and the repository's default branch could not be determined either. Write TRIGGER_BRANCH=<branch to deploy> in the settings file."
      ),
      r.stdout
    );
    assert.equal(r.output, "", "should_deploy を書き出さない");
    assert.doesNotMatch(r.stdout, /is used/);
  }
});

test("buildDocsPagesConfig: TRIGGER_BRANCH のコメントに、省略・空のときの動きを書く", () => {
  assert.ok(
    buildDocsPagesConfig({}).includes(
      "# If omitted or empty, the repository's default branch is used.\n# If it is not the default branch (usually main), add it in GitHub under\n"
    )
  );
  withLang("ja", () => {
    assert.ok(
      buildDocsPagesConfig({}).includes(
        "# 省略するか空にすると、リポジトリの既定ブランチになります。\n# リポジトリの既定ブランチ(通常は main)以外にする場合は、GitHub の\n"
      )
    );
  });
});

// --- 表示の言語(--lang)・生成物の言語 ---

test("buildDocsPagesConfig: en と ja で、設定ファイルのキーと値は同じ(違うのはコメントだけ)", () => {
  const answers = { triggerBranch: "docs", rootMd: "index.md", navEnabled: false, languages: "ja,en", siteName: "Demo" };
  const en = buildDocsPagesConfig(answers);
  const ja = withLang("ja", () => buildDocsPagesConfig(answers));
  assert.notEqual(en, ja);
  assert.deepEqual(parseConfigText(en), parseConfigText(ja));
  assert.deepEqual(missingConfigKeys(en), []);
  assert.deepEqual(missingConfigKeys(ja), []);
  // キーの行(コメントでない行)は言語によらず同一
  const keyLines = (text) => text.split("\n").filter((l) => !l.startsWith("#") && l !== "");
  assert.deepEqual(keyLines(en), keyLines(ja));
});

test("既定(en)の設定ファイル・ワークフロー・.gitignore・package.json に日本語がない", () => {
  const cjk = /[぀-ヿ一-鿿]/;
  assert.doesNotMatch(buildDocsPagesConfig({}), cjk);
  assert.doesNotMatch(buildDocsPagesYml(), cjk);
  const byPath = Object.fromEntries(buildVendorTargets().map((t) => [t.relPath, t.content]));
  assert.doesNotMatch(byPath[`${VENDOR_DIR}/.gitignore`], cjk);
  assert.doesNotMatch(byPath[`${VENDOR_DIR}/package.json`], cjk);
  withLang("ja", () => {
    assert.match(buildDocsPagesConfig({}), cjk);
  });
});

test("ワークフロー・.gitignore・package.json(init --update で上書きされるもの)は、--lang に依存しない", () => {
  const snapshot = () => ({
    workflow: buildDocsPagesYml(),
    vendor: buildVendorTargets().map((t) => [t.relPath, t.content]),
  });
  const en = snapshot();
  const ja = withLang("ja", snapshot);
  assert.deepEqual(ja, en);
});

test("vendoredVersionOf: 日本語の旧ワークフローのコメントも、英語の新しいコメントも、先頭の版を読める", () => {
  assert.equal(vendoredVersionOf("# tsuzuri v1.4.0 の npx github:akilasatolu/tsuzuri#v1 init によって生成された、自己完結型のワークフローです。\n"), "1.4.0");
  assert.equal(vendoredVersionOf(buildDocsPagesYml(undefined, undefined, { tsuzuriVersion: "9.8.7" })), "9.8.7");
  assert.equal(vendoredVersionOf("name: x\n"), "");
});
