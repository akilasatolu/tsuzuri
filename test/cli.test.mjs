import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, chmodSync, symlinkSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OSS_REPO,
  VENDOR_DIR,
  PACKAGE_ROOT,
  THEME_CHOICES,
  buildDocsPagesYml,
  readMarkedVersion,
  buildDocsPagesConfig,
  buildStyleCssTemplate,
  buildVendorTargets,
  buildTargets,
  writeGeneratedFiles,
  resolveThemeChoice,
  parseYesNo,
  promptAnswers,
  reportFatalError,
  createAsker,
  isUpdateMode,
  runUpdate,
  isDirectRunOf,
  WORKFLOW_TEMPLATE_PATH,
  buildCompletionMessage,
  parseCliArgs,
  answersFromArgs,
  readPackageVersion,
  readDependencyVersion,
  HELP_TEXT,
  BUILD_DEPENDENCIES,
  buildDependencySpecs,
  majorTagOf,
  isBundledPath,
  createBundledConfirm,
} from "../bin/cli.mjs";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "cli-test-"));
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

test("promptAnswers: 全てデフォルト値で応答すると既定値が返る", async () => {
  const rl = fakeRl(["", "", "", ""]);
  const answers = await promptAnswers(rl);
  assert.deepEqual(answers, {
    triggerBranch: "main",
    rootMd: "README.md",
    theme: "wa",
    createStyleFile: false,
  });
});

test("promptAnswers: THEME番号入力(3)でsumiが選ばれる", async () => {
  const rl = fakeRl(["", "", "3", ""]);
  const answers = await promptAnswers(rl);
  assert.equal(answers.theme, "sumi");
  assert.equal(THEME_CHOICES[2].key, "sumi");
});

test("promptAnswers: STYLE_FILEひな形作成をyで応答するとtrueになる", async () => {
  const rl = fakeRl(["", "", "", "y"]);
  const answers = await promptAnswers(rl);
  assert.equal(answers.createStyleFile, true);
});

test("promptAnswers: STYLE_FILEひな形作成をNまたは無入力で応答するとfalseになる", async () => {
  const rl1 = fakeRl(["", "", "", "N"]);
  assert.equal((await promptAnswers(rl1)).createStyleFile, false);
  const rl2 = fakeRl(["", "", "", ""]);
  assert.equal((await promptAnswers(rl2)).createStyleFile, false);
});

test("resolveThemeChoice: 不正値・範囲外は既定(wa)にフォールバックする", () => {
  assert.equal(resolveThemeChoice("0"), "wa");
  assert.equal(resolveThemeChoice("99"), "wa");
  assert.equal(resolveThemeChoice("abc"), "wa");
  assert.equal(resolveThemeChoice(""), "wa");
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
    /TRIGGER_BRANCH\|ROOT_MD\|OUT_DIR\|STYLE_FILE\|LANG\|NAV_ENABLED\|FAVICON_FILE\|SITE_NAME\|CUSTOM_DOMAIN\|OGP_DEFAULT_IMAGE\|THEME\|STRICT_LINKS\|SITEMAP_JSON\|LAST_UPDATED\)/
  );
  assert.ok(!yml.includes("| xargs"));
  assert.ok(yml.includes("--ignore-scripts"));
});

test("readMarkedVersion: package.jsonのdevDependencies.markedをそのまま返す", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
  assert.equal(readMarkedVersion(), pkg.devDependencies.marked);
});

test("readMarkedVersion: ^や~などの範囲指定は受け付けない", () => {
  for (const range of ["^12.0.2", "~12.0.2", "12.x", undefined]) {
    const fsImpl = {
      readFileSync: () => JSON.stringify({ devDependencies: { marked: range } }),
    };
    assert.throws(() => readMarkedVersion("/pkg", fsImpl), /完全一致/);
  }
});

test("package.jsonのmarkedとpackage-lock.jsonで実際に入る版が一致している(テストと配布物の版が揃う)", () => {
  const lock = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package-lock.json"), "utf8"));
  assert.equal(lock.packages["node_modules/marked"].version, readMarkedVersion());
});

