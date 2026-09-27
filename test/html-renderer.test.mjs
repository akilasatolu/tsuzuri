import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  escapeHtml,
  renderNav,
  renderMetaTags,
  pageTemplate,
  preprocessRawHtmlPaths,
  defaultNotFoundMarkdown,
  renderPager,
} from "../.github/scripts/lib/html-renderer.mjs";
import { buildSiteTree } from "../.github/scripts/lib/site-tree.mjs";

describe("escapeHtml", () => {
  test("& < > \" のみをエスケープする", () => {
    assert.equal(escapeHtml(`& < > "`), "&amp; &lt; &gt; &quot;");
  });
  test("エスケープ対象外の文字はそのまま", () => {
    assert.equal(escapeHtml("こんにちは'world"), "こんにちは'world");
  });
});

describe("renderNav", () => {
  // README.md / guide.md / docs/(a.md, deep/b.md) という構成のサイトツリー
  const tree = buildSiteTree([
    ["README.md", { meta: { title: "ホーム" } }],
    ["docs/a.md", { meta: { title: "ページA" } }],
    ["guide.md", { meta: {} }],
    ["docs/deep/b.md", { meta: {} }],
  ]);

  test("全ページがリンクとして出現する", () => {
    const html = renderNav(tree, "README.md", "", "");
    for (const href of ["/README.html", "/docs/a.html", "/guide.html", "/docs/deep/b.html"]) {
      assert.match(html, new RegExp(`<a href="${href}"`));
    }
  });

  test("ディレクトリは<span>見出し+入れ子の<ul>として出力される", () => {
    const html = renderNav(tree, "README.md", "", "");
    assert.match(
      html,
      /<li><span>docs<\/span><ul><li><a href="\/docs\/a\.html">ページA<\/a><\/li><li><span>deep<\/span><ul><li><a href="\/docs\/deep\/b\.html">b\.md<\/a><\/li><\/ul><\/li><\/ul><\/li>/
    );
  });

  test("表示名はfrontmatterのtitle、無ければファイル名", () => {
    const html = renderNav(tree, "README.md", "", "");
    assert.match(html, />ホーム<\/a>/);
    assert.match(html, />guide\.md<\/a>/);
    assert.doesNotMatch(html, />docs\/deep\/b\.md</);
  });

  test("currentRelに一致する項目にのみaria-currentが付与される", () => {
    const html = renderNav(tree, "guide.md", "", "");
    assert.match(html, /<a href="\/guide\.html" aria-current="page">/);
    assert.equal(html.match(/aria-current/g).length, 1);
  });

  test("basePathがhrefに反映される", () => {
    const html = renderNav(tree, "README.md", "/my-repo", "");
    assert.match(html, /<a href="\/my-repo\/README\.html"/);
  });

  test("siteNameが設定されていればnav先頭に見出しとして表示する", () => {
    const html = renderNav(tree, "README.md", "", "My Site");
    assert.match(html, /<div class="tsuzuri-nav-head"><p>My Site<\/p><label/);
  });

  test("siteName未設定なら見出しは出力されない", () => {
    const html = renderNav(tree, "README.md", "", "");
    assert.match(html, /<div class="tsuzuri-nav-head"><label/);
    assert.doesNotMatch(html, /<p>/);
  });

  test("狭い画面用の開閉チェックボックスとラベル(既定の文言は「メニュー」)を出力する", () => {
    const html = renderNav(tree, "README.md", "", "");
    assert.match(
      html,
      /^<nav aria-label="サイト内ページ"><input type="checkbox" id="tsuzuri-nav-toggle" class="tsuzuri-nav-toggle"><div class="tsuzuri-nav-head"><label for="tsuzuri-nav-toggle" class="tsuzuri-nav-label">メニュー<\/label><\/div><ul>/
    );
  });

  test("searchを指定すると検索欄の置き場所とスクリプトの読み込みを出力する(未指定なら出力しない)", () => {
    const search = { indexUrl: "/r/search-index.json", scriptUrl: "/r/tsuzuri-search.js", placeholder: "検索", empty: "なし" };
    const html = renderNav(tree, "README.md", "/r", "", "メニュー", search);
    assert.match(
      html,
      /<div class="tsuzuri-search" data-index="\/r\/search-index\.json" data-placeholder="検索" data-empty="なし"><\/div><script src="\/r\/tsuzuri-search\.js" defer><\/script><ul>/
    );
    assert.doesNotMatch(renderNav(tree, "README.md", "/r", ""), /tsuzuri-search/);
  });

  test("開閉ボタンの文言は指定でき、エスケープされる", () => {
    const html = renderNav(tree, "README.md", "", "", "Menu <x>");
    assert.match(html, />Menu &lt;x&gt;<\/label>/);
  });

  test("titleはエスケープされる", () => {
    const html = renderNav(buildSiteTree([["x.md", { meta: { title: "<b>&" } }]]), "x.md", "", "");
    assert.match(html, />&lt;b&gt;&amp;<\/a>/);
  });
});

