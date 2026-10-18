import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { extractChangelogSection, splitChangelogSection } from "../scripts/release-notes.mjs";

// 実際の CHANGELOG.md で、各リリースの節の英語のブロックと日本語のブロックが対応していることを確かめる。
// (書き足したときに、片方だけ書き忘れたり、項目の数がずれたりしないように)

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANGELOG = readFileSync(join(ROOT, "CHANGELOG.md"), "utf-8");

// 英語のカテゴリ名と、日本語のブロックで使うカテゴリ名の対応
const CATEGORIES = {
  Added: "追加",
  Changed: "変更",
  Deprecated: "非推奨",
  Removed: "削除",
  Fixed: "修正",
  Security: "セキュリティ",
};

/** CHANGELOG の `## [...]` の節の版(Unreleased を含む)を、上から順に返す */
function listSections(changelog) {
  return [...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map((m) => m[1]);
}

/**
 * ブロックの構造を、行頭の要素の並びにする。
 * - `### カテゴリ` の見出し(カテゴリ名は英語に直す。日本語の名前が対応表にないときは、そのまま残して失敗させる)
 * - `- ` で始まる箇条書き(入れ子の箇条書きは `  - ` のように、字下げの深さも記録する)
 * - `**…**` で始まる行(1.0.0 の小見出し)
 * コードブロック(``` で囲まれた中)と、箇条書きの続きの行や空行は数えない。
 */
function outline(block, lang) {
  const reverse = Object.fromEntries(Object.entries(CATEGORIES).map(([en, ja]) => [ja, en]));
  const items = [];
  let inFence = false;
  for (const line of block.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    let m = line.match(/^### (.+)$/);
    if (m) {
      const name = lang === "ja" ? (reverse[m[1]] ?? m[1]) : m[1];
      items.push(`### ${name}`);
      continue;
    }
    m = line.match(/^(\s*)[-*] /);
    if (m) {
      items.push(`${m[1].length}:-`);
      continue;
    }
    if (/^\*\*.+\*\*\s*$/.test(line)) items.push("**");
  }
  return items;
}

/** ブロックの中の、バッククォートで囲んだ語(日本語を含むものは除く)を、語ごとの数にして返す */
function codeSpans(block) {
  const withoutFences = block.replace(/^\s*```[\s\S]*?^\s*```\s*$/gm, "");
  const spans = [...withoutFences.matchAll(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g)].map((m) => m[2].trim());
  const counts = new Map();
  for (const span of spans) {
    if (/[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/.test(span)) continue;
    counts.set(span, (counts.get(span) ?? 0) + 1);
  }
  return counts;
}

test("CHANGELOG.md: 先頭に、英語と日本語の説明がある", () => {
  const head = CHANGELOG.slice(0, CHANGELOG.indexOf("## [Unreleased]"));
  assert.match(head, /^# Changelog\n/);
  assert.match(head, /## Format\n/);
  assert.match(head, /## フォーマットについて\n/);
});

test("CHANGELOG.md: [Unreleased] を含め、版の節は新しい順に並び、Unreleased が最初にある", () => {
  const sections = listSections(CHANGELOG);
  assert.equal(sections[0], "Unreleased");
  assert.ok(sections.length > 30);
  const versions = sections.slice(1).map((v) => v.split(".").map(Number));
  for (let i = 1; i < versions.length; i++) {
    const [a, b] = [versions[i - 1], versions[i]];
    const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    assert.ok(newer > 0, `${sections[i]} の次に ${sections[i + 1]} が並んでいます`);
  }
});

test("CHANGELOG.md: 各版の節で、英語のブロックと日本語のブロックが対応している", () => {
  for (const version of listSections(CHANGELOG)) {
    let body;
    try {
      body = extractChangelogSection(CHANGELOG, version);
    } catch {
      // [Unreleased] が空のとき(リリース直後)は、書くものがないので確かめない
      assert.equal(version, "Unreleased");
      continue;
    }
    const { en, ja } = splitChangelogSection(body, version);
    assert.deepEqual(outline(ja, "ja"), outline(en, "en"), `## [${version}] の項目の構造が、英語と日本語で違います`);
    // 日本語のブロックにある、日本語を含まないコード(設定のキー、コマンド、ファイル名など)は、英語のブロックにも同じ数だけあること。
    // (英語のブロックには、「[題名](URL)」のように、日本語の語を訳したコードが増えることがあるので、逆は確かめない)
    const enSpans = codeSpans(en);
    for (const [span, count] of codeSpans(ja)) {
      assert.ok((enSpans.get(span) ?? 0) >= count, `## [${version}] のコード「${span}」が、英語のブロックにありません(または足りません)`);
    }
    for (const m of ja.matchAll(/^### (.+)$/gm)) {
      assert.ok(Object.values(CATEGORIES).includes(m[1]), `## [${version}] の日本語のブロックのカテゴリ名「${m[1]}」が対応表にありません`);
    }
    for (const m of en.matchAll(/^### (.+)$/gm)) {
      assert.ok(m[1] in CATEGORIES, `## [${version}] の英語のブロックのカテゴリ名「${m[1]}」が対応表にありません`);
    }
  }
});
