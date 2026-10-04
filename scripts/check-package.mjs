#!/usr/bin/env node
// 利用者に配る中身(npm がパッケージにまとめたもの)で、実際の利用と同じ流れが通るかを確かめる(CI 用)。
//   node scripts/check-package.mjs
//
// 利用者は `npx github:akilasatolu/tsuzuri init` で、npm がまとめたパッケージを取ってくる。その中身は
// 作業フォルダと違う(package.json の files に無いものと、ルートの package-lock.json が入らない)ため、
// 作業フォルダで動くテストだけでは、配布物にファイルが足りない問題に気づけない。そこで、
//   1. npm pack で配布物と同じファイル(tgz)を作る
//   2. 空のリポジトリで、その tgz から init を実行する(npx と同じく npm exec で、インストールしてから起動する)
//   3. 生成されたワークフローと同じ方法で依存を入れ(npm ci --ignore-scripts)、ビルドする
//   4. 設定ファイルを書き換えてから init --update を実行し、設定ファイルが保持されることを確かめる
// のどこかで失敗したら、終了コード 1 で止まる。npm の一時的なキャッシュは作業用の一時フォルダに置く。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "tsuzuri-package-"));
const cache = path.join(work, "npm-cache");
const site = path.join(work, "site");

function run(cmd, args, cwd, env = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, npm_config_cache: cache, ...env },
  });
}

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  OK: ${message}`);
}

const exists = (rel) => fs.existsSync(path.join(site, rel));
const read = (rel) => fs.readFileSync(path.join(site, rel), "utf-8");

try {
  // 1. 配布物と同じ tgz
  const packed = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], ROOT));
  const tgz = path.join(work, packed[0].filename);
  console.log(`  ${packed[0].filename}(${packed[0].entryCount} ファイル)`);

  // 2. 空のリポジトリで init(質問なし)
  fs.mkdirSync(path.join(site, "docs"), { recursive: true });
  run("git", ["init", "-q"], site);
  fs.writeFileSync(path.join(site, "README.md"), "# Package check\n\n[Guide](docs/guide.md)\n");
  fs.writeFileSync(path.join(site, "docs/guide.md"), "# Guide\n\n[Home](../README.md)\n");
  run("npm", ["exec", "--yes", `--package=${tgz}`, "--", "tsuzuri", "init", "--yes", "--languages", "en"], site);
  for (const rel of [
    ".github/workflows/docs-pages.yml",
    ".github/docs-pages.config",
    ".github/tsuzuri/build-docs.mjs",
    ".github/tsuzuri/lib/i18n.mjs",
    ".github/tsuzuri/styles/base.css",
    ".github/tsuzuri/package.json",
    ".github/tsuzuri/package-lock.json",
    ".github/tsuzuri/.gitignore",
  ]) {
    check(exists(rel), `init が ${rel} を作った`);
  }

  // 3. 生成ワークフローと同じ方法で依存を入れてビルド
  check(
    read(".github/workflows/docs-pages.yml").includes("npm ci --prefix"),
    "生成ワークフローは npm ci で依存を入れる"
  );
  run("npm", ["ci", "--prefix", ".github/tsuzuri", "--ignore-scripts", "--no-audit", "--no-fund"], site);
  run("node", [".github/tsuzuri/build-docs.mjs"], site, { STRICT_LINKS: "true" });
  for (const rel of ["_site/index.html", "_site/docs/guide.html", "_site/404.html"]) {
    check(exists(rel), `ビルドが ${rel} を書き出した`);
  }

  // 4. init --update は設定ファイルを変えない
  const configRel = ".github/docs-pages.config";
  const edited = read(configRel).replace(/^THEME=.*$/m, "THEME=nineties");
  check(edited.includes("THEME=nineties"), "設定ファイルを書き換えた(THEME=nineties)");
  fs.writeFileSync(path.join(site, configRel), edited);
  run("npm", ["exec", "--yes", `--package=${tgz}`, "--", "tsuzuri", "init", "--update"], site);
  check(read(configRel) === edited, "init --update の後も設定ファイルはそのまま");
  check(exists(".github/tsuzuri/package-lock.json"), "init --update の後も package-lock.json がある");

  console.log("\n配布物の確認はすべて通りました。");
} catch (error) {
  console.error(`\n配布物の確認に失敗しました: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
