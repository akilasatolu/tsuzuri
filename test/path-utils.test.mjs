import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBasePath,
  isExternal,
  isMarkdownPath,
  isImagePath,
  splitHref,
  resolveRepoRel,
  toSiteAbsHref,
} from "../.github/scripts/lib/path-utils.mjs";

describe("normalizeBasePath", () => {
  test("空文字はそのまま空文字", () => {
    assert.equal(normalizeBasePath(""), "");
  });
  test("前後の空白のみは空文字扱い", () => {
    assert.equal(normalizeBasePath("   "), "");
  });
  test("先頭にスラッシュがない場合は付与する", () => {
    assert.equal(normalizeBasePath("my-repo"), "/my-repo");
  });
  test("末尾のスラッシュは除去する", () => {
    assert.equal(normalizeBasePath("/my-repo/"), "/my-repo");
  });
  test("前後の空白は除去したうえで正規化する", () => {
    assert.equal(normalizeBasePath("  /my-repo  "), "/my-repo");
  });
});

describe("isExternal", () => {
  test("スキーム付きURL(https)は外部リンク", () => {
    assert.equal(isExternal("https://example.com"), true);
  });
  test("mailto: は外部リンク", () => {
    assert.equal(isExternal("mailto:a@b.com"), true);
  });
  test("// で始まる protocol-relative は外部リンク", () => {
    assert.equal(isExternal("//cdn.example.com/x.js"), true);
  });
  test("空文字は外部リンク扱い(現仕様通り)", () => {
    assert.equal(isExternal(""), true);
  });
  test("相対パスは外部リンクではない", () => {
    assert.equal(isExternal("./a.md"), false);
  });
});

describe("isMarkdownPath", () => {
  test("拡張子 .md は true", () => {
    assert.equal(isMarkdownPath("a.md"), true);
  });
  test("大文字小文字混在(.MD)も true", () => {
    assert.equal(isMarkdownPath("A.MD"), true);
  });
  test("非対応拡張子(.mdx)は false", () => {
    assert.equal(isMarkdownPath("a.mdx"), false);
  });
});

describe("isImagePath", () => {
  test("対応拡張子すべてで true", () => {
    for (const ext of ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"]) {
      assert.equal(isImagePath(`a.${ext}`), true, `.${ext} should be image`);
    }
  });
  test("大文字小文字混在(.PNG)も true", () => {
    assert.equal(isImagePath("a.PNG"), true);
  });
  test("非対応拡張子(.tiff)は false", () => {
    assert.equal(isImagePath("a.tiff"), false);
  });
});

describe("splitHref", () => {
  test("ハッシュのみを含む場合はハッシュ位置で切れる", () => {
    assert.deepEqual(splitHref("a.md#section"), { pathPart: "a.md", rest: "#section" });
  });
  test("クエリのみを含む場合はクエリ位置で切れる", () => {
    assert.deepEqual(splitHref("a.md?x=1"), { pathPart: "a.md", rest: "?x=1" });
  });
  test("ハッシュとクエリが混在する場合、先に出現する方で切れる(クエリが先)", () => {
    assert.deepEqual(splitHref("a.md?x=1#section"), { pathPart: "a.md", rest: "?x=1#section" });
  });
  test("ハッシュとクエリが混在する場合、先に出現する方で切れる(ハッシュが先)", () => {
    assert.deepEqual(splitHref("a.md#section?x=1"), { pathPart: "a.md", rest: "#section?x=1" });
  });
  test("どちらも含まない場合は全体が pathPart", () => {
    assert.deepEqual(splitHref("a.md"), { pathPart: "a.md", rest: "" });
  });
});

describe("resolveRepoRel", () => {
  test("正常系: 同一ディレクトリの相対解決", () => {
    assert.deepEqual(resolveRepoRel("docs/a.md", "b.md"), { repoRel: "docs/b.md", rest: "" });
  });
  test("正常系: 親ディレクトリへの相対解決(トラバーサルにならない範囲)", () => {
    assert.deepEqual(resolveRepoRel("docs/a.md", "../c.md"), { repoRel: "c.md", rest: "" });
  });
  test("異常系: 3階層上に出ようとするパストラバーサル", () => {
    assert.deepEqual(resolveRepoRel("README.md", "../../../etc/passwd"), {
      rejected: true,
      reason: "path-traversal",
    });
  });
  test("異常系: URLエンコードされたパストラバーサル", () => {
    assert.deepEqual(resolveRepoRel("docs/a.md", "..%2F..%2Fetc%2Fpasswd"), {
      rejected: true,
      reason: "path-traversal",
    });
  });
  test("異常系: 正規化後に内部で .. が残存するケース(ルート直下から2階層上へ)", () => {
    assert.deepEqual(resolveRepoRel("a.md", "foo/../../bar"), {
      rejected: true,
      reason: "path-traversal",
    });
  });
  test("異常系: 不正なパーセントエンコーディングは decode-error", () => {
    assert.deepEqual(resolveRepoRel("README.md", "%"), {
      rejected: true,
      reason: "decode-error",
    });
  });
  test("異常系: 外部リンクは external", () => {
    assert.deepEqual(resolveRepoRel("README.md", "https://example.com/a.md"), {
      rejected: true,
      reason: "external",
    });
  });
  test("異常系: アンカーのみのリンクは anchor", () => {
    assert.deepEqual(resolveRepoRel("README.md", "#section"), {
      rejected: true,
      reason: "anchor",
    });
  });
  test("境界値: 絶対パス表記はリポジトリルート相対として扱う(既存仕様維持)", () => {
    assert.deepEqual(resolveRepoRel("docs/a.md", "/etc/passwd"), {
      repoRel: "etc/passwd",
      rest: "",
    });
  });
  test("境界値: fromRel がルート直下の場合の相対解決", () => {
    assert.deepEqual(resolveRepoRel("README.md", "docs/setup.md"), {
      repoRel: "docs/setup.md",
      rest: "",
    });
  });
});

describe("toSiteAbsHref", () => {
  test(".md は .html に変換され basePath が付与される", () => {
    assert.equal(toSiteAbsHref("README.md", "docs/setup.md", "/my-repo"), "/my-repo/docs/setup.html");
  });
  test("画像などの非mdファイルはそのまま拡張子を維持する", () => {
    assert.equal(toSiteAbsHref("README.md", "assets/logo.png", "/my-repo"), "/my-repo/assets/logo.png");
  });
  test("basePath が空文字の場合は付与しない", () => {
    assert.equal(toSiteAbsHref("README.md", "docs/setup.md", ""), "/docs/setup.html");
  });
  test("外部リンク・拒否されたリンクは元の文字列のまま返す", () => {
    assert.equal(toSiteAbsHref("README.md", "https://example.com", "/my-repo"), "https://example.com");
    assert.equal(toSiteAbsHref("README.md", "#section", "/my-repo"), "#section");
  });
});
