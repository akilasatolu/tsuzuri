#!/usr/bin/env node
// release-notes.mjs
//
// CHANGELOG.md から指定バージョンの節を取り出し、GitHub の Release の本文を組み立てる。
// .github/workflows/release.yml が、vX.Y.Z のタグが push されたときに実行する。
// (tsuzuri 本体の開発用スクリプト。init で利用者リポジトリにはコピーされない)
//
// 使い方: node scripts/release-notes.mjs 1.2.0 > notes.md

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = "akilasatolu/tsuzuri";
const SITE_URL = "https://akilasatolu.github.io/tsuzuri/";

/**
 * CHANGELOG から `## [version]` の節の本文を取り出す(見出し行は含まない)。
 * 見つからなければエラーにする(書き忘れたままリリースしないように)。
 *
 * @param {string} changelog
 * @param {string} version - 例: "1.2.0"
 * @returns {string}
 */
export function extractChangelogSection(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) {
    throw new Error(`CHANGELOG.md に「## [${version}]」の節がありません`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## \[/.test(line) || /^\[[^\]]+\]: /.test(line));
  const body = (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
  if (!body) {
    throw new Error(`CHANGELOG.md の「## [${version}]」の節が空です`);
  }
  return body;
}

/**
 * Release の本文を組み立てる。更新方法の案内と、CHANGELOG の該当節(見出しを1段下げたもの)。
 *
 * @param {string} changelog
 * @param {string} version
 * @returns {string}
 */
export function buildReleaseNotes(changelog, version) {
  const major = `v${version.split(".")[0]}`;
  const section = extractChangelogSection(changelog, version).replace(/^### /gm, "#### ");
  return [
    `## 使い方・更新方法`,
    ``,
    `新しく使い始める場合(v${version.split(".")[0]} 系の最新版を使います):`,
    ``,
    "```sh",
    `npx github:${REPO}#${major} init`,
    "```",
    ``,
    `既に使っている場合の更新(設定ファイル・独自CSSはそのまま残ります):`,
    ``,
    "```sh",
    `npx github:${REPO}#${major} init --update`,
    "```",
    ``,
    `実行時の最初の行に \`tsuzuri v${version}\` と表示されれば、このバージョンが使われています。`,
    `ドキュメント: ${SITE_URL}`,
    ``,
    `## 変更内容`,
    ``,
    section,
    ``,
  ].join("\n");
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const version = (process.argv[2] ?? "").replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error("使い方: node scripts/release-notes.mjs <X.Y.Z>");
    process.exit(1);
  }
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  try {
    process.stdout.write(buildReleaseNotes(readFileSync(join(root, "CHANGELOG.md"), "utf-8"), version));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
