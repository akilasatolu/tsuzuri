import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PACKAGE_ROOT,
  DOCS_URL,
  HELP_TEXT,
  readPackageVersion,
  buildTargets,
  buildWorkflowTarget,
  buildVendorTargets,
  buildCustomCssTarget,
  buildDocsPagesConfig,
  buildCompletionMessage,
  answersFromArgs,
  parseCliArgs,
  missingConfigKeys,
} from "../bin/cli.mjs";
import { CONFIG_FILE_PATH } from "../.github/scripts/lib/config.mjs";

// main() の振る舞い(出力・終了コード・生成物)を、CLI を子プロセスで起動して固定するテスト。
// main() を機能ごとの関数に分けても、利用者から見える動きが変わっていないことを確かめるためのもの。
// 期待値は、bin/cli.mjs が export する関数から組み立てる(スナップショットは置かない)。

const CLI = join(PACKAGE_ROOT, "bin/cli.mjs");
const VERSION = readPackageVersion();
const BANNER = `tsuzuri v${VERSION}\n\n`;
const HEADING = "README → GitHub Pages 自動デプロイパッケージ セットアップ\n\n";
const UPDATE_INTRO = "最新版に更新します(設定ファイルは変更しません。独自CSSは、既にあれば変更しません)\n\n";
const UPDATE_DONE = "\n更新が完了しました。変更内容は 'git diff' で確認できます。\n";
const WARN_NO_GIT = "⚠ git リポジトリの中ではないようです。公開したいリポジトリの直下で実行してください。\n";
const warnNoRoot = (rootMd) => `⚠ 起点の ${rootMd} がまだありません。push する前に作成してください(無いとビルドが失敗します)。\n`;
const BLANK_ANSWERS = "\n\n\n\n\n\n";
const BUNDLE_QUESTION = "ワークフローとビルドスクリプト一式";

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

const created = (targets) => targets.map((t) => `✔ ${t.relPath} を作成しました\n`).join("");
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
  return [buildWorkflowTarget(), ...buildVendorTargets(), buildCustomCssTarget()];
}

function setConfig(dir, text) {
  mkdirSync(join(dir, ".github"), { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE_PATH), text);
}

// --- 1. --help / --version ---

test("main: --help / -h は、バージョン行と使い方だけを標準出力に出し、何も作らない", () => {
  for (const flag of ["--help", "-h"]) {
    withTmpDir((dir) => {
      const result = runCli([flag], { cwd: dir });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `tsuzuri v${VERSION}\n\n${HELP_TEXT}\n`, flag);
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

    // 2回目: 既にあるファイルは上書き、独自CSSは保持。本体で使われなくなった lib のスクリプトは削除
    const customRel = buildCustomCssTarget().relPath;
    const staleRel = ".github/tsuzuri/lib/stale.mjs";
    writeFileSync(join(dir, staleRel), "// stale\n");
    result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const lines = targets.map((t) =>
      t.relPath === customRel
        ? `⏭ ${t.relPath} を保持しました(既にあるため上書きしません)\n`
        : `✔ ${t.relPath} を上書きしました\n`,
    );
    assert.equal(
      result.stdout,
      BANNER + UPDATE_INTRO + lines.join("") + `✖ ${staleRel} を削除しました(最新版では使われていないため)\n` + UPDATE_DONE,
    );
    assert.equal(existsSync(join(dir, staleRel)), false);
    assert.equal(read(dir, CONFIG_FILE_PATH), config);
  });
});

