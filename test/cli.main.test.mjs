import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PACKAGE_ROOT,
  DOCS_URL,
  buildHelpText,
  readPackageVersion,
  buildTargets,
  buildWorkflowTarget,
  buildVendorTargets,
  buildDocsPagesConfig,
  buildCompletionMessage,
  answersFromArgs,
  parseCliArgs,
  missingConfigKeys,
} from "../bin/cli.mjs";
import { CONFIG_FILE_PATH } from "../.github/scripts/lib/config.mjs";
import { t, setCliLang } from "../bin/messages.mjs";

// main() の振る舞い(出力・終了コード・生成物)を、CLI を子プロセスで起動して固定するテスト。
// main() を機能ごとの関数に分けても、利用者から見える動きが変わっていないことを確かめるためのもの。
// 期待値は、bin/cli.mjs が export する関数から組み立てる(スナップショットは置かない)。

const CLI = join(PACKAGE_ROOT, "bin/cli.mjs");
const VERSION = readPackageVersion();
const BANNER = `tsuzuri v${VERSION}\n\n`;
// 既定(en)の文言。--lang ja の文言は、末尾の「--lang ja」のテストで確かめる
const HEADING = "README → GitHub Pages auto-deploy setup\n\n";
const UPDATE_INTRO = "Updating to the latest version (the settings file is not changed; the custom styles you put in styles/ are not changed either)\n\n";
const UPDATE_DONE = "\nUpdate complete. You can review the changes with 'git diff'.\n";
const WARN_NO_GIT = "⚠ This does not look like a git repository. Run this at the root of the repository you want to publish.\n";
const warnNoRoot = (rootMd) => `⚠ The root file ${rootMd} does not exist yet. Create it before you push (the build fails without it).\n`;
const BLANK_ANSWERS = "\n\n\n\n\n";
const BUNDLE_QUESTION = "The workflow and the build scripts";

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "cli-main-test-"));
}

function withTmpDir(fn) {
  const dir = makeTmpDir();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, { cwd, input } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    input,
    encoding: "utf8",
    timeout: 30000,
  });
  // タイムアウト(rl.close() の閉じ忘れなどによるハング)や起動の失敗を、テストの失敗にする
  assert.equal(result.error, undefined, String(result.error));
  return result;
}

function gitInit(dir) {
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
}

/** git の作業ディレクトリで、起点の README.md もある(場所の警告も起点の警告も出ない)状態にする */
function setupRepo(dir) {
  gitInit(dir);
  writeFileSync(join(dir, "README.md"), "# x\n");
}

const created = (targets) => targets.map((t) => `✔ ${t.relPath} created\n`).join("");
const read = (dir, relPath) => readFileSync(join(dir, relPath), "utf8");

/** 既定の回答(-y のときと同じ)。DEFAULT_ANSWERS は export されていないので引数解釈から得る */
function defaultAnswers() {
  return answersFromArgs(parseCliArgs(["-y"]));
}

/** markers が、この順に、増加する位置で現れることを確かめる */
function assertInOrder(text, markers) {
  let from = 0;
  for (const marker of markers) {
    const at = text.indexOf(marker, from);
    assert.notEqual(at, -1, `${JSON.stringify(marker)} が順序どおりに現れない:\n${text}`);
    from = at + marker.length;
  }
}

function updateTargets() {
  return [buildWorkflowTarget(), ...buildVendorTargets()];
}

function setConfig(dir, text) {
  mkdirSync(join(dir, ".github/tsuzuri"), { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE_PATH), text);
}

// --- 1. --help / --version ---

test("main: --help / -h は、バージョン行と使い方だけを標準出力に出し、何も作らない", () => {
  for (const flag of ["--help", "-h"]) {
    withTmpDir((dir) => {
      const result = runCli([flag], { cwd: dir });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `tsuzuri v${VERSION}\n\n${buildHelpText()}\n`, flag);
      assert.equal(result.stderr, "", flag);
      assert.deepEqual(readdirSync(dir), [], flag);
    });
  }
});

