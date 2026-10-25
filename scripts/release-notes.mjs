#!/usr/bin/env node
// release-notes.mjs
//
// CHANGELOG.md から指定バージョンの節を取り出し、GitHub の Release の本文を組み立てる。
// 節には、英語のブロック、`<!-- ja -->` の行、日本語のブロックの順に書かれていて、
// 本文は英語、日本語の順に並べる。
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

/** 節の中で、英語のブロックと日本語のブロックを分ける行 */
export const LANG_MARKER = "<!-- ja -->";

/**
 * 節の本文を、英語のブロックと日本語のブロックに分ける。
 * 区切りの行が、ちょうど1つ無い、または片方のブロックが空ならエラーにする(書き忘れたままリリースしないように)。
 *
 * @param {string} body - extractChangelogSection の戻り値
 * @param {string} version
 * @returns {{ en: string, ja: string }}
 */
export function splitChangelogSection(body, version) {
  const lines = body.split("\n");
  const marks = [];
  lines.forEach((line, i) => {
    if (line.trim() === LANG_MARKER) marks.push(i);
  });
  if (marks.length !== 1) {
    const state = marks.length === 0 ? "ありません" : "複数あります";
    throw new Error(`CHANGELOG.md の「## [${version}]」の節に、英語と日本語を分ける「${LANG_MARKER}」の行が${state}`);
  }
  const en = lines.slice(0, marks[0]).join("\n").trim();
  const ja = lines.slice(marks[0] + 1).join("\n").trim();
  if (!en) throw new Error(`CHANGELOG.md の「## [${version}]」の英語のブロックが空です`);
  if (!ja) throw new Error(`CHANGELOG.md の「## [${version}]」の日本語のブロックが空です`);
  return { en, ja };
}

/**
 * Release の本文を組み立てる。英語、日本語の順に、更新方法の案内と、CHANGELOG の該当節(見出しを1段下げたもの)を並べる。
 *
 * @param {string} changelog
 * @param {string} version
 * @returns {string}
 */
export function buildReleaseNotes(changelog, version) {
  const major = `v${version.split(".")[0]}`;
  const { en, ja } = splitChangelogSection(extractChangelogSection(changelog, version), version);
  const lower = (text) => text.replace(/^### /gm, "#### ");
  return [
    `## How to use and update`,
    ``,
    `To start using Tsuzuri (this uses the latest ${major} release):`,
    ``,
    "```sh",
    `npx github:${REPO}#${major} init`,
    "```",
    ``,
    `To update an existing setup (your config file and your custom styles are kept):`,
    ``,
    "```sh",
    `npx github:${REPO}#${major} init --update`,
    "```",
    ``,
    `If the first line of the output shows \`tsuzuri v${version}\`, this version is being used.`,
    `Documentation: ${SITE_URL}`,
    ``,
    `## Changes`,
    ``,
    lower(en),
    ``,
    `---`,
    ``,
    `## 使い方・更新方法`,
    ``,
    `新しく使い始める場合(${major} 系の最新版を使います):`,
    ``,
    "```sh",
    `npx github:${REPO}#${major} init`,
    "```",
    ``,
    `既に使っている場合の更新(設定ファイル・カスタムスタイルはそのまま残ります):`,
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
    lower(ja),
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