test("buildDocsPagesYml: 利用者側でインストールするmarkedはpackage.jsonの版", () => {
  assert.ok(buildDocsPagesYml().includes(`npm install --prefix ${VENDOR_DIR} marked@${readMarkedVersion()} `));
  assert.ok(buildDocsPagesYml("99.1.0").includes(`npm install --prefix ${VENDOR_DIR} marked@99.1.0 `));
});

test("buildDocsPagesConfig: デフォルト応答でTRIGGER_BRANCH=main/ROOT_MD=README.md/THEME=wa", () => {
  const config = buildDocsPagesConfig({
    triggerBranch: "main",
    rootMd: "README.md",
    theme: "wa",
  });
  assert.ok(config.includes("TRIGGER_BRANCH=main"));
  assert.ok(config.includes("ROOT_MD=README.md"));
  assert.ok(config.includes("THEME=wa"));
  assert.ok(config.includes("OUT_DIR=_site"));
  assert.ok(config.includes(`STYLE_FILE=${VENDOR_DIR}/styles/custom.css`));
});

test("buildDocsPagesConfig: THEME=sumiが反映される", () => {
  const config = buildDocsPagesConfig({
    triggerBranch: "main",
    rootMd: "README.md",
    theme: "sumi",
  });
  assert.ok(config.includes("THEME=sumi"));
});

test("buildStyleCssTemplate: コメントのみの空ひな形である", () => {
  const css = buildStyleCssTemplate();
  const nonEmptyLines = css.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of nonEmptyLines) {
    assert.ok(line.startsWith("/*") || line.endsWith("*/") || line.includes("*/"));
  }
  assert.ok(css.includes("/*") && css.includes("*/"));
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

  const waThemeTarget = targets.find((t) => t.relPath === `${VENDOR_DIR}/styles/wa.css`);
  assert.ok(waThemeTarget, "styles/wa.cssが含まれること(選択したTHEME以外も含め全テーマをコピー)");
  assert.equal(waThemeTarget.content, readFileSync(join(PACKAGE_ROOT, "styles/wa.css"), "utf8"));

  // styles/README.md や styles/fixtures/ のような .css 以外・ディレクトリは対象外
  assert.ok(!targets.some((t) => t.relPath.includes("styles/README.md")));
  assert.ok(!targets.some((t) => t.relPath.includes("fixtures")));
});

test("buildTargets: createStyleFile=falseならstyle.cssは生成対象に含まれないが、ベンダリング対象は含まれる", () => {
  const targets = buildTargets({ createStyleFile: false });
  const vendorCount = buildVendorTargets().length;
  assert.equal(targets.length, 2 + vendorCount);
  assert.ok(!targets.some((t) => t.relPath === `${VENDOR_DIR}/styles/custom.css`));
  assert.ok(targets.some((t) => t.relPath === `${VENDOR_DIR}/build-docs.mjs`));
});

test("buildTargets: createStyleFile=trueならcustom.cssも生成対象に含まれる(VENDOR_DIR/styles/配下)", () => {
  const targets = buildTargets({ createStyleFile: true });
  const vendorCount = buildVendorTargets().length;
  assert.equal(targets.length, 3 + vendorCount);
  const styleTarget = targets.find((t) => t.relPath === `${VENDOR_DIR}/styles/custom.css`);
  assert.ok(styleTarget, "組み込みテーマCSSと同じ.github/tsuzuri/styles/配下に生成されること");
  assert.equal(styleTarget.content, buildStyleCssTemplate());
});

// --- ファイル書き出し(writeGeneratedFiles)のテスト ---