test("main: --version / -v は、バージョンだけを出す(バージョン行も空行も付けない)", () => {
  for (const flag of ["--version", "-v"]) {
    withTmpDir((dir) => {
      const result = runCli([flag], { cwd: dir });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `${VERSION}\n`, flag);
      assert.equal(result.stderr, "", flag);
      assert.deepEqual(readdirSync(dir), [], flag);
    });
  }
});

// --- 2. --update ---

test("main: --update(設定に足りない項目なし)は、案内・生成の一覧・完了メッセージをこの順に出し、設定ファイルは変えない", () => {
  withTmpDir((dir) => {
    const config = buildDocsPagesConfig({});
    assert.deepEqual(missingConfigKeys(config), []);
    setConfig(dir, config);
    const targets = updateTargets();

    let result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, BANNER + UPDATE_INTRO + created(targets) + UPDATE_DONE);
    assert.equal(read(dir, CONFIG_FILE_PATH), config);

    // 2回目: 既にあるファイルは(default.css も)上書き。本体で使われなくなった lib のスクリプトは削除
    const staleRel = ".github/tsuzuri/lib/stale.mjs";
    writeFileSync(join(dir, staleRel), "// stale\n");
    result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const lines = targets.map((t) => `✔ ${t.relPath} overwritten\n`);
    assert.equal(
      result.stdout,
      BANNER + UPDATE_INTRO + lines.join("") + `✖ ${staleRel} deleted (no longer used by the latest version)\n` + UPDATE_DONE,
    );
    assert.equal(existsSync(join(dir, staleRel)), false);
    assert.equal(read(dir, CONFIG_FILE_PATH), config);
  });
});

test("main: --update で設定ファイルに無い項目があると、生成の一覧の前にその案内を出し、設定ファイルは変えない", () => {
  withTmpDir((dir) => {
    const config = "TRIGGER_BRANCH=main\nTHEME=default.css\n";
    setConfig(dir, config);
    const keys = missingConfigKeys(config);
    assert.ok(keys.length > 0);

    const result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const notice =
      `ℹ Keys missing from the settings file (defaults are used): ${keys.join(", ")}\n` +
      `  Add them to ${CONFIG_FILE_PATH} if you want to use them. See: ${DOCS_URL}docs/configuration.html\n`;
    assert.equal(result.stdout, BANNER + UPDATE_INTRO + notice + created(updateTargets()) + UPDATE_DONE);
    assert.equal(read(dir, CONFIG_FILE_PATH), config);
  });
});

test("main: --update は、設定ファイルが無いと案内のあとにエラーで終了コード 1 になり、何も作らない", () => {
  withTmpDir((dir) => {
    const result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, BANNER + UPDATE_INTRO);
    assert.equal(
      result.stderr,
      `Error: setup failed. (${CONFIG_FILE_PATH} not found. Run init without --update the first time)\n`,
    );
    assert.equal(existsSync(join(dir, ".github")), false);
  });
});

// --- 3. 質問しない init ---

test("main: -y は、生成の一覧と完了メッセージを出し、警告は出さない(git の作業ディレクトリ・起点あり)", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const result = runCli(["-y"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, BANNER + created(buildTargets(answers)) + buildCompletionMessage(answers) + "\n");
    assert.equal(read(dir, ".github/tsuzuri/config"), buildDocsPagesConfig(answers));
  });
});

test("main: -y は、git の外・起点なしだと、標準エラーに場所の警告、起点の警告の順で出す(標準出力は変わらない)", () => {
  withTmpDir((dir) => {
    const answers = defaultAnswers();
    const result = runCli(["-y"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, WARN_NO_GIT + warnNoRoot("README.md"));
    assert.equal(result.stdout, BANNER + created(buildTargets(answers)) + buildCompletionMessage(answers) + "\n");
  });
});

test("main: -y に付けたオプション(--branch など)が、生成物と完了メッセージに渡る", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const args = ["--branch", "docs", "--root", "docs/index.md", "--languages", "ja,en", "--site-name", "Demo", "--no-nav"];
    const answers = answersFromArgs(parseCliArgs(args));
    const result = runCli(args, { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, warnNoRoot("docs/index.md"));
    assert.equal(result.stdout, BANNER + created(buildTargets(answers)) + buildCompletionMessage(answers) + "\n");
    assert.equal(read(dir, ".github/tsuzuri/config"), buildDocsPagesConfig(answers));
    assert.match(buildCompletionMessage(answers), /push to the docs branch/);
  });
});

