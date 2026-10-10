import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crawlSite } from "../.github/scripts/lib/crawler.mjs";
import { createLangContext } from "../.github/scripts/lib/i18n.mjs";

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

  test("コピーする拡張子の一覧にないファイルは fileSet に入れず、実在すれば linkTargets の repo、無ければ missing", () => {
    const { readFile, exists } = makeFs({
      "README.md": "[js](src/foo.js) [pkg](package.json) [nope](nope.js) [txt](notes.txt) [z](a.zip)\n",
      "src/foo.js": "x",
      "package.json": "{}",
      "notes.txt": "t",
      "a.zip": "z",
    });
    const result = crawlSite({
      repoRoot: REPO_ROOT,
      rootRel: "README.md",
      readFile,
      exists,
      isDirectory: () => false,
    });
    assert.deepEqual([...result.fileSet], ["a.zip"]);
    assert.deepEqual(result.linkTargets.get("src/foo.js"), { kind: "repo", isDir: false, referencedFrom: "README.md" });
    assert.equal(result.linkTargets.get("package.json").kind, "repo");
    assert.equal(result.linkTargets.get("notes.txt").kind, "repo");
    assert.equal(result.linkTargets.has("nope.js"), false);
    assert.deepEqual(result.missing, [{ rel: "nope.js", referencedFrom: "README.md" }]);
  });
});

// 多言語用の仮想ファイルシステム。readFile/exists に加えて readDir(フォルダの実際のファイル名)・
// isDirectory も差し替える。caseInsensitive: true なら macOS の既定のように
// 大文字・小文字を区別しないふるまい(readDir は実際の綴りを返す)。
// listedOnly: readDir には出るが読めない(exists が false の)ファイル。queue に入ったかを missing で見るため。
function makeI18nFs(files, { caseInsensitive = false, listedOnly = [] } = {}) {
  const key = (p) => (caseInsensitive ? p.toLowerCase() : p);
  const table = new Map(Object.entries(files).map(([rel, content]) => [key(path.join(REPO_ROOT, rel)), content]));
  const dirs = new Map(); // key(abs dir) -> Set(実際の名前)
  for (const rel of [...Object.keys(files), ...listedOnly]) {
    const parts = rel.split("/");
    for (let i = 0; i < parts.length; i++) {
      const dirAbs = path.join(REPO_ROOT, ...parts.slice(0, i));
      if (!dirs.has(key(dirAbs))) dirs.set(key(dirAbs), new Set());
      dirs.get(key(dirAbs)).add(parts[i]);
    }
  }
  const readDirCalls = [];
  return {
    readDirCalls,
    exists: (p) => table.has(key(p)) || dirs.has(key(p)),
    isDirectory: (p) => dirs.has(key(p)),
    readFile: (p) => {
      if (!table.has(key(p))) throw new Error(`ENOENT: ${p}`);
      return table.get(key(p));
    },
    readDir: (p) => {
      readDirCalls.push(p);
      const set = dirs.get(key(p));
      if (!set) throw new Error(`ENOENT: ${p}`);
      return [...set];
    },
  };
}

function crawlI18n(files, languages, { rootRel = "README.md", caseInsensitive = false, readDir, listedOnly } = {}) {
  const fsx = makeI18nFs(files, { caseInsensitive, listedOnly });
  const i18n = createLangContext({ languages, rootMd: rootRel });
  const result = crawlSite({
    repoRoot: REPO_ROOT,
    rootRel,
    readFile: fsx.readFile,
    exists: fsx.exists,
    isDirectory: fsx.isDirectory,
    readDir: readDir ?? fsx.readDir,
    i18n,
  });
  return { result, fsx };
}

const keys = (result) => [...result.visitedMd.keys()].sort();

