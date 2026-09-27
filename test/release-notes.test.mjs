import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { extractChangelogSection, buildReleaseNotes } from "../scripts/release-notes.mjs";

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
  "- 新機能",
  "",
  "## [1.1.0] - 2026-09-27",
  "",
  "### Fixed",
  "",
  "- 修正",
  "",
  "[Unreleased]: https://example.com/compare",
  "[1.2.0]: https://example.com/1.2.0",
].join("\n");

test("extractChangelogSection: 指定バージョンの節だけを取り出す(次の節・リンク定義は含まない)", () => {
  assert.equal(extractChangelogSection(CHANGELOG, "1.2.0"), "### Added\n\n- 新機能");
  assert.equal(extractChangelogSection(CHANGELOG, "1.1.0"), "### Fixed\n\n- 修正");
});

test("extractChangelogSection: 節が無い・空ならエラー(書き忘れたままリリースしない)", () => {
  assert.throws(() => extractChangelogSection(CHANGELOG, "9.9.9"), /節がありません/);
  assert.throws(() => extractChangelogSection("## [2.0.0]\n\n## [1.0.0]\n- x", "2.0.0"), /節が空です/);
});

test("buildReleaseNotes: メジャーバージョンのタグでの使い方と、見出しを1段下げた変更内容", () => {
  const notes = buildReleaseNotes(CHANGELOG, "1.2.0");
  assert.match(notes, /npx github:akilasatolu\/tsuzuri#v1 init\n/);
  assert.match(notes, /npx github:akilasatolu\/tsuzuri#v1 init --update/);
  assert.match(notes, /`tsuzuri v1\.2\.0` と表示/);
  assert.match(notes, /## 変更内容\n\n#### Added\n\n- 新機能/);
});

test("scripts/release-notes.mjs: 実際の CHANGELOG の現在のバージョンでリリースノートを作れる", () => {
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const result = spawnSync(process.execPath, [join(ROOT, "scripts/release-notes.mjs"), `v${version}`], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## 変更内容/);
  const bad = spawnSync(process.execPath, [join(ROOT, "scripts/release-notes.mjs"), "latest"], { encoding: "utf8" });
  assert.equal(bad.status, 1);
});