test("writeGeneratedFiles: 空ディレクトリに全てデフォルト値で新規生成される", async () => {
  const dir = makeTmpDir();
  try {
    const targets = buildTargets({
      triggerBranch: "main",
      rootMd: "README.md",
      theme: "wa",
      createStyleFile: false,
    });
    const confirmOverwrite = async () => {
      throw new Error("既存ファイルが無いので呼ばれないはず");
    };
    const results = await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite });

    assert.ok(results.every((r) => r.status === "created"));
    assert.equal(results.length, targets.length);

    const yml = readFileSync(join(dir, ".github/workflows/docs-pages.yml"), "utf8");
    assert.ok(!yml.includes(`uses: ${OSS_REPO}/.github/workflows/build.yml`));

    const config = readFileSync(join(dir, ".github/docs-pages.config"), "utf8");
    assert.ok(config.includes("TRIGGER_BRANCH=main"));
    assert.ok(config.includes("ROOT_MD=README.md"));
    assert.ok(config.includes("THEME=wa"));

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

test("writeGeneratedFiles: createStyleFile=trueでコメントのみの空ファイルが生成される", async () => {
  const dir = makeTmpDir();
  try {
    const targets = buildTargets({ createStyleFile: true });
    await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite: async () => true });
    const css = readFileSync(join(dir, VENDOR_DIR, "styles/custom.css"), "utf8");
    assert.equal(css, buildStyleCssTemplate());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: 既存ファイルはconfirmOverwriteがfalse(デフォルトN)ならスキップされ内容は変わらない", async () => {
  const dir = makeTmpDir();
  try {
    const ymlPath = join(dir, ".github/workflows/docs-pages.yml");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    const original = "# 既存のユーザーカスタム内容\n";
    writeFileSync(ymlPath, original);

    const targets = buildTargets({ createStyleFile: false });
    let promptedFor = [];
    const confirmOverwrite = async (relPath) => {
      promptedFor.push(relPath);
      return false; // デフォルトN相当
    };
    const results = await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite });

    assert.deepEqual(promptedFor, [".github/workflows/docs-pages.yml"]);
    assert.equal(
      results.find((r) => r.relPath === ".github/workflows/docs-pages.yml").status,
      "skipped",
    );
    assert.equal(readFileSync(ymlPath, "utf8"), original);

    // 他のファイル(config)は確認なしで新規作成されている
    assert.equal(
      results.find((r) => r.relPath === ".github/docs-pages.config").status,
      "created",
    );
    assert.ok(readFileSync(join(dir, ".github/docs-pages.config"), "utf8").includes("THEME=wa"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: 既存ファイルにyで応答すると上書きされる", async () => {
  const dir = makeTmpDir();
  try {
    const ymlPath = join(dir, ".github/workflows/docs-pages.yml");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(ymlPath, "# 古い内容\n");

    const targets = buildTargets({ createStyleFile: false });
    const results = await writeGeneratedFiles(targets, {
      cwd: dir,
      confirmOverwrite: async () => true,
    });

    assert.equal(
      results.find((r) => r.relPath === ".github/workflows/docs-pages.yml").status,
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
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github/docs-pages.config"), "# 既存のconfig\n");

    const targets = buildTargets({ createStyleFile: true });

    const promptedFor = [];
    const confirmOverwrite = async (relPath) => {
      promptedFor.push(relPath);
      return true;
    };
    const results = await writeGeneratedFiles(targets, { cwd: dir, confirmOverwrite });

    assert.deepEqual(promptedFor, [".github/docs-pages.config"]);
    assert.equal(results.length, targets.length);
    assert.equal(
      results.find((r) => r.relPath === ".github/docs-pages.config").status,
      "overwritten",
    );
    assert.ok(
      results
        .filter((r) => r.relPath !== ".github/docs-pages.config")
        .every((r) => r.status === "created"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeGeneratedFiles: I/Oエラー(書き込み不可)時は例外が送出される", async () => {
  const dir = makeTmpDir();
  try {
    const targets = buildTargets({ createStyleFile: false });
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
  assert.ok(logs[0].includes("エラー"));
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
    const targets = buildTargets({ createStyleFile: false });
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

test("isUpdateMode: --update が含まれるときだけ true", () => {
  assert.equal(isUpdateMode(["init", "--update"]), true);
  assert.equal(isUpdateMode(["--update"]), true);
  assert.equal(isUpdateMode(["init"]), false);
  assert.equal(isUpdateMode([]), false);
});

test("runUpdate: ワークフローとビルドスクリプトは上書き・追加し、設定ファイルと独自CSSは変更しない", async () => {
  const dir = makeTmpDir();
  try {
    const configPath = join(dir, ".github/docs-pages.config");
    const customCssPath = join(dir, VENDOR_DIR, "styles/custom.css");
    const ymlPath = join(dir, ".github/workflows/docs-pages.yml");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    mkdirSync(join(dir, VENDOR_DIR, "styles"), { recursive: true });
    writeFileSync(configPath, "TRIGGER_BRANCH=docs\nFAVICON_FILE=assets/favicon.svg\n");
    writeFileSync(customCssPath, "/* my css */");
    writeFileSync(ymlPath, "old workflow");

    const results = await runUpdate({ cwd: dir });

    assert.equal(readFileSync(configPath, "utf8"), "TRIGGER_BRANCH=docs\nFAVICON_FILE=assets/favicon.svg\n");
    assert.equal(readFileSync(customCssPath, "utf8"), "/* my css */");
    assert.equal(readFileSync(ymlPath, "utf8"), buildDocsPagesYml());
    assert.ok(existsSync(join(dir, VENDOR_DIR, "build-docs.mjs")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "lib/site-tree.mjs")));
    assert.ok(!results.some((r) => r.relPath.endsWith("docs-pages.config")));
    assert.ok(!results.some((r) => r.relPath.endsWith("custom.css")));
    assert.equal(results.find((r) => r.relPath === ".github/workflows/docs-pages.yml").status, "overwritten");
    assert.ok(results.every((r) => r.status !== "skipped"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runUpdate: 設定ファイルが無い(未init)リポジトリではエラーにして何も書き込まない", async () => {
  const dir = makeTmpDir();
  try {
    await assert.rejects(() => runUpdate({ cwd: dir }), /docs-pages\.config が見つかりません/);
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
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github/docs-pages.config"), "TRIGGER_BRANCH=main\n");
    const linkPath = join(dir, "tsuzuri-bin");
    symlinkSync(join(PACKAGE_ROOT, "bin/cli.mjs"), linkPath);

    const result = spawnSync(process.execPath, [linkPath, "init", "--update"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(dir, ".github/workflows/docs-pages.yml")));
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
  assert.ok(yml.startsWith("name: Deploy Docs to GitHub Pages\n"));
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
  const sync = readFileSync(join(PACKAGE_ROOT, ".github/workflows/sync-docs.yml"), "utf8");
  const release = readFileSync(join(PACKAGE_ROOT, ".github/workflows/release.yml"), "utf8");
  const tplUses = usesOf(template);
  for (const sha of Object.values(tplUses)) assert.match(sha, /^[0-9a-f]{40}$/);
  for (const other of [usesOf(ci), usesOf(sync), usesOf(release)]) {
    for (const [action, sha] of Object.entries(other)) {
      if (tplUses[action]) assert.equal(tplUses[action], sha, `${action} の版が本体のワークフローとひな形で異なる`);
    }
  }
  assert.ok(tplUses["actions/upload-pages-artifact"] && tplUses["actions/deploy-pages"]);
});

// --- 完了メッセージ・--update の不要ファイル削除・STRICT_LINKS ---

test("buildCompletionMessage: 選んだトリガーブランチ・起点のMarkdownとGitHub側の設定手順を案内する", () => {
  const msg = buildCompletionMessage({ triggerBranch: "docs", rootMd: "index.md" });
  assert.match(msg, /index\.md がリポジトリにあることを確認/);
  assert.match(msg, /docs ブランチへ push/);
  assert.match(msg, /github-pages の「Deployment branches and tags」に docs を追加/);
  assert.match(msg, /Source を「GitHub Actions」/);
  assert.match(msg, /init --update/);
  assert.doesNotMatch(msg, /mainブランチへpush/);
});

test("runUpdate: 配布対象に無くなった lib/*.mjs は削除し、styles/ の独自CSSは残す", async () => {
  const dir = makeTmpDir();
  try {
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github/docs-pages.config"), "TRIGGER_BRANCH=main\n");
    mkdirSync(join(dir, VENDOR_DIR, "lib"), { recursive: true });
    mkdirSync(join(dir, VENDOR_DIR, "styles"), { recursive: true });
    writeFileSync(join(dir, VENDOR_DIR, "lib/removed-module.mjs"), "// old");
    writeFileSync(join(dir, VENDOR_DIR, "lib/notes.txt"), "keep");
    writeFileSync(join(dir, VENDOR_DIR, "styles/custom.css"), "/* mine */");
    writeFileSync(join(dir, VENDOR_DIR, "styles/old-theme.css"), "/* ? */");

    const results = await runUpdate({ cwd: dir });

    assert.ok(!existsSync(join(dir, VENDOR_DIR, "lib/removed-module.mjs")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "lib/notes.txt")), ".mjs 以外は削除しない");
    assert.ok(existsSync(join(dir, VENDOR_DIR, "lib/config.mjs")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "styles/custom.css")));
    assert.ok(existsSync(join(dir, VENDOR_DIR, "styles/old-theme.css")), "styles/ は削除の対象にしない");
    assert.deepEqual(
      results.filter((r) => r.status === "deleted").map((r) => r.relPath),
      [`${VENDOR_DIR}/lib/removed-module.mjs`]
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("STRICT_LINKS: 設定ファイルのひな形に既定値falseで含まれ、ワークフローからビルドへ渡される", () => {
  assert.ok(buildDocsPagesConfig({}).includes("\nSTRICT_LINKS=false\n"));
  assert.ok(buildDocsPagesYml().includes("          STRICT_LINKS: ${{ env.STRICT_LINKS }}\n"));
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
  const args = parseCliArgs(["init", "--branch", "docs", "--root", "index.md", "--theme", "sumi", "--style"]);
  assert.equal(args.nonInteractive, true);
  assert.deepEqual(answersFromArgs(args), {
    triggerBranch: "docs",
    rootMd: "index.md",
    theme: "sumi",
    createStyleFile: true,
  });
  assert.deepEqual(answersFromArgs(parseCliArgs(["--yes"])), {
    triggerBranch: "main",
    rootMd: "README.md",
    theme: "wa",
    createStyleFile: false,
  });
});

test("parseCliArgs: 不明なオプション・サブコマンド、不正なテーマ、空の値はエラー", () => {
  assert.throws(() => parseCliArgs(["--bogus"]), /引数が正しくありません/);
  assert.throws(() => parseCliArgs(["deploy"]), /不明なサブコマンド/);
  assert.throws(() => parseCliArgs(["--theme", "sepia"]), /--theme には/);
  assert.throws(() => parseCliArgs(["--branch", " "]), /--branch に空の値/);
});

test("parseCliArgs: -v / -h / --update / --force", () => {
  assert.equal(parseCliArgs(["-v"]).version, true);
  assert.equal(parseCliArgs(["-h"]).help, true);
  assert.equal(parseCliArgs(["init", "--update"]).update, true);
  assert.equal(parseCliArgs(["-y", "--force"]).force, true);
});

test("HELP_TEXT: 主なオプションとテーマ名を説明している", () => {
  for (const word of ["--update", "--yes", "--branch", "--root", "--theme", "--style", "--force", "--version", "sumi"]) {
    assert.ok(HELP_TEXT.includes(word), word);
  }
});

test("readPackageVersion / readDependencyVersion: package.json の値を返す", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
  assert.equal(readPackageVersion(), pkg.version);
  assert.equal(readDependencyVersion("marked"), pkg.devDependencies.marked);
  assert.throws(() => readDependencyVersion("not-a-dependency"), /完全一致/);
});

test("buildDocsPagesYml: 生成に使った tsuzuri のバージョンを先頭のコメントに入れる", () => {
  assert.ok(buildDocsPagesYml().includes(`# tsuzuri v${readPackageVersion()} の npx github:`));
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
    assert.match(readFileSync(join(dir, ".github/docs-pages.config"), "utf8"), /^TRIGGER_BRANCH=docs$/m);

    writeFileSync(join(dir, ".github/docs-pages.config"), "TRIGGER_BRANCH=keep\n");
    result = spawnSync(process.execPath, [cli, "-y"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, ".github/docs-pages.config"), "utf8"), "TRIGGER_BRANCH=keep\n");

    result = spawnSync(process.execPath, [cli, "-y", "--force"], { cwd: dir, encoding: "utf8" });
    assert.match(readFileSync(join(dir, ".github/docs-pages.config"), "utf8"), /^TRIGGER_BRANCH=main$/m);

    result = spawnSync(process.execPath, [cli, "--bogus"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /引数が正しくありません/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("package.json の engines で対応する Node.js の最低バージョンを示している", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.engines.node, ">=20");
});

test("ビルド用の依存(BUILD_DEPENDENCIES)はすべて package.json の版(完全一致)がワークフローに埋め込まれ、lockfileと一致している", () => {
  const lock = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package-lock.json"), "utf8"));
  const specs = [];
  for (const name of BUILD_DEPENDENCIES) {
    const version = readDependencyVersion(name);
    assert.equal(lock.packages[`node_modules/${name}`].version, version, name);
    specs.push(`${name}@${version}`);
  }
  assert.deepEqual(BUILD_DEPENDENCIES, ["marked", "highlight.js", "marked-footnote"]);
  assert.equal(buildDependencySpecs(), specs.join(" "));
  assert.ok(buildDocsPagesYml().includes(`npm install --prefix ${VENDOR_DIR} ${specs.join(" ")} --no-save`));
});

test("LAST_UPDATED=true のときだけ git の全履歴を取得するステップがある", () => {
  const yml = buildDocsPagesYml();
  assert.ok(
    yml.includes(
      "if: steps.trigger.outputs.should_deploy != 'false' && env.LAST_UPDATED == 'true'\n" +
        "        run: git fetch --unshallow --quiet || true"
    )
  );
  assert.ok(yml.includes("          LAST_UPDATED: ${{ env.LAST_UPDATED }}\n"));
  assert.ok(buildDocsPagesConfig({}).includes("\nLAST_UPDATED=false\n"));
});

test("生成ワークフロー: 依存は利用者の package.json と切り離して VENDOR_DIR に入れる", () => {
  assert.match(buildDocsPagesYml(), new RegExp(`npm install --prefix ${VENDOR_DIR.replace(/[.]/g, "\\.")} marked@`));
});

test("生成ワークフロー: concurrency は公開(deploy)ジョブだけに付け、ワークフロー全体には付けない", () => {
  const yml = buildDocsPagesYml();
  const [top, jobs] = yml.split("\njobs:\n");
  assert.doesNotMatch(top, /concurrency:/);
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

test("isBundledPath: ワークフローとビルドスクリプト一式だけが対象(設定ファイル・独自CSSは対象外)", () => {
  assert.equal(isBundledPath(".github/workflows/docs-pages.yml"), true);
  assert.equal(isBundledPath(`${VENDOR_DIR}/build-docs.mjs`), true);
  assert.equal(isBundledPath(`${VENDOR_DIR}/styles/wa.css`), true);
  assert.equal(isBundledPath(".github/docs-pages.config"), false);
  assert.equal(isBundledPath(`${VENDOR_DIR}/styles/custom.css`), false);
});

test("createBundledConfirm: 一式は1回だけ聞いて同じ答えを使い、設定ファイルは個別に聞く", async () => {
  const questions = [];
  const answers = [true, false];
  const confirm = createBundledConfirm(async (q) => {
    questions.push(q);
    return answers.shift();
  });
  assert.equal(await confirm(".github/workflows/docs-pages.yml"), true);
  assert.equal(await confirm(`${VENDOR_DIR}/build-docs.mjs`), true);
  assert.equal(await confirm(`${VENDOR_DIR}/lib/config.mjs`), true);
  assert.equal(await confirm(".github/docs-pages.config"), false);
  assert.equal(questions.length, 2);
  assert.match(questions[0], /ワークフローとビルドスクリプト一式/);
  assert.match(questions[1], /docs-pages\.config は既に存在します/);
});

test("生成する設定ファイル・CSSひな形に、開発側の内部的な言い回しを含めない", () => {
  const config = buildDocsPagesConfig({});
  for (const word of ["★", "詳細設計", "後方互換", "現行", "build-docs.mjs", "ハードコード"]) {
    assert.ok(!config.includes(word), `設定ファイルに「${word}」が含まれる`);
  }
  for (const key of ["TRIGGER_BRANCH", "ROOT_MD", "OUT_DIR", "THEME", "STYLE_FILE", "LANG", "NAV_ENABLED", "FAVICON_FILE", "SITE_NAME", "CUSTOM_DOMAIN", "OGP_DEFAULT_IMAGE", "STRICT_LINKS", "LAST_UPDATED", "SITEMAP_JSON"]) {
    assert.match(config, new RegExp(`^${key}=`, "m"), key);
  }
  assert.ok(buildStyleCssTemplate().includes("https://akilasatolu.github.io/tsuzuri/docs/theming.html"));
  assert.ok(!buildStyleCssTemplate().includes("README.md"));
});