describe("crawlSite(多言語: 翻訳も集める)", () => {
  test("リンクの無い翻訳も集める。実在しない翻訳は missing に入れない", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[a](docs/a.md)\n",
        "README.en.md": "# Root EN\n",
        "docs/a.md": "# A\n",
        "docs/a.en.md": "# A EN\n",
        "docs/b.md": "# B (リンクされていない)\n",
      },
      ["ja", "en"],
    );
    assert.deepEqual(keys(result), ["README.en.md", "README.md", "docs/a.en.md", "docs/a.md"]);
    assert.deepEqual(result.missing, []);
    assert.equal(result.rootRel, "README.md");
    assert.deepEqual(result.prefixConflicts, []);
    assert.equal(result.shadowed.size, 0);
    // 翻訳は読んだページの子として記録される
    assert.ok(result.hierarchy["README.md"].children.includes("README.en.md"));
  });

  test("翻訳のページからも別の言語版(基本言語は印の無い名前)を集め、3言語でも各言語1つずつ", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[only en](docs/x.en.md)\n",
        "docs/x.en.md": "# X EN\n",
        "docs/x.md": "# X\n",
        "docs/x.pt-BR.md": "# X PT\n",
      },
      ["ja", "en", "pt-BR"],
    );
    assert.deepEqual(keys(result), ["README.md", "docs/x.en.md", "docs/x.md", "docs/x.pt-BR.md"]);
  });

  test("大文字・小文字を区別しない環境: docs/a.pt-BR.md だけなら集まるのはその1つだけ", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[a](docs/a.md)\n",
        "docs/a.md": "# A\n",
        "docs/a.pt-BR.md": "# A PT\n",
      },
      ["ja", "pt-BR"],
      { caseInsensitive: true },
    );
    assert.deepEqual(keys(result), ["README.md", "docs/a.md", "docs/a.pt-BR.md"]);
    assert.deepEqual(result.missing, []);
  });

  test("大文字・小文字を区別する環境: a.pt-BR.md と a.pt-br.md の両方 → 翻訳として集めるのは並べ替えで最初の1つ", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[a](docs/a.md)\n",
        "docs/a.md": "# A\n",
        "docs/a.pt-br.md": "# A pt-br\n",
        "docs/a.pt-BR.md": "# A pt-BR\n",
      },
      ["ja", "pt-BR"],
    );
    assert.deepEqual(keys(result), ["README.md", "docs/a.md", "docs/a.pt-BR.md"]);
  });

  test("フォルダの中身はフォルダごとに1度だけ読む", () => {
    const { fsx } = crawlI18n(
      {
        "README.md": "# Root\n[a](docs/a.md) [b](docs/b.md)\n",
        "docs/a.md": "# A\n",
        "docs/b.md": "# B\n",
        "docs/a.en.md": "# A EN\n",
      },
      ["ja", "en"],
    );
    const counts = new Map();
    for (const p of fsx.readDirCalls) counts.set(p, (counts.get(p) ?? 0) + 1);
    assert.ok([...counts.values()].every((n) => n === 1), JSON.stringify([...counts]));
  });

  test("readDir が例外を投げても、その場所の翻訳は無いものとして続ける", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[a](docs/a.md)\n",
        "README.en.md": "# Root EN\n",
        "docs/a.md": "# A\n",
        "docs/a.en.md": "# A EN\n",
      },
      ["ja", "en"],
      {
        readDir: () => {
          throw new Error("EACCES");
        },
      },
    );
    assert.deepEqual(keys(result), ["README.md", "docs/a.md"]);
    assert.deepEqual(result.missing, []);
  });

  test("readDir が配列以外を返しても例外にならない", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n", "README.en.md": "# EN\n" },
      ["ja", "en"],
      { readDir: () => undefined },
    );
    assert.deepEqual(keys(result), ["README.md"]);
  });
});

