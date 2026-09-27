import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildSiteTree, pageLabel, flattenPages } from "../.github/scripts/lib/site-tree.mjs";

describe("pageLabel", () => {
  test("frontmatterのtitleがあればそれを使う", () => {
    assert.equal(pageLabel("docs/cli.md", { title: "CLIリファレンス" }), "CLIリファレンス");
  });
  test("titleが無い・空白のみならファイル名", () => {
    assert.equal(pageLabel("docs/cli.md", {}), "cli.md");
    assert.equal(pageLabel("docs/cli.md", { title: "  " }), "cli.md");
    assert.equal(pageLabel("docs/cli.md"), "cli.md");
  });
});

describe("buildSiteTree", () => {
  test("ディレクトリ構成に沿って入れ子になる", () => {
    const tree = buildSiteTree([
      ["README.md", { meta: { title: "Home" } }],
      ["docs/a.md", { meta: {} }],
      ["docs/deep/b.md", { meta: { title: "B" } }],
    ]);
    assert.deepEqual(tree, {
      type: "dir",
      name: "",
      path: "",
      children: [
        { type: "page", rel: "README.md", title: "Home" },
        {
          type: "dir",
          name: "docs",
          path: "docs",
          children: [
            { type: "page", rel: "docs/a.md", title: "a.md" },
            {
              type: "dir",
              name: "deep",
              path: "docs/deep",
              children: [{ type: "page", rel: "docs/deep/b.md", title: "B" }],
            },
          ],
        },
      ],
    });
  });

  test("並び順は発見順。ディレクトリは配下で最初に見つかったページの位置に置かれる", () => {
    const tree = buildSiteTree([
      ["README.md", {}],
      ["docs/a.md", {}],
      ["guide.md", {}],
      ["docs/b.md", {}],
    ]);
    assert.deepEqual(
      tree.children.map((n) => n.rel ?? `${n.path}/`),
      ["README.md", "docs/", "guide.md"]
    );
    assert.deepEqual(
      tree.children[1].children.map((n) => n.rel),
      ["docs/a.md", "docs/b.md"]
    );
  });

  test("ページが直下に無い中間ディレクトリも作られる", () => {
    const tree = buildSiteTree([["a/b/c.md", {}]]);
    assert.equal(tree.children[0].name, "a");
    assert.equal(tree.children[0].children[0].name, "b");
    assert.equal(tree.children[0].children[0].children[0].rel, "a/b/c.md");
  });
});

describe("flattenPages", () => {
  test("ナビの表示順(ディレクトリは深さ優先、同じディレクトリ内は発見順)でページを1列に並べる", () => {
    const tree = buildSiteTree([
      ["README.md", {}],
      ["docs/a.md", {}],
      ["guide.md", {}],
      ["docs/deep/b.md", {}],
      ["docs/c.md", {}],
    ]);
    assert.deepEqual(
      flattenPages(tree).map((p) => p.rel),
      ["README.md", "docs/a.md", "docs/deep/b.md", "docs/c.md", "guide.md"]
    );
  });
});

describe("起点ページ(ROOT_MD)の表示名", () => {
  test("titleが無ければサイト名、サイト名も無ければファイル名。titleがあればtitle", () => {
    const entries = [["README.md", { meta: {} }], ["docs/a.md", { meta: {} }]];
    const named = buildSiteTree(entries, { rootMd: "README.md", siteName: "Tsuzuri" });
    assert.equal(named.children[0].title, "Tsuzuri");
    assert.equal(named.children[1].children[0].title, "a.md", "起点以外にはサイト名を使わない");
    assert.equal(buildSiteTree(entries, { rootMd: "README.md" }).children[0].title, "README.md");
    const titled = buildSiteTree([["README.md", { meta: { title: "ホーム" } }]], { rootMd: "README.md", siteName: "Tsuzuri" });
    assert.equal(titled.children[0].title, "ホーム");
  });
});
