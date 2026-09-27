import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { crawlSite } from "../.github/scripts/lib/crawler.mjs";

const REPO_ROOT = "/repo";

// 仮想ファイルシステムを組み立てるヘルパー。
// files は { "relPath": "content" } の形。crawlSite の readFile/exists をDIで差し替える。
function makeFs(files) {
  const abs = (rel) => path.join(REPO_ROOT, rel);
  const table = new Map(Object.entries(files).map(([rel, content]) => [abs(rel), content]));
  return {
    exists: (p) => table.has(p),
    readFile: (p) => {
      if (!table.has(p)) throw new Error(`ENOENT: ${p}`);
      return table.get(p);
    },
  };
}

describe("crawlSite", () => {
  test("root→リンク先md→画像まで到達可能なものだけ収集する", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[a](docs/a.md)\n",
      "docs/a.md": "# A\n![img](img.png)\n",
      "docs/img.png": "binary",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.deepEqual([...result.visitedMd.keys()].sort(), ["README.md", "docs/a.md"]);
    assert.deepEqual([...result.imageSet], ["docs/img.png"]);
  });

  test("rootからリンクされていないファイルは収集対象に含まれない", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[a](docs/a.md)\n",
      "docs/a.md": "# A\n",
      "docs/unrelated.md": "# Unrelated\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.equal(result.visitedMd.has("docs/unrelated.md"), false);
  });

  test("リンク先ファイル不在→missingに記録されビルド継続する", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[missing](docs/missing.md)\n[b](docs/b.md)\n",
      "docs/b.md": "# B\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.deepEqual(result.missing, [{ rel: "docs/missing.md", referencedFrom: "README.md" }]);
    // missing があっても後続の探索は継続する
    assert.equal(result.visitedMd.has("docs/b.md"), true);
  });

  test("循環参照(A→B→A)で無限ループしない", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[a](a.md)\n",
      "a.md": "# A\n[b](b.md)\n",
      "b.md": "# B\n[back to a](a.md)\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.deepEqual([...result.visitedMd.keys()].sort(), ["README.md", "a.md", "b.md"]);
  });

  test("同一ファイルへの複数リンクが1回だけ処理される", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[a1](a.md) [a2](a.md) [a3](./a.md)\n",
      "a.md": "# A\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.equal(result.visitedMd.size, 2);
    // a.md の子として README.md → a.md のエッジは1つだけ登録される
    assert.deepEqual(result.hierarchy["README.md"].children, ["a.md"]);
  });

  test("コードブロック内のリンク風文字列は探索対象に含まれない(セキュリティ回帰)", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n```\n[fake](evil.md)\n```\n`[inline-fake](evil2.md)`\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.equal(result.visitedMd.has("evil.md"), false);
    assert.equal(result.visitedMd.has("evil2.md"), false);
    assert.deepEqual(result.missing, []);
  });

  test("reason: path-traversal / decode-error がrejectedに記録されvisitedMdに追加されない(セキュリティ回帰)", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[bad1](../../../etc/passwd)\n[bad2](%)\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.equal(result.rejected.length, 2);
    const reasons = result.rejected.map((r) => r.reason).sort();
    assert.deepEqual(reasons, ["decode-error", "path-traversal"]);
    for (const r of result.rejected) {
      assert.equal(r.referencedFrom, "README.md");
    }
    assert.equal(result.visitedMd.has("../../../etc/passwd"), false);
    assert.equal(result.visitedMd.size, 1); // README.md のみ
  });

  test("reason: external / anchor はrejectedにもmissingにも記録されず無視される", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[ext](https://example.com/a.md)\n[anchor](#section)\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    assert.deepEqual(result.rejected, []);
    assert.deepEqual(result.missing, []);
    assert.equal(result.visitedMd.size, 1); // README.md のみ
  });

  test("各visitedMdエントリにfrontmatter由来のmetaが正しく付与される", () => {
    const { readFile, exists } = makeFs({
      "README.md": "---\ntitle: My Title\ndescription: My Desc\n---\n# Root\n[a](a.md)\n",
      "a.md": "# A (no frontmatter)\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });

    const rootEntry = result.visitedMd.get("README.md");
    assert.deepEqual(rootEntry.meta, { title: "My Title", description: "My Desc" });
    assert.equal(rootEntry.content.startsWith("# Root"), true); // frontmatterブロックが除去されている

    const aEntry = result.visitedMd.get("a.md");
    assert.deepEqual(aEntry.meta, {}); // frontmatterがなければ空オブジェクト
  });

  test("実体がリポジトリ外にあるシンボリックリンクのmdは読み込まず rejected(outside-repo) に記録する", () => {
    const { readFile, exists } = makeFs({
      "README.md": "# Root\n[secret](secret.md)\n",
      "secret.md": "should not be read",
    });
    const realpath = (p) => {
      if (p === path.join(REPO_ROOT, "secret.md")) return "/home/user/.ssh/id_rsa.md";
      return p;
    };
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists, realpath });
    assert.deepEqual([...result.visitedMd.keys()], ["README.md"]);
    assert.deepEqual(result.rejected, [
      { rel: "secret.md", referencedFrom: "README.md", reason: "outside-repo" },
    ]);
  });

  test("Markdown・画像以外のリンク先ファイル(PDF等)は fileSet に集める。ディレクトリ・ドットファイルは除く", () => {
    const { readFile, exists } = makeFs({
      "README.md": "[pdf](docs/manual.pdf) [zip](a.zip) [dir](docs/) [env](.env) [cfg](.github/x.json) ![i](i.png)\n",
    });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });
    assert.deepEqual([...result.fileSet].sort(), ["a.zip", "docs/manual.pdf"]);
    assert.deepEqual([...result.imageSet], ["i.png"]);
  });
});