describe("renderMetaTags", () => {
  test("descriptionありならdescription/og:descriptionの両方を出力する", () => {
    const html = renderMetaTags({ description: "説明文", ogTitle: "タイトル" });
    assert.match(html, /<meta name="description" content="説明文">/);
    assert.match(html, /<meta property="og:description" content="説明文">/);
  });

  test("descriptionなしならdescription/og:descriptionのいずれも出力しない", () => {
    const html = renderMetaTags({ ogTitle: "タイトル" });
    assert.doesNotMatch(html, /name="description"/);
    assert.doesNotMatch(html, /og:description/);
  });

  test("siteNameが非空ならog:site_nameを出力する", () => {
    const html = renderMetaTags({ ogTitle: "t", siteName: "My & Site" });
    assert.match(html, /<meta property="og:site_name" content="My &amp; Site">/);
  });

  test("siteName未設定ならog:site_nameを出力しない", () => {
    const html = renderMetaTags({ ogTitle: "t" });
    assert.doesNotMatch(html, /og:site_name/);
  });

  test("og:titleは常に出力される", () => {
    const html = renderMetaTags({ ogTitle: "タイトル" });
    assert.match(html, /<meta property="og:title" content="タイトル">/);
  });

  test("ogImageが非空なら出力する", () => {
    const html = renderMetaTags({ ogTitle: "t", ogImage: "/img.png" });
    assert.match(html, /<meta property="og:image" content="\/img\.png">/);
  });

  test("ogImage未設定なら出力しない", () => {
    const html = renderMetaTags({ ogTitle: "t" });
    assert.doesNotMatch(html, /og:image/);
  });

  test("noindex===trueの場合のみrobotsタグを出力する", () => {
    const htmlTrue = renderMetaTags({ ogTitle: "t", noindex: true });
    assert.match(htmlTrue, /<meta name="robots" content="noindex">/);

    const htmlFalse = renderMetaTags({ ogTitle: "t", noindex: false });
    assert.doesNotMatch(htmlFalse, /robots/);

    const htmlUndefined = renderMetaTags({ ogTitle: "t" });
    assert.doesNotMatch(htmlUndefined, /robots/);
  });

  test("canonicalUrl未設定時は<link rel=canonical>が出力されない", () => {
    const html = renderMetaTags({ ogTitle: "t" });
    assert.doesNotMatch(html, /rel="canonical"/);
  });

  test("canonicalUrlが非空なら<link rel=canonical>とog:urlを出力する", () => {
    const html = renderMetaTags({ ogTitle: "t", canonicalUrl: "https://example.com/" });
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/example\.com\/">/);
  });

  test("faviconHrefが非空なら<link rel=icon>を出力する", () => {
    const html = renderMetaTags({ ogTitle: "t", faviconHref: "/favicon.ico" });
    assert.match(html, /<link rel="icon" href="\/favicon\.ico">/);
  });

  test("faviconHref未設定なら<link rel=icon>を出力しない", () => {
    const html = renderMetaTags({ ogTitle: "t" });
    assert.doesNotMatch(html, /rel="icon"/);
  });
});