test("main: -y で既存ファイルがあると、--force が無ければスキップし、その旨を出す", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const targets = buildTargets(answers);
    runCli(["-y"], { cwd: dir });
    writeFileSync(join(dir, ".github/tsuzuri/config"), "KEEP\n");

    const result = runCli(["-y"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const lines = targets.map((t) => `⏭ ${t.relPath} skipped (existing file kept)\n`);
    assert.equal(result.stdout, BANNER + lines.join("") + buildCompletionMessage(answers) + "\n");
    assert.equal(read(dir, ".github/tsuzuri/config"), "KEEP\n");
  });
});

// --- 4. 対話で進める init ---

test("main: 対話の init は、見出し・質問・生成の一覧・作成の報告・完了メッセージをこの順に出す", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const targets = buildTargets(answers);
    const result = runCli([], { cwd: dir, input: BLANK_ANSWERS });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.startsWith(BANNER + HEADING), result.stdout);
    assertInOrder(result.stdout, [
      "? Trigger branch (TRIGGER_BRANCH) [main]: ",
      "(ROOT_MD)",
      "(NAV_ENABLED)",
      "(LANGUAGES",
      "(SITE_NAME",
      "\n--- The following files will be generated ---\n",
      ...targets.map((t) => `  ${t.relPath}  (target)\n`),
      ...targets.map((t) => `✔ ${t.relPath} created\n`),
      "Setup complete.",
    ]);
    assert.ok(result.stdout.endsWith(buildCompletionMessage(answers) + "\n"));
    assert.equal(read(dir, ".github/tsuzuri/config"), buildDocsPagesConfig(answers));
  });
});

test("main: 対話の init で答えた内容が、設定ファイルと完了メッセージに入り、起点が無ければ標準エラーで警告する", () => {
  withTmpDir((dir) => {
    gitInit(dir);
    const input = "docs\ndocs/index.md\nn\nja,en\nMy Site\n";
    const answers = {
      triggerBranch: "docs",
      rootMd: "docs/index.md",
      navEnabled: false,
      languages: "ja,en",
      siteName: "My Site",
    };
    const result = runCli([], { cwd: dir, input });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, warnNoRoot("docs/index.md"));
    assert.equal(read(dir, ".github/tsuzuri/config"), buildDocsPagesConfig(answers));
    assert.ok(result.stdout.endsWith(buildCompletionMessage(answers) + "\n"));
  });
});

test("main: 対話の init は、git の外だと場所の警告を出して続行を尋ね、y で続ける", () => {
  withTmpDir((dir) => {
    const answers = defaultAnswers();
    const result = runCli([], { cwd: dir, input: `y\n${BLANK_ANSWERS}` });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, WARN_NO_GIT + warnNoRoot("README.md"));
    assert.ok(result.stdout.startsWith(BANNER + HEADING + "Continue anyway? (y/N): ? Trigger branch"), result.stdout);
    assert.ok(result.stdout.endsWith(buildCompletionMessage(answers) + "\n"));
    assert.equal(read(dir, ".github/tsuzuri/config"), buildDocsPagesConfig(answers));
  });
});

test("main: 対話の init は、続行の質問に n・空行・入力の終わりで答えると、何も作らずに終了コード 0 で中止する", () => {
  for (const input of ["n\n", "\n", ""]) {
    withTmpDir((dir) => {
      const result = runCli([], { cwd: dir, input });
      assert.equal(result.status, 0, JSON.stringify(input) + result.stderr);
      assert.equal(
        result.stdout,
        BANNER + HEADING + "Continue anyway? (y/N): " + "Cancelled. Run it again at the root of the repository.\n",
        JSON.stringify(input),
      );
      assert.equal(result.stderr, WARN_NO_GIT, JSON.stringify(input));
      assert.deepEqual(readdirSync(dir), [], JSON.stringify(input));
    });
  }
});