describe("crawlSite(多言語: フォルダ・サイト直下へのリンク)", () => {
  const base = {
    "README.md": "# Root\n",
    "README.en.md": "# Root EN\n[guide](guide/)\n",
  };

  test("英語ページの guide/ → guide/README.en.md(kind: dir)", () => {
    const { result } = crawlI18n(
      { ...base, "guide/README.md": "# G\n", "guide/README.en.md": "# G EN\n" },
      ["ja", "en"],
    );
    assert.equal(result.hierarchy["guide/README.en.md"].parent, "README.en.md");
    assert.equal(result.linkTargets.get("guide").kind, "dir");
    assert.ok(result.visitedMd.has("guide/README.md")); // 翻訳として集まる
  });

  test("英語ページの guide/ で英語の入口が無ければ guide/README.md", () => {
    const { result } = crawlI18n({ ...base, "guide/README.md": "# G\n" }, ["ja", "en"]);
    assert.equal(result.hierarchy["guide/README.md"].parent, "README.en.md");
    assert.equal(result.linkTargets.get("guide").kind, "dir");
  });

  test("リンク元の言語の index 型が、基本言語の README 型より先", () => {
    const { result } = crawlI18n(
      { ...base, "guide/README.md": "# G\n", "guide/index.en.md": "# G index EN\n" },
      ["ja", "en"],
    );
    assert.equal(result.hierarchy["guide/index.en.md"].parent, "README.en.md");
  });

  test("印付きの入口は実際のファイル名で決まりを確かめる(guide/Index.en.md は入口ではない)", () => {
    const { result } = crawlI18n({ ...base, "guide/Index.en.md": "# G\n" }, ["ja", "en"]);
    assert.equal(result.visitedMd.has("guide/Index.en.md"), false);
    assert.deepEqual(result.linkTargets.get("guide"), { kind: "repo", isDir: true, referencedFrom: "README.en.md" });
  });

  // README.en.md を「一覧には出るが読めない」ファイルにして、"/" がどこを queue に入れたかを
  // missing の referencedFrom で確かめる(README.md は実在するので missing に出ない)
  test("英語ページの / と ../ → README.en.md。日本語ページの / → README.md", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[a](docs/a.md)\n",
        "docs/a.md": "# A\n[top](/)\n",
        "docs/a.en.md": "# A EN\n[top](/) [dot](../)\n",
      },
      ["ja", "en"],
      { listedOnly: ["README.en.md"] },
    );
    const fromEnPage = result.missing.filter((m) => m.referencedFrom === "docs/a.en.md");
    assert.deepEqual(fromEnPage, [
      { rel: "README.en.md", referencedFrom: "docs/a.en.md" },
      { rel: "README.en.md", referencedFrom: "docs/a.en.md" },
    ]);
    assert.equal(result.missing.some((m) => m.referencedFrom === "docs/a.md"), false);
  });

  test("英語のトップが無ければ、英語ページの / は基本言語のトップ(missing にしない)", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[a](a.md)\n", "a.md": "# A\n", "a.en.md": "# A EN\n[top](/)\n" },
      ["ja", "en"],
    );
    assert.deepEqual(keys(result), ["README.md", "a.en.md", "a.md"]);
    assert.deepEqual(result.missing, []);
  });

  test("起点が印付きに置き換わったとき、/ は置き換え後の起点を指す(印の無い起点は読まない)", () => {
    // en,ja: 起点は README.en.md。ja のトップが無いので ja ページの "/" も README.en.md。
    // もし印の無い README.md を指してしまうと、その中の old.md まで集まる
    const { result } = crawlI18n(
      {
        "README.md": "# Old\n[old](old.md)\n",
        "README.en.md": "# EN\n[a](a.ja.md)\n",
        "a.ja.md": "# A JA\n[top](/)\n",
        "old.md": "# Old page\n",
      },
      ["en", "ja"],
    );
    assert.equal(result.rootRel, "README.en.md");
    assert.deepEqual(keys(result), ["README.en.md", "a.ja.md"]);
    assert.deepEqual(result.missing, []);
  });

  test("ROOT_MD がフォルダの中(docs/README.md)でも、英語ページの / は docs/README.en.md", () => {
    const { result } = crawlI18n(
      {
        "docs/README.md": "# Root\n[a](a.md)\n",
        "docs/a.md": "# A\n",
        "docs/a.en.md": "# A EN\n[top](/)\n",
      },
      ["ja", "en"],
      { rootRel: "docs/README.md", listedOnly: ["docs/README.en.md"] },
    );
    assert.ok(result.missing.some((m) => m.rel === "docs/README.en.md" && m.referencedFrom === "docs/a.en.md"));
  });

  test("en/foo.md を集めると prefixConflicts に入る。基本言語の名前のフォルダは入らない", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Root\n[foo](en/foo.md) [bar](ja/bar.md) [x](docs/en/x.md)\n",
        "en/foo.md": "# Foo\n",
        "ja/bar.md": "# Bar\n",
        "docs/en/x.md": "# X\n",
      },
      ["ja", "en"],
    );
    assert.deepEqual(result.prefixConflicts, ["en/foo.md"]);
  });

  test("1言語では prefixConflicts は空で、翻訳を集めない", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[foo](en/foo.md)\n", "en/foo.md": "# Foo\n", "README.ja.md": "# JA\n" },
      ["en"],
    );
    assert.deepEqual(result.prefixConflicts, []);
    assert.deepEqual(keys(result), ["README.md", "en/foo.md"]);
  });
});

