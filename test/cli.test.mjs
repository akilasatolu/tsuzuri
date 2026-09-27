import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OSS_REPO,
  VENDOR_DIR,
  PACKAGE_ROOT,
  THEME_CHOICES,
  buildDocsPagesYml,
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
    /TRIGGER_BRANCH\|ROOT_MD\|OUT_DIR\|STYLE_FILE\|LANG\|NAV_ENABLED\|FAVICON_FILE\|SITE_NAME\|CUSTOM_DOMAIN\|OGP_DEFAULT_IMAGE\|THEME\)/
  );
  assert.ok(!yml.includes("| xargs"));
  assert.ok(yml.includes("--ignore-scripts"));
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