test("main: 対話の init で既存ファイルがあると、一式は1回だけ、設定ファイルは別に尋ねる", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const workflow = buildTargets(answers).find((t) => t.relPath === ".github/workflows/tsuzuri-pages.yml");
    assert.ok(workflow);
    runCli([], { cwd: dir, input: BLANK_ANSWERS });
    writeFileSync(join(dir, ".github/workflows/tsuzuri-pages.yml"), "KEEP-WORKFLOW\n");
    writeFileSync(join(dir, ".github/tsuzuri/config"), "KEEP-CONFIG\n");

    // 一式も設定ファイルも「いいえ」: どちらも残る
    let result = runCli([], { cwd: dir, input: `${BLANK_ANSWERS}n\nn\n` });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.split(BUNDLE_QUESTION).length - 1, 1, result.stdout);
    assertInOrder(result.stdout, [
      BUNDLE_QUESTION,
      "⏭ .github/workflows/tsuzuri-pages.yml skipped (existing file kept)",
      ".github/tsuzuri/config already exists. Overwrite it? (y/N): ",
      "⏭ .github/tsuzuri/config skipped (existing file kept)",
    ]);
    assert.equal(read(dir, ".github/workflows/tsuzuri-pages.yml"), "KEEP-WORKFLOW\n");
    assert.equal(read(dir, ".github/tsuzuri/config"), "KEEP-CONFIG\n");

    // 一式だけ「はい」: 一式は上書きされ、設定ファイルは残る
    result = runCli([], { cwd: dir, input: `${BLANK_ANSWERS}y\nn\n` });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.split(BUNDLE_QUESTION).length - 1, 1, result.stdout);
    assert.equal(read(dir, ".github/workflows/tsuzuri-pages.yml"), workflow.content);
    assert.equal(read(dir, ".github/tsuzuri/config"), "KEEP-CONFIG\n");
  });
});