describe("crawlSite(手順0: 基本言語の印付きを優先)", () => {
  test("1言語 en: README.md(中に old.md)と README.en.md → 起点は README.en.md、old.md は集めない", () => {
    const { result } = crawlI18n(
      {
        "README.md": "# Old\n[old](old.md)\n",
        "README.en.md": "# New\n",
        "old.md": "# Old page\n",
      },
      ["en"],
    );
    assert.equal(result.rootRel, "README.en.md");
    assert.deepEqual(keys(result), ["README.en.md"]);
    assert.deepEqual([...result.shadowed], [["README.md", "README.en.md"]]);
  });

  test("README.en.md だけ(README.md が無い)→ 起点は README.en.md で続ける", () => {
    const { result } = crawlI18n({ "README.en.md": "# New\n" }, ["en"]);
    assert.equal(result.rootRel, "README.en.md");
    assert.deepEqual(keys(result), ["README.en.md"]);
    assert.deepEqual(result.missing, []);
  });

  test("c.md へのリンクで c.en.md だけある → c.en.md を集め、リンク切れにしない", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[c](docs/c.md)\n", "docs/c.en.md": "# C\n" },
      ["en"],
    );
    assert.deepEqual(keys(result), ["README.md", "docs/c.en.md"]);
    assert.deepEqual(result.missing, []);
    assert.equal(result.shadowed.get("docs/c.md"), "docs/c.en.md");
  });

  test("README.EN.md も印付きとして扱う(実際の綴りで集める)", () => {
    const { result } = crawlI18n({ "README.md": "# Old\n", "README.EN.md": "# New\n" }, ["en"]);
    assert.equal(result.rootRel, "README.EN.md");
    assert.deepEqual(keys(result), ["README.EN.md"]);
  });

  test("多言語 en,ja: README.md・README.en.md・README.ja.md → README.md は集めない", () => {
    const { result } = crawlI18n(
      { "README.md": "# 日本語\n", "README.en.md": "# EN\n", "README.ja.md": "# JA\n" },
      ["en", "ja"],
    );
    assert.equal(result.rootRel, "README.en.md");
    assert.deepEqual(keys(result), ["README.en.md", "README.ja.md"]);
  });

  test("起点の印の無いファイルも印付きも無ければ、今と同じく missing", () => {
    const { result } = crawlI18n({ "other.md": "# X\n" }, ["en"]);
    assert.equal(result.rootRel, "README.md");
    assert.deepEqual(result.missing, [{ rel: "README.md", referencedFrom: null }]);
  });
});

