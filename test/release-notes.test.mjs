import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { extractChangelogSection, splitChangelogSection, buildReleaseNotes } from "../scripts/release-notes.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const CHANGELOG = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "## [1.2.0] - 2026-10-01",
  "",
  "### Added",
  "",
  "- New feature",
  "",
  "<!-- ja -->",
  "",
  "### 追加",
  "",
  "- 新機能",
  "",
  "## [1.1.0] - 2026-09-27",
  "",
  "### Fixed",
  "",
  "- Fix",
  "",
  "<!-- ja -->",
  "",
  "### 修正",
  "",
  "- 修正",
  "",
  "[Unreleased]: https://example.com/compare",
  "[1.2.0]: https://example.com/1.2.0",
].join("\n");

test("extractChangelogSection: 指定バージョンの節だけを取り出す(英語・日本語の両方を含み、次の節・リンク定義は含まない)", () => {
  assert.equal(extractChangelogSection(CHANGELOG, "1.2.0"), "### Added\n\n- New feature\n\n<!-- ja -->\n\n### 追加\n\n- 新機能");
  assert.equal(extractChangelogSection(CHANGELOG, "1.1.0"), "### Fixed\n\n- Fix\n\n<!-- ja -->\n\n### 修正\n\n- 修正");
});

test("extractChangelogSection: 節が無い・空ならエラー(書き忘れたままリリースしない)", () => {
  assert.throws(() => extractChangelogSection(CHANGELOG, "9.9.9"), /節がありません/);
  assert.throws(() => extractChangelogSection("## [2.0.0]\n\n## [1.0.0]\n- x", "2.0.0"), /節が空です/);
});

test("splitChangelogSection: 区切りの行で英語と日本語に分ける", () => {
  const body = extractChangelogSection(CHANGELOG, "1.2.0");
  assert.deepEqual(splitChangelogSection(body, "1.2.0"), { en: "### Added\n\n- New feature", ja: "### 追加\n\n- 新機能" });
});

test("splitChangelogSection: 区切りの行が無い・複数ある、またはどちらかのブロックが空ならエラー", () => {
  assert.throws(() => splitChangelogSection("### Added\n\n- x", "1.0.0"), /「<!-- ja -->」の行がありません/);
  assert.throws(() => splitChangelogSection("- a\n<!-- ja -->\n- b\n<!-- ja -->\n- c", "1.0.0"), /複数あります/);
  assert.throws(() => splitChangelogSection("<!-- ja -->\n### 追加", "1.0.0"), /英語のブロックが空/);
  assert.throws(() => splitChangelogSection("### Added\n<!-- ja -->\n", "1.0.0"), /日本語のブロックが空/);
});

test("buildReleaseNotes: 英語、日本語の順に、メジャーバージョンのタグでの使い方と、見出しを1段下げた変更内容", () => {
  const notes = buildReleaseNotes(CHANGELOG, "1.2.0");
  assert.match(notes, /npx github:akilasatolu\/tsuzuri#v1 init\n/);
  assert.match(notes, /npx github:akilasatolu\/tsuzuri#v1 init --update/);
  assert.match(notes, /## How to use and update/);
  assert.match(notes, /If the first line of the output shows `tsuzuri v1\.2\.0`, this version is being used\./);
  assert.match(notes, /`tsuzuri v1\.2\.0` と表示/);
  assert.match(notes, /## Changes\n\n#### Added\n\n- New feature\n\n---\n\n## 使い方・更新方法/);
  assert.match(notes, /## 変更内容\n\n#### 追加\n\n- 新機能/);
  assert.ok(notes.indexOf("## How to use and update") < notes.indexOf("## 使い方・更新方法"));
  assert.ok(notes.indexOf("- New feature") < notes.indexOf("- 新機能"));
});

test("scripts/release-notes.mjs: 実際の CHANGELOG の現在のバージョンでリリースノートを作れる", () => {
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const result = spawnSync(process.execPath, [join(ROOT, "scripts/release-notes.mjs"), `v${version}`], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Changes/);
  assert.match(result.stdout, /## 変更内容/);
  const bad = spawnSync(process.execPath, [join(ROOT, "scripts/release-notes.mjs"), "latest"], { encoding: "utf8" });
  assert.equal(bad.status, 1);
});