test("main: 対話の init は、標準入力を閉じられなくても、終わったら rl.close() で自分から終了する", async () => {
  // 入力をパイプで渡し終えて閉じる(EOF)と、rl.close() を忘れても終了してしまう。
  // そこで標準入力を開いたままにして、終了するのを待つ(閉じ忘れていれば、タイムアウトで失敗する)。
  for (const answers of ["n\n", `y\n${BLANK_ANSWERS}`]) {
    const dir = makeTmpDir();
    try {
      const child = spawn(process.execPath, [CLI], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      child.stdout.resume();
      child.stderr.resume();
      child.stdin.write(answers);
      const code = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill();
          resolve("timeout");
        }, 15000);
        child.on("exit", (c) => {
          clearTimeout(timer);
          resolve(c);
        });
      });
      child.stdin.destroy();
      assert.equal(code, 0, JSON.stringify(answers));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// --- 5. preview と引数のエラー ---

test("main: init していないリポジトリでの preview は、バージョン行だけを標準出力に出し、終了コード 1 になる", () => {
  withTmpDir((dir) => {
    const result = runCli(["preview"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, BANNER);
    assert.match(result.stderr, /Run init first/);
  });
});

test("main: preview --port の不正な値は、バージョン行を出す前にエラー(終了コード 1)になる", () => {
  withTmpDir((dir) => {
    const result = runCli(["preview", "--port", "abc"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "Error: setup failed. (--port needs a number from 1 to 65535 (given: abc))\n");
  });
});

test("main: 未知のオプションは、引数のエラーとして終了コード 1 になり、バージョン行も出さない", () => {
  withTmpDir((dir) => {
    const result = runCli(["--bogus"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.startsWith("Error: setup failed. (Invalid arguments: "), result.stderr);
    assert.ok(result.stderr.endsWith("(use --help to see the usage))\n"), result.stderr);
    assert.deepEqual(readdirSync(dir), []);
  });
});

// --- 6. 表示の言語(--lang) ---

const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;

/** lang の表示で、関数 fn を実行する(終わったら en に戻す)。fn の中の buildXxx() の出力が lang になる */
function inLang(lang, fn) {
  setCliLang(lang);
  try {
    return fn();
  } finally {
    setCliLang("en");
  }
}

/** ビルドスクリプト一式(日本語のコメントを含む)を除く、init が作るファイル */
const NON_VENDORED_FILES = [
  ".github/workflows/tsuzuri-pages.yml",
  ".github/tsuzuri/config",
  ".github/tsuzuri/.gitignore",
  ".github/tsuzuri/package.json",
];

test("main: 既定(--lang なし)では、標準出力・標準エラー・生成物(スクリプト一式を除く)に日本語が出ない", () => {
  // init -y(git あり・起点あり)
  withTmpDir((dir) => {
    setupRepo(dir);
    const result = runCli(["-y"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, CJK);
    for (const rel of NON_VENDORED_FILES) assert.doesNotMatch(read(dir, rel), CJK, rel);
  });
  // init -y(git の外・起点なし): 警告も英語
  withTmpDir((dir) => {
    const result = runCli(["-y"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, CJK);
  });
  // 対話の init、続けて --update
  withTmpDir((dir) => {
    setupRepo(dir);
    let result = runCli([], { cwd: dir, input: BLANK_ANSWERS });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, CJK);
    result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, CJK);
    // 対話の init の既存ファイル確認
    result = runCli([], { cwd: dir, input: `${BLANK_ANSWERS}n\nn\n` });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, CJK);
  });
  // 対話の init で、言語に正しくない値(ja_JP)を答えたときの警告([config] で始まる)も英語
  withTmpDir((dir) => {
    setupRepo(dir);
    const result = runCli([], { cwd: dir, input: "\n\n\nja_JP\n\n" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /\[config\] "ja_JP" in LANGUAGES is ignored because it is not a valid language tag\./);
    assert.doesNotMatch(result.stdout + result.stderr, CJK);
  });
  // --help、引数のエラー、init 前の preview
  withTmpDir((dir) => {
    for (const args of [["--help"], ["--bogus"], ["deploy"], ["--theme", "nineties"], ["preview", "--port", "abc"], ["preview"], ["--lang", "fr"]]) {
      const result = runCli(args, { cwd: dir });
      assert.doesNotMatch(result.stdout + result.stderr, CJK, args.join(" "));
    }
  });
});

test("main: --lang ja で、質問・生成の一覧・完了メッセージ・設定ファイルのコメントが日本語になる", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const ja = inLang("ja", () => ({
      targets: buildTargets(answers),
      completion: buildCompletionMessage(answers),
      config: buildDocsPagesConfig(answers),
    }));
    const result = runCli(["--lang", "ja"], { cwd: dir, input: BLANK_ANSWERS });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.startsWith(BANNER + "README → GitHub Pages 自動デプロイパッケージ セットアップ\n\n? トリガーブランチ"), result.stdout);
    assertInOrder(result.stdout, [
      "\n--- 以下のファイルを生成します ---\n",
      ...ja.targets.map((target) => `  ${target.relPath}  (対象)\n`),
      ...ja.targets.map((target) => `✔ ${target.relPath} を作成しました\n`),
    ]);
    assert.ok(result.stdout.endsWith(ja.completion + "\n"));
    assert.equal(read(dir, ".github/tsuzuri/config"), ja.config);
    assert.match(read(dir, ".github/tsuzuri/config"), CJK);
    // --lang ja だけでは質問を省略しない(質問に答えた)
    assert.match(result.stdout, /\? サイト名 \(SITE_NAME/);
  });
});

test("main: --lang ja -y の標準出力は、日本語の生成報告と完了メッセージになる。ワークフローなど英語固定のファイルは変わらない", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const result = runCli(["-y", "--lang", "ja"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    const ja = inLang("ja", () => ({
      targets: buildTargets(answers),
      completion: buildCompletionMessage(answers),
    }));
    assert.equal(
      result.stdout,
      BANNER + ja.targets.map((target) => `✔ ${target.relPath} を作成しました\n`).join("") + ja.completion + "\n",
    );
    // 英語固定のファイルは、--lang なしで作ったものと同じ
    const enWorkflow = buildWorkflowTarget().content;
    assert.equal(read(dir, ".github/workflows/tsuzuri-pages.yml"), enWorkflow);
    assert.doesNotMatch(read(dir, ".github/workflows/tsuzuri-pages.yml"), CJK);
    assert.doesNotMatch(read(dir, ".github/tsuzuri/.gitignore"), CJK);
    assert.doesNotMatch(read(dir, ".github/tsuzuri/package.json"), CJK);
  });
});