describe("crawlSite(手順3: 1言語のフォルダの入口)", () => {
  test("1言語 en で guide/README.en.md だけ → guide/ へのリンクが kind: dir", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[g](guide/)\n", "guide/README.en.md": "# G\n" },
      ["en"],
    );
    assert.deepEqual(result.linkTargets.get("guide"), { kind: "dir", referencedFrom: "README.md" });
    assert.ok(result.visitedMd.has("guide/README.en.md"));
  });

  test("guide/README.md と guide/README.en.md → 印付きの方をたどり、README.md を shadowed に記録する", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[g](guide/)\n", "guide/README.md": "# G\n[x](x.md)\n", "guide/README.en.md": "# G EN\n", "guide/x.md": "# x\n" },
      ["en"],
    );
    assert.deepEqual(keys(result), ["README.md", "guide/README.en.md"]);
    assert.deepEqual([...result.shadowed], [["guide/README.md", "guide/README.en.md"]]);
  });

  test("入口の shadowed は同じ型だけ・実在するものだけ", () => {
    // index 型: index.md + index.en.md → index.md を記録(README.md は別の型なので記録しない)
    const { result } = crawlI18n(
      { "README.md": "# Root\n[g](guide/)\n", "guide/index.md": "# i\n", "guide/index.en.md": "# I\n", "guide/README.md": "# r\n" },
      ["en"],
    );
    assert.equal(result.hierarchy["guide/README.md"], undefined);
    assert.deepEqual([...result.shadowed], [["guide/index.md", "guide/index.en.md"]]);
    // 印の無い入口が無ければ記録しない。readme.md(小文字)は今と同じ綴りで記録する
    const { result: r2 } = crawlI18n({ "README.md": "# Root\n[g](guide/)\n", "guide/README.en.md": "# G\n" }, ["en"]);
    assert.equal(r2.shadowed.size, 0);
    const { result: r3 } = crawlI18n(
      { "README.md": "# Root\n[g](guide/)\n", "guide/readme.md": "# r\n", "guide/readme.EN.md": "# G\n" },
      ["en"],
    );
    assert.deepEqual([...r3.shadowed], [["guide/readme.md", "guide/readme.EN.md"]]);
    // 多言語で他の言語の入口(README.ja.md)を選んだときは記録しない
    const { result: r4 } = crawlI18n(
      { "README.md": "# Root\n", "README.ja.md": "# J\n[g](guide/)\n", "guide/README.md": "# r\n", "guide/README.ja.md": "# j\n" },
      ["en", "ja"],
    );
    assert.equal(r4.hierarchy["guide/README.ja.md"].parent, "README.ja.md");
    assert.equal([...r4.shadowed].some(([k]) => k.startsWith("guide/")), false);
  });

  test("1言語では他の言語の印付きは入口にならない(guide/README.ja.md だけ → repo)", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[g](guide/)\n", "guide/README.ja.md": "# G\n" },
      ["en"],
    );
    assert.equal(result.linkTargets.get("guide").kind, "repo");
  });

  test("i18n を渡しても今の入口(readme.md・index.md)は見つかる", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[a](a/) [b](b/)\n", "a/readme.md": "# A\n", "b/index.md": "# B\n" },
      ["ja"],
    );
    assert.equal(result.linkTargets.get("a").kind, "dir");
    assert.equal(result.linkTargets.get("b").kind, "dir");
    assert.deepEqual(keys(result), ["README.md", "a/readme.md", "b/index.md"]);
  });
});

describe("crawlSite(i18n 省略)", () => {
  test("新しい戻り値は空・起点はそのまま", () => {
    const { readFile, exists } = makeFs({ "README.md": "# Root\n", "README.en.md": "# EN\n" });
    const result = crawlSite({ repoRoot: REPO_ROOT, rootRel: "README.md", readFile, exists });
    assert.deepEqual(result.prefixConflicts, []);
    assert.equal(result.shadowed.size, 0);
    assert.equal(result.rootRel, "README.md");
    assert.deepEqual([...result.visitedMd.keys()], ["README.md"]);
  });
});