test("main: --update で設定ファイルに無い項目があると、生成の一覧の前にその案内を出し、設定ファイルは変えない", () => {
  withTmpDir((dir) => {
    const config = "TRIGGER_BRANCH=main\nTHEME=material\n";
    setConfig(dir, config);
    const keys = missingConfigKeys(config);
    assert.ok(keys.length > 0);

    const result = runCli(["--update"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const notice =
      `ℹ 設定ファイルに無い項目があります(既定値で動きます): ${keys.join(", ")}\n` +
      `  使う場合は ${CONFIG_FILE_PATH} に追記してください。説明: ${DOCS_URL}docs/configuration.html\n`;
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
      `エラー: セットアップに失敗しました。 (${CONFIG_FILE_PATH} が見つかりません。初回は --update を付けずに init を実行してください)\n`,
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
    assert.equal(read(dir, ".github/docs-pages.config"), buildDocsPagesConfig(answers));
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
    const args = ["--branch", "docs", "--root", "docs/index.md", "--theme", "nineties", "--languages", "ja,en", "--site-name", "Demo", "--no-nav"];
    const answers = answersFromArgs(parseCliArgs(args));
    const result = runCli(args, { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, warnNoRoot("docs/index.md"));
    assert.equal(result.stdout, BANNER + created(buildTargets(answers)) + buildCompletionMessage(answers) + "\n");
    assert.equal(read(dir, ".github/docs-pages.config"), buildDocsPagesConfig(answers));
    assert.match(buildCompletionMessage(answers), /docs ブランチへ push/);
  });
});

test("main: -y で既存ファイルがあると、--force が無ければスキップし、その旨を出す", () => {
  withTmpDir((dir) => {
    setupRepo(dir);
    const answers = defaultAnswers();
    const targets = buildTargets(answers);
    runCli(["-y"], { cwd: dir });
    writeFileSync(join(dir, ".github/docs-pages.config"), "KEEP\n");

    const result = runCli(["-y"], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const lines = targets.map((t) =>
      t.keepExisting
        ? `⏭ ${t.relPath} を保持しました(既にあるため上書きしません)\n`
        : `⏭ ${t.relPath} をスキップしました(既存ファイルを保持)\n`,
    );
    assert.equal(result.stdout, BANNER + lines.join("") + buildCompletionMessage(answers) + "\n");
    assert.equal(read(dir, ".github/docs-pages.config"), "KEEP\n");
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
      "? トリガーブランチ (TRIGGER_BRANCH) [main]: ",
      "(ROOT_MD)",
      "(THEME)",
      "(NAV_ENABLED)",
      "(LANGUAGES",
      "(SITE_NAME",
      "\n--- 以下のファイルを生成します ---\n",
      ...targets.map((t) => `  ${t.relPath}  (対象)\n`),
      ...targets.map((t) => `✔ ${t.relPath} を作成しました\n`),
      "セットアップが完了しました",
    ]);
    assert.ok(result.stdout.endsWith(buildCompletionMessage(answers) + "\n"));
    assert.equal(read(dir, ".github/docs-pages.config"), buildDocsPagesConfig(answers));
  });
});

test("main: 対話の init で答えた内容が、設定ファイルと完了メッセージに入り、起点が無ければ標準エラーで警告する", () => {
  withTmpDir((dir) => {
    gitInit(dir);
    const input = "docs\ndocs/index.md\n8\nn\nja,en\nMy Site\n";
    const answers = {
      triggerBranch: "docs",
      rootMd: "docs/index.md",
      theme: "nineties",
      navEnabled: false,
      languages: "ja,en",
      siteName: "My Site",
    };
    const result = runCli([], { cwd: dir, input });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, warnNoRoot("docs/index.md"));
    assert.equal(read(dir, ".github/docs-pages.config"), buildDocsPagesConfig(answers));
    assert.ok(result.stdout.endsWith(buildCompletionMessage(answers) + "\n"));
  });
});

test("main: 対話の init は、git の外だと場所の警告を出して続行を尋ね、y で続ける", () => {
  withTmpDir((dir) => {
    const answers = defaultAnswers();
    const result = runCli([], { cwd: dir, input: `y\n${BLANK_ANSWERS}` });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, WARN_NO_GIT + warnNoRoot("README.md"));
    assert.ok(result.stdout.startsWith(BANNER + HEADING + "このまま続けますか? (y/N): ? トリガーブランチ"), result.stdout);
    assert.ok(result.stdout.endsWith(buildCompletionMessage(answers) + "\n"));
    assert.equal(read(dir, ".github/docs-pages.config"), buildDocsPagesConfig(answers));
  });
});

test("main: 対話の init は、続行の質問に n・空行・入力の終わりで答えると、何も作らずに終了コード 0 で中止する", () => {
  for (const input of ["n\n", "\n", ""]) {
    withTmpDir((dir) => {
      const result = runCli([], { cwd: dir, input });
      assert.equal(result.status, 0, JSON.stringify(input) + result.stderr);
      assert.equal(
        result.stdout,
        BANNER + HEADING + "このまま続けますか? (y/N): " + "中止しました。リポジトリの直下で実行し直してください。\n",
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
    const workflow = buildTargets(answers).find((t) => t.relPath === ".github/workflows/docs-pages.yml");
    assert.ok(workflow);
    runCli([], { cwd: dir, input: BLANK_ANSWERS });
    writeFileSync(join(dir, ".github/workflows/docs-pages.yml"), "KEEP-WORKFLOW\n");
    writeFileSync(join(dir, ".github/docs-pages.config"), "KEEP-CONFIG\n");

    // 一式も設定ファイルも「いいえ」: どちらも残る
    let result = runCli([], { cwd: dir, input: `${BLANK_ANSWERS}n\nn\n` });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.split(BUNDLE_QUESTION).length - 1, 1, result.stdout);
    assertInOrder(result.stdout, [
      BUNDLE_QUESTION,
      "⏭ .github/workflows/docs-pages.yml をスキップしました(既存ファイルを保持)",
      ".github/docs-pages.config は既に存在します。上書きしますか? (y/N): ",
      "⏭ .github/docs-pages.config をスキップしました(既存ファイルを保持)",
    ]);
    assert.equal(read(dir, ".github/workflows/docs-pages.yml"), "KEEP-WORKFLOW\n");
    assert.equal(read(dir, ".github/docs-pages.config"), "KEEP-CONFIG\n");

    // 一式だけ「はい」: 一式は上書きされ、設定ファイルは残る
    result = runCli([], { cwd: dir, input: `${BLANK_ANSWERS}y\nn\n` });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.split(BUNDLE_QUESTION).length - 1, 1, result.stdout);
    assert.equal(read(dir, ".github/workflows/docs-pages.yml"), workflow.content);
    assert.equal(read(dir, ".github/docs-pages.config"), "KEEP-CONFIG\n");
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
    assert.match(result.stderr, /先に init を実行してください/);
  });
});

test("main: preview --port の不正な値は、バージョン行を出す前にエラー(終了コード 1)になる", () => {
  withTmpDir((dir) => {
    const result = runCli(["preview", "--port", "abc"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "エラー: セットアップに失敗しました。 (--port には 1〜65535 の番号を指定してください(指定: abc))\n");
  });
});

test("main: 未知のオプションは、引数のエラーとして終了コード 1 になり、バージョン行も出さない", () => {
  withTmpDir((dir) => {
    const result = runCli(["--bogus"], { cwd: dir });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.startsWith("エラー: セットアップに失敗しました。 (引数が正しくありません: "), result.stderr);
    assert.ok(result.stderr.endsWith("(--help で使い方を表示します))\n"), result.stderr);
    assert.deepEqual(readdirSync(dir), []);
  });
});