describe("pageTemplate", () => {
  test("navHtml=''・metaTagsHtml=''・lang='ja'時、リファクタリング前と互換の構造を保つ(回帰テスト)", () => {
    // リファクタリング前の pageTemplate が出力していた <style> ブロックの中身
    // (v1でハードコードされていた配色+構造CSS)を baseCss として渡すことで、
    // 出力構造(タグの並び・空行の有無)がリファクタリング前と一致することを確認する。
    // ※ styles/base.css・styles/wa.css を用いたバイト単位の最終確認は T-011 のE2Eで行う。
    const legacyStyleBlock = `  :root {
    color-scheme: light dark;
  }
  * { box-sizing: border-box; }
  body { margin: 0; }
  main { max-width: 860px; margin: 0 auto; }
`;
    const html = pageTemplate({
      title: "タイトル",
      body: "<p>本文</p>",
      baseCss: legacyStyleBlock,
      themeCss: "",
      customCss: "",
      styleFileRel: undefined,
      lang: "ja",
      navHtml: "",
      metaTagsHtml: "",
    });

    // metaTagsHtml="" のとき <title> の直後に余計な空行を挟まず <style> が続く
    assert.match(html, /<title>タイトル<\/title>\n<style>/);
    // navHtml="" のとき <body> の直後に余計な空行を挟まず <main> が続く
    assert.match(html, /<body>\n<main>/);
    assert.match(html, /^<!DOCTYPE html>\n<html lang="ja">/);
    assert.match(html, /<p>本文<\/p>/);
    assert.match(html, new RegExp(legacyStyleBlock.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("metaTagsHtmlが非空なら<title>直後に挿入される", () => {
    const html = pageTemplate({
      title: "t",
      body: "b",
      metaTagsHtml: '<meta name="description" content="d">',
    });
    assert.match(
      html,
      /<title>t<\/title>\n<meta name="description" content="d">\n<style>/
    );
  });

  test("navHtmlが非空なら<body>直後(<main>直前)に挿入される", () => {
    const html = pageTemplate({
      title: "t",
      body: "b",
      navHtml: "<nav>NAV</nav>",
    });
    assert.match(html, /<body>\n<nav>NAV<\/nav>\n<main>/);
  });

  test("3層カスケードの追記順序: base→theme→customの順で出現する", () => {
    const html = pageTemplate({
      title: "t",
      body: "b",
      baseCss: "/*base*/",
      themeCss: "/*theme*/",
      customCss: "/*custom*/",
    });
    const baseIdx = html.indexOf("/*base*/");
    const themeIdx = html.indexOf("/*theme*/");
    const customIdx = html.indexOf("/*custom*/");
    assert.ok(baseIdx >= 0 && themeIdx >= 0 && customIdx >= 0, "3つ全てが出現する");
    assert.ok(baseIdx < themeIdx, "baseはthemeより前");
    assert.ok(themeIdx < customIdx, "themeはcustomより前");
  });

  test("themeCss=''(THEME=none相当)のとき/*theme*/相当の内容は一切出現しない", () => {
    const html = pageTemplate({
      title: "t",
      body: "b",
      baseCss: "/*base*/",
      themeCss: "",
      customCss: "/*custom*/",
    });
    assert.doesNotMatch(html, /\/\*theme\*\//);
    assert.match(html, /\/\*base\*\//);
    assert.match(html, /\/\*custom\*\//);
  });

  test("lang引数が<html lang>に反映される", () => {
    const html = pageTemplate({ title: "t", body: "b", lang: "en" });
    assert.match(html, /<html lang="en">/);
  });

  test("customCssが非空ならstyleFileRelを使ったコメントがcustomCssの直前に挿入される", () => {
    const html = pageTemplate({
      title: "t",
      body: "b",
      customCss: "/*custom*/",
      styleFileRel: "styles/my-style.css",
    });
    assert.match(
      html,
      /\/\* ---- Custom style: styles\/my-style\.css ---- \*\/\n\/\*custom\*\//
    );
  });

  test("customCssが空文字ならstyleFileRelのコメントも出力されない", () => {
    const html = pageTemplate({
      title: "t",
      body: "b",
      customCss: "",
      styleFileRel: "styles/my-style.css",
    });
    assert.doesNotMatch(html, /Custom style/);
  });
});

describe("preprocessRawHtmlPaths", () => {
  test("生HTMLのimg src相対パスをbasePath付きの絶対パスに書き換える", () => {
    const content = `<img src="images/pic.png" alt="x">`;
    const result = preprocessRawHtmlPaths(content, "docs/index.md", "/my-repo");
    assert.equal(result, `<img src="/my-repo/docs/images/pic.png" alt="x">`);
  });

  test("生HTMLのa href相対md参照を.htmlに変換して絶対パス化する", () => {
    const content = `<a href="other.md">link</a>`;
    const result = preprocessRawHtmlPaths(content, "docs/index.md", "/my-repo");
    assert.equal(result, `<a href="/my-repo/docs/other.html">link</a>`);
  });

  test("外部リンクは書き換えない", () => {
    const content = `<a href="https://example.com">link</a>`;
    const result = preprocessRawHtmlPaths(content, "docs/index.md", "/my-repo");
    assert.equal(result, content);
  });

  test("アンカーのみのリンクは書き換えない", () => {
    const content = `<a href="#section">link</a>`;
    const result = preprocessRawHtmlPaths(content, "docs/index.md", "/my-repo");
    assert.equal(result, content);
  });

  test("basePathが空文字の場合もそのまま反映される", () => {
    const content = `<img src="pic.png" alt="x">`;
    const result = preprocessRawHtmlPaths(content, "index.md", "");
    assert.equal(result, `<img src="/pic.png" alt="x">`);
  });
});

describe("defaultNotFoundMarkdown", () => {
  test("LANGが日本語なら日本語、それ以外は英語。トップへのリンク(/)を含む", () => {
    assert.match(defaultNotFoundMarkdown("ja"), /title: ページが見つかりません/);
    assert.match(defaultNotFoundMarkdown("ja-JP"), /ページが見つかりません/);
    assert.match(defaultNotFoundMarkdown("en"), /title: Page not found/);
    for (const lang of ["ja", "en"]) assert.match(defaultNotFoundMarkdown(lang), /\]\(\/\)/);
  });
});

describe("renderPager", () => {
  const a = { rel: "docs/a.md", title: "ページA" };
  const b = { rel: "docs/b.md", title: "<B>" };

  test("前後のページへのリンクを rel=prev/next 付きで出力し、タイトルはエスケープする", () => {
    const html = renderPager(a, b, "/repo");
    assert.match(html, /^<nav class="tsuzuri-pager" aria-label="前後のページ">/);
    assert.match(html, /<a class="tsuzuri-pager-prev" rel="prev" href="\/repo\/docs\/a\.html"><span>前のページ<\/span>ページA<\/a>/);
    assert.match(html, /<a class="tsuzuri-pager-next" rel="next" href="\/repo\/docs\/b\.html"><span>次のページ<\/span>&lt;B&gt;<\/a>/);
  });
  test("片方だけのときはその片方だけ、どちらも無ければ空文字", () => {
    assert.doesNotMatch(renderPager(null, b, ""), /rel="prev"/);
    assert.doesNotMatch(renderPager(a, null, ""), /rel="next"/);
    assert.equal(renderPager(null, null, ""), "");
  });
  test("文言は指定できる", () => {
    const html = renderPager(a, null, "", { prev: "Previous", next: "Next", nav: "Pager" });
    assert.match(html, /aria-label="Pager"/);
    assert.match(html, /<span>Previous<\/span>/);
  });
});
