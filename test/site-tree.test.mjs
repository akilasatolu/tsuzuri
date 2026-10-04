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

describe("nav: false / order", () => {
  const titles = (nodes) => nodes.map((n) => (n.type === "page" ? n.title : `[${n.name}]`));

  test("nav: false のページはツリーに入れず、ページがすべて隠れたディレクトリも出さない", () => {
    const tree = buildSiteTree([
      ["README.md", { meta: { title: "Top" } }],
      ["docs/a.md", { meta: { title: "A" } }],
      ["docs/b.md", { meta: { title: "B", nav: "false" } }],
      ["samples/x.md", { meta: { title: "X", nav: "false" } }],
    ]);
    assert.deepEqual(titles(tree.children), ["Top", "[docs]"]);
    assert.deepEqual(titles(tree.children[1].children), ["A"]);
    assert.deepEqual(flattenPages(tree).map((p) => p.rel), ["README.md", "docs/a.md"]);
  });

  test("order を書いたページが小さい順に先に並び、書いていないページは見つかった順のまま後ろ", () => {
    const tree = buildSiteTree([
      ["docs/c.md", { meta: { title: "C" } }],
      ["docs/b.md", { meta: { title: "B", order: "2" } }],
      ["docs/d.md", { meta: { title: "D" } }],
      ["docs/a.md", { meta: { title: "A", order: "1" } }],
      ["docs/e.md", { meta: { title: "E", order: "x" } }],
    ]);
    assert.deepEqual(titles(tree.children[0].children), ["A", "B", "C", "D", "E"]);
  });

  test("ディレクトリの位置は、中の README.md / index.md の order で決まる", () => {
    const tree = buildSiteTree([
      ["README.md", { meta: {} }],
      ["guide/a.md", { meta: { title: "GA" } }],
      ["api/README.md", { meta: { title: "API", order: "1" } }],
    ]);
    assert.deepEqual(titles(tree.children), ["[api]", "README.md", "[guide]"]);
  });
});

describe("isDirIndex(フォルダの入口の判定の差し替え)", () => {
  const titles = (nodes) => nodes.map((n) => (n.type === "page" ? n.title : `[${n.name}]`));
  const isReadmeEn = (rel) => /^README\.en\.md$/i.test(rel.split("/").pop());

  test("isDirIndex を渡すと、guide/README.en.md の order でフォルダが並ぶ", () => {
    const entries = [
      ["README.en.md", { meta: { title: "Top" } }],
      ["api/a.en.md", { meta: { title: "API-A" } }],
      ["guide/a.en.md", { meta: { title: "GA" } }],
      ["guide/README.en.md", { meta: { title: "Guide", order: "1" } }],
    ];
    const tree = buildSiteTree(entries, { isDirIndex: isReadmeEn });
    assert.deepEqual(titles(tree.children), ["[guide]", "Top", "[api]"]);
    // 省略時(今の判定)では README.en.md は入口ではないので、見つかった順のまま
    assert.deepEqual(titles(buildSiteTree(entries).children), ["Top", "[api]", "[guide]"]);
  });

  test("isDirIndex は rel(リポジトリからの道のり)で呼ばれ、深いフォルダでも使われる", () => {
    const seen = [];
    const tree = buildSiteTree(
      [
        ["docs/x/a.md", { meta: { title: "XA" } }],
        ["docs/y/a.md", { meta: { title: "YA" } }],
        ["docs/y/top.md", { meta: { title: "YTop", order: "0" } }],
      ],
      { isDirIndex: (rel) => (seen.push(rel), rel === "docs/y/top.md") }
    );
    assert.deepEqual(titles(tree.children[0].children), ["[y]", "[x]"]);
    assert.ok(seen.includes("docs/y/top.md"));
    assert.ok(seen.every((rel) => rel.includes("/")), "ファイル名だけでなく道のりで渡す");
  });

  test("省略時は README.md・readme.md・index.md が入口(大文字・小文字の別はそのまま)", () => {
    const build = (name) =>
      buildSiteTree([
        ["top.md", { meta: { title: "Top" } }],
        ["guide/a.md", { meta: { title: "GA" } }],
        [`guide/${name}`, { meta: { title: "G", order: "1" } }],
      ]);
    for (const name of ["README.md", "readme.md", "index.md"]) {
      assert.deepEqual(titles(build(name).children), ["[guide]", "Top"], name);
    }
    for (const name of ["Readme.md", "INDEX.md", "README.en.md"]) {
      assert.deepEqual(titles(build(name).children), ["Top", "[guide]"], name);
    }
  });

  test("isDirIndex が常に false なら、フォルダは見つかった順のまま(ページの order は効く)", () => {
    const tree = buildSiteTree(
      [
        ["README.md", { meta: { title: "Top" } }],
        ["guide/a.md", { meta: { title: "GA" } }],
        ["api/README.md", { meta: { title: "API", order: "1" } }],
        ["z.md", { meta: { title: "Z", order: "2" } }],
      ],
      { isDirIndex: () => false }
    );
    assert.deepEqual(titles(tree.children), ["Z", "Top", "[guide]", "[api]"]);
  });

  test("isDirIndex に undefined を渡すと省略時と同じ", () => {
    const entries = [
      ["README.md", { meta: {} }],
      ["guide/a.md", { meta: { title: "GA" } }],
      ["api/README.md", { meta: { title: "API", order: "1" } }],
    ];
    assert.deepEqual(
      buildSiteTree(entries, { isDirIndex: undefined }),
      buildSiteTree(entries)
    );
  });
});