// 1言語で印付きのファイルが無いサイトは、i18n を渡しても渡さなくても同じ結果(新しく足した3つを除く)
function withoutNewKeys(result) {
  const { prefixConflicts, shadowed, rootRel, ...rest } = result;
  return { rest, prefixConflicts, shadowed: [...shadowed], rootRel };
}

describe("crawlSite(1言語の i18n は今と同じ結果)", () => {
  // 既存のテストと同じ材料: フォルダへのリンク(README.md・readme.md・index.md・入口の無いもの・
  // 大文字・小文字の違う入口)・サイト直下・画像・ファイル・missing・rejected
  const files = {
    "README.md": [
      "# Root",
      "[a](docs/a.md) [g](guide/) [r](lower/) [i](idx/) [n](noindex/) [rm](mixed/) [ix](cap/)",
      "[top](/) [dot](./) [missing](docs/missing.md) [bad](../../etc/passwd) [pdf](docs/m.pdf)",
      "[lic](LICENSE) ![img](docs/img.png) [ext](https://example.com/) [cli](cli.en.md)",
      "",
    ].join("\n"),
    "docs/a.md": "---\ntitle: A\n---\n# A\n[back](../README.md) [up](../)\n",
    "docs/img.png": "binary",
    "guide/README.md": "# Guide\n",
    "lower/readme.md": "# lower\n",
    "idx/index.md": "# idx\n",
    "noindex/x.txt": "x",
    "mixed/Readme.md": "# Readme (大文字・小文字が違う)\n",
    "cap/Index.md": "# Index (大文字・小文字が違う)\n",
    "LICENSE": "MIT",
    "cli.en.md": "# LANGUAGES に無い印\n",
  };

  for (const caseInsensitive of [false, true]) {
    test(`偽物の fs(大文字・小文字を${caseInsensitive ? "区別しない" : "区別する"})`, () => {
      const fsx = makeI18nFs(files, { caseInsensitive });
      const opts = {
        repoRoot: REPO_ROOT,
        rootRel: "README.md",
        readFile: fsx.readFile,
        exists: fsx.exists,
        isDirectory: fsx.isDirectory,
        readDir: fsx.readDir,
      };
      const plain = crawlSite(opts);
      const withI18n = crawlSite({ ...opts, i18n: createLangContext({ languages: ["ja"], rootMd: "README.md" }) });
      const got = withoutNewKeys(withI18n);
      assert.deepEqual(got.rest, withoutNewKeys(plain).rest);
      assert.deepEqual(got.prefixConflicts, []);
      assert.deepEqual(got.shadowed, []);
      assert.equal(got.rootRel, "README.md");
      // 区別する環境では mixed/Readme.md・cap/Index.md は今と同じく入口ではない(GitHub へのリンク)
      if (!caseInsensitive) {
        assert.equal(withI18n.linkTargets.get("mixed").kind, "repo");
        assert.equal(withI18n.linkTargets.get("cap").kind, "repo");
      } else {
        // 区別しない環境では今と同じく候補の綴り(cap/index.md)で集まる
        assert.ok(withI18n.visitedMd.has("cap/index.md"));
      }
    });
  }

  test("本物の fs: ゴールデンの fixture(test/fixtures/site-golden)", () => {
    const repoRoot = fileURLToPath(new URL("./fixtures/site-golden", import.meta.url));
    for (const languages of [["ja"], ["en"], ["fr"]]) {
      const plain = crawlSite({ repoRoot, rootRel: "README.md" });
      const withI18n = crawlSite({ repoRoot, rootRel: "README.md", i18n: createLangContext({ languages, rootMd: "README.md" }) });
      assert.ok(plain.visitedMd.size > 1);
      assert.deepEqual(withoutNewKeys(withI18n).rest, withoutNewKeys(plain).rest, languages.join(","));
      assert.equal(withI18n.shadowed.size, 0);
    }
  });
});