test("main: --help --lang ja は日本語の使い方を出す。--lang の説明は en・ja どちらにもある", () => {
  withTmpDir((dir) => {
    const ja = runCli(["--help", "--lang", "ja"], { cwd: dir });
    assert.equal(ja.status, 0, ja.stderr);
    assert.equal(ja.stdout, `tsuzuri v${VERSION}\n\n${t("help.text", { repo: "akilasatolu/tsuzuri" }, "ja")}\n`);
    assert.match(ja.stdout, /使い方: npx github:/);
    assert.match(ja.stdout, /--lang <en\|ja> /);
    const en = runCli(["--help"], { cwd: dir });
    assert.match(en.stdout, /Usage: npx github:/);
    assert.match(en.stdout, /--lang <en\|ja> /);
  });
});

test("main: 引数のエラーも --lang の言語で出す。不正な --lang の値のエラーは英語", () => {
  withTmpDir((dir) => {
    let result = runCli(["--lang", "ja", "--bogus"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.startsWith("エラー: セットアップに失敗しました。 (引数が正しくありません: "), result.stderr);

    result = runCli(["--lang=ja", "--theme", "nineties"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /引数が正しくありません/, "--theme は削除したので、不明なオプションのエラーになる");

    result = runCli(["--lang", "fr"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "Error: setup failed. (--lang must be en or ja (given: fr))\n");

    // 値が違う --lang が複数あるときは、parseArgs と同じく最後の値を見る
    result = runCli(["--lang", "ja", "--lang", "fr"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "Error: setup failed. (--lang must be en or ja (given: fr))\n");
    result = runCli(["--lang", "fr", "--lang", "ja", "--bogus"], { cwd: dir });
    assert.ok(result.stderr.startsWith("エラー: セットアップに失敗しました。 (引数が正しくありません: "), result.stderr);

    // 大文字や地域付きは受け付けない
    for (const value of ["JA", "ja-JP", "en-US"]) {
      result = runCli(["--lang", value], { cwd: dir });
      assert.equal(result.status, 1, value);
      assert.equal(result.stderr, `Error: setup failed. (--lang must be en or ja (given: ${value}))\n`, value);
    }
    assert.deepEqual(readdirSync(dir), []);
  });
});

test("main: --lang ja の preview(init 前)のエラーは日本語", () => {
  withTmpDir((dir) => {
    const result = runCli(["preview", "--lang", "ja"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /先に init を実行してください/);
  });
});

test("main: --update と --update --lang ja で、更新されるファイル(ワークフロー・.gitignore・package.json・default.css)は同じ。メッセージだけ --lang に従う", () => {
  const files = [".github/workflows/tsuzuri-pages.yml", ".github/tsuzuri/.gitignore", ".github/tsuzuri/package.json", ".github/tsuzuri/styles/default.css"];
  const run = (args) =>
    withTmpDir((dir) => {
      setupRepo(dir);
      assert.equal(runCli(["-y"], { cwd: dir }).status, 0);
      const result = runCli(args, { cwd: dir });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!existsSync(join(dir, ".github/tsuzuri/styles/custom.css")), "custom.css のひな形は作らない");
      return { files: files.map((rel) => read(dir, rel)), stdout: result.stdout };
    });
  const en = run(["--update"]);
  const ja = run(["--update", "--lang", "ja"]);
  assert.deepEqual(ja.files, en.files);
  assert.doesNotMatch(en.stdout, CJK);
  assert.match(ja.stdout, /最新版に更新します/);
});