describe("crawlSite(LANGUAGES に無い印・大文字・小文字・フォルダ)", () => {
  test("1言語 ja: cli.en.md は普通のページ(翻訳は集めない。置き換えるのは cli.en.ja.md があるときだけ)", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[c](cli.en.md)\n", "cli.en.md": "# en\n", "cli.en.ja.md": "# x\n", "cli.md": "# c\n" },
      ["ja"],
    );
    // cli.en.md の基本言語の印付き版は cli.en.ja.md(言語の決まりどおり)
    assert.deepEqual(keys(result), ["README.md", "cli.en.ja.md"]);
    assert.deepEqual([...result.shadowed], [["cli.en.md", "cli.en.ja.md"]]);

    const { result: r2 } = crawlI18n({ "README.md": "# Root\n[c](cli.en.md)\n", "cli.en.md": "# en\n", "cli.md": "# c\n" }, ["ja"]);
    assert.deepEqual(keys(r2), ["README.md", "cli.en.md"]);
    assert.equal(r2.shadowed.size, 0);
  });

  test("多言語 ja,en: cli.fr.md は基本言語の普通のページで、英語版は cli.fr.en.md", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[c](cli.fr.md)\n", "cli.fr.md": "# fr\n", "cli.fr.en.md": "# x\n", "cli.en.md": "# y\n" },
      ["ja", "en"],
    );
    assert.deepEqual(keys(result), ["README.md", "cli.fr.en.md", "cli.fr.md"]);
  });

  test("手順1: 基本言語の印の無い版は完全一致を優先する(CLI.md と cli.md → cli.md)", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[j](cli.ja.md)\n", "CLI.md": "# C\n", "cli.md": "# c\n", "cli.ja.md": "# j\n" },
      ["en", "ja"],
    );
    assert.deepEqual(keys(result), ["README.md", "cli.ja.md", "cli.md"]);
  });

  test("手順0: A.md へのリンクは、a.md がある(a.en.md は a.md の組)ので置き換えない", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[x](A.md) [y](a.md)\n", "A.md": "# A\n", "a.md": "# a\n", "a.en.md": "# e\n" },
      ["en"],
    );
    assert.deepEqual(keys(result), ["A.md", "README.md", "a.en.md"]);
    assert.deepEqual([...result.shadowed], [["a.md", "a.en.md"]]);
  });

  test("手順0: 印付きが複数(a.EN.md と a.en.md)なら完全一致の a.en.md", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[y](a.md)\n", "a.EN.md": "# E\n", "a.en.md": "# e\n" },
      ["en"],
    );
    assert.deepEqual(keys(result), ["README.md", "a.en.md"]);
  });

  test("手順3: index.md と Index.en.md → 置き換えずに index.md をたどる", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[g](guide/)\n", "guide/index.md": "# g\n", "guide/Index.en.md": "# G\n" },
      ["en"],
    );
    assert.deepEqual(keys(result), ["README.md", "guide/index.md"]);
    assert.equal(result.linkTargets.get("guide").kind, "dir");
  });

  test("名前が a.en.md のフォルダは翻訳・印付きとして拾わない(ビルドが止まらない)", () => {
    const { result } = crawlI18n(
      { "README.md": "# Root\n[a](a.md)\n", "a.md": "# a\n", "a.en.md/x.md": "# x\n", "a.ja.md/y.md": "# y\n" },
      ["ja", "en"],
    );
    assert.deepEqual(keys(result), ["README.md", "a.md"]);
    const { result: r2 } = crawlI18n({ "README.md": "# Root\n[a](a.md)\n", "a.md": "# a\n", "a.en.md/x.md": "# x\n" }, ["en"]);
    assert.deepEqual(keys(r2), ["README.md", "a.md"]);
  });
});
