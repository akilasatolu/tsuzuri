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
  renderAlert,
  renderLangSwitch,
} from "../.github/scripts/lib/html-renderer.mjs";
import { uiStrings } from "../.github/scripts/lib/i18n.mjs";
import { buildSiteTree } from "../.github/scripts/lib/site-tree.mjs";
import { pageHref } from "../.github/scripts/lib/path-utils.mjs";

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

  test("ディレクトリは折りたためる<details>+入れ子の<ul>。どのページでも最初はすべて開いておく", () => {
    const html = renderNav(tree, "README.md", "", "");
    assert.match(
      html,
      /<li><details open><summary>docs<\/summary><ul><li><a href="\/docs\/a\.html">ページA<\/a><\/li><li><details open><summary>deep<\/summary><ul><li><a href="\/docs\/deep\/b\.html">b\.md<\/a><\/li><\/ul><\/details><\/li><\/ul><\/details><\/li>/
    );
    assert.doesNotMatch(html, /<details>/, "閉じたディレクトリは無い");
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

describe("renderNav の組み立て用の引数", () => {
  const tree = buildSiteTree([
    ["README.md", { meta: { title: "ホーム" } }],
    ["docs/a.md", { meta: { title: "ページA" } }],
  ]);
  const args = [tree, "docs/a.md", "/repo", "サイト", "メニュー", null, "サイト内ページ"];

  test("8番目を省略・空のオブジェクト・既定と同じ値 → 今と同じ文字列", () => {
    const base = renderNav(...args);
    assert.equal(renderNav(...args, {}), base);
    assert.equal(renderNav(...args, { langSwitchHtml: "" }), base);
    assert.equal(renderNav(...args, { hrefFor: (rel) => pageHref(rel, "/repo") }), base);
    assert.match(base, /<div class="tsuzuri-nav-head"><p>サイト<\/p><label /);
  });

  test("hrefFor を渡すとページへのリンク先がそれで決まる(エスケープもする)", () => {
    const html = renderNav(...args, { hrefFor: (rel) => `/x/en/${rel}?a&b` });
    assert.match(html, /<a href="\/x\/en\/README\.md\?a&amp;b">ホーム<\/a>/);
    assert.match(html, /<a href="\/x\/en\/docs\/a\.md\?a&amp;b" aria-current="page">ページA<\/a>/);
    assert.doesNotMatch(html, /href="\/repo\//);
  });

  test("langSwitchHtml はサイト名と「メニュー」ラベルの間に入る(サイト名が無ければ先頭)", () => {
    const sw = '<a class="tsuzuri-lang-switch" href="/en/">English</a>';
    const html = renderNav(...args, { langSwitchHtml: sw });
    assert.ok(
      html.includes(`<div class="tsuzuri-nav-head"><p>サイト</p>${sw}<label for="tsuzuri-nav-toggle" class="tsuzuri-nav-label">メニュー</label></div>`),
    );
    const noName = renderNav(tree, "", "", undefined, "Menu", null, "Site pages", { langSwitchHtml: sw });
    assert.ok(noName.includes(`<div class="tsuzuri-nav-head">${sw}<label `));
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

  test("alternates が空(省略・[])なら今と同じ", () => {
    const opts = { ogTitle: "T", canonicalUrl: "https://e.x/a.html", faviconHref: "/f.png" };
    const base = renderMetaTags(opts);
    assert.equal(renderMetaTags({ ...opts, alternates: [] }), base);
    assert.doesNotMatch(base, /rel="alternate"/);
  });

  test("alternates 2件 → canonical の直後に2行、渡した順で、値はエスケープされる", () => {
    const html = renderMetaTags({
      ogTitle: "T",
      canonicalUrl: "https://e.x/a.html",
      faviconHref: "/f.png",
      alternates: [
        { hreflang: "ja", href: "https://e.x/a.html?x=1&y=2" },
        { hreflang: 'en"', href: "https://e.x/en/a.html" },
      ],
    });
    assert.ok(
      html.includes(
        `<link rel="canonical" href="https://e.x/a.html">\n` +
          `<link rel="alternate" hreflang="ja" href="https://e.x/a.html?x=1&amp;y=2">\n` +
          `<link rel="alternate" hreflang="en&quot;" href="https://e.x/en/a.html">\n` +
          `<link rel="icon" href="/f.png">`,
      ),
    );
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
    // ※ styles/base.css・styles/material.css を用いたバイト単位の最終確認は T-011 のE2Eで行う。
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
      lang: "ja",
      navHtml: "<nav>NAV</nav>",
    });
    assert.match(html, /<body>\n<a class="tsuzuri-skip" href="#tsuzuri-main">本文へスキップ<\/a>\n<nav>NAV<\/nav>\n<main id="tsuzuri-main">/);
  });

  test("skipLabel を省略すると lang の文言になる(既定の lang は en)", () => {
    const en = pageTemplate({ title: "t", body: "b", navHtml: "<nav>NAV</nav>" });
    assert.match(en, /^<!DOCTYPE html>\n<html lang="en">/);
    assert.match(en, /<a class="tsuzuri-skip" href="#tsuzuri-main">Skip to content<\/a>/);
    const custom = pageTemplate({ title: "t", body: "b", lang: "ja", navHtml: "<nav>NAV</nav>", skipLabel: "<飛ぶ>" });
    assert.match(custom, />&lt;飛ぶ&gt;<\/a>/);
  });

  test("langBarHtml が空なら出力は省略時と同じ(回帰テスト)", () => {
    for (const navHtml of ["", "<nav>NAV</nav>"]) {
      const opts = { title: "t", body: "<p>b</p>", lang: "ja", navHtml, metaTagsHtml: "<meta>" };
      assert.equal(pageTemplate({ ...opts, langBarHtml: "" }), pageTemplate(opts));
    }
  });

  test("langBarHtml を指定すると <main…> の直後(本文の前)に入る", () => {
    const bar = '<div class="tsuzuri-lang-bar">LANG</div>';
    const withNav = pageTemplate({ title: "t", body: "<p>b</p>", navHtml: "<nav>NAV</nav>", langBarHtml: bar });
    assert.match(withNav, /<main id="tsuzuri-main">\n<div class="tsuzuri-lang-bar">LANG<\/div>\n<p>b<\/p>\n<\/main>/);
    const noNav = pageTemplate({ title: "t", body: "<p>b</p>", langBarHtml: bar });
    assert.match(noNav, /<body>\n<main>\n<div class="tsuzuri-lang-bar">LANG<\/div>\n<p>b<\/p>/);
    assert.equal(withNav.split(bar).length, 2); // 1回だけ
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
  test("srcset の各候補を書き換える(記述子はそのまま。@ は %40 にエンコード)", () => {
    const content =
      '<picture><source media="(prefers-color-scheme: dark)" srcset="assets/dark.png 1x, assets/dark@2x.png 2x"><img src="assets/light.png" alt="logo"></picture>';
    assert.equal(
      preprocessRawHtmlPaths(content, "README.md", "/repo"),
      '<picture><source media="(prefers-color-scheme: dark)" srcset="/repo/assets/dark.png 1x, /repo/assets/dark%402x.png 2x"><img src="/repo/assets/light.png" alt="logo"></picture>'
    );
  });

  test("単一引用符の srcset も書き換え、書き換えた URL の ' は %27 にして属性を壊さない", () => {
    assert.equal(
      preprocessRawHtmlPaths("<img srcset='a.png 1x, b.png 2x'>", "README.md", "/repo"),
      "<img srcset='/repo/a.png 1x, /repo/b.png 2x'>"
    );
    assert.equal(
      preprocessRawHtmlPaths(`<img srcset="it's.png 1x">`, "README.md", "/repo"),
      `<img srcset="/repo/it%27s.png 1x">`
    );
  });

  test("hrefFor の3つ目の引数 embed は、a では false、img・video・audio・source・srcset では true", () => {
    const calls = [];
    const hrefFor = (from, href, opts) => {
      calls.push([href, opts.embed]);
      return href;
    };
    preprocessRawHtmlPaths(
      '<a href="a.xyz">l</a><img src="i.xyz"><video src="v.xyz"></video><audio src="s.xyz"></audio><source src="o.xyz">' +
        '<img srcset="p.xyz 1x, q.xyz 2x"><source srcset="r.xyz">',
      "README.md",
      "",
      hrefFor,
    );
    assert.deepEqual(calls, [
      ["a.xyz", false],
      ["i.xyz", true],
      ["v.xyz", true],
      ["s.xyz", true],
      ["o.xyz", true],
      ["p.xyz", true],
      ["q.xyz", true],
      ["r.xyz", true],
    ]);
  });

  test("srcset の data: URL・外部 URL・#始まりは書き換えない", () => {
    const content = '<img srcset="data:image/png;base64,AAA= 1x, https://example.com/a.png 2x, //cdn.example.com/b.png 3x, #x 4x, c.png 5x">';
    assert.equal(
      preprocessRawHtmlPaths(content, "README.md", ""),
      '<img srcset="data:image/png;base64,AAA= 1x, https://example.com/a.png 2x, //cdn.example.com/b.png 3x, #x 4x, /c.png 5x">'
    );
  });

});

describe("defaultNotFoundMarkdown", () => {
  test("LANGが日本語なら日本語、それ以外は英語。トップへのリンク(/)を含む", () => {
    assert.match(defaultNotFoundMarkdown("ja"), /title: ページが見つかりません/);
    assert.match(defaultNotFoundMarkdown("ja-JP"), /ページが見つかりません/);
    assert.match(defaultNotFoundMarkdown("en"), /title: Page not found/);
    for (const lang of ["ja", "en"]) assert.match(defaultNotFoundMarkdown(lang), /\]\(\/\)/);
  });

  test("文字列が変更前と1文字も変わらない(ja・ja-JP・en・fr・省略)", () => {
    const ja = [
      "---",
      "title: ページが見つかりません",
      "---",
      "",
      "# ページが見つかりません",
      "",
      "お探しのページは、移動または削除されたか、URLが間違っている可能性があります。",
      "",
      "[トップページへ戻る](/)",
      "",
    ].join("\n");
    const en = [
      "---",
      "title: Page not found",
      "---",
      "",
      "# Page not found",
      "",
      "The page you are looking for may have been moved or deleted, or the URL may be incorrect.",
      "",
      "[Back to the top page](/)",
      "",
    ].join("\n");
    assert.equal(defaultNotFoundMarkdown("ja"), ja);
    assert.equal(defaultNotFoundMarkdown("ja-JP"), ja);
    assert.equal(defaultNotFoundMarkdown(), ja); // 省略時は今までどおり日本語
    assert.equal(defaultNotFoundMarkdown("en"), en);
    assert.equal(defaultNotFoundMarkdown("fr"), en);
    // 2つ目の引数を省略・空のオブジェクトでも同じ
    assert.equal(defaultNotFoundMarkdown("ja", {}), ja);
    assert.equal(defaultNotFoundMarkdown("en", {}), en);
  });

  test("sections(ja・en)→ 言語ごとに <div lang> で包んだ2つのかたまりを渡した順に並べる", () => {
    const md = defaultNotFoundMarkdown("ja", { sections: [{ tag: "ja", homeHref: "/" }, { tag: "en", homeHref: "/en/" }] });
    const ja = uiStrings("ja").notFound;
    const en = uiStrings("en").notFound;
    assert.equal(
      md,
      [
        "---",
        `title: ${ja.title}`,
        "---",
        "",
        '<div lang="ja">',
        "",
        `# ${ja.title}`,
        "",
        ja.body,
        "",
        `[${ja.back}](/)`,
        "",
        "</div>",
        "",
        '<div lang="en">',
        "",
        `# ${en.title}`,
        "",
        en.body,
        "",
        `[${en.back}](/en/)`,
        "",
        "</div>",
        "",
      ].join("\n"),
    );
    assert.equal(md.match(/<div lang=/g).length, 2);
    assert.ok(md.indexOf('<div lang="ja">') < md.indexOf('<div lang="en">'));
  });

  test("sections の順番・基本言語が en の場合も、渡した順・それぞれの言語の文言になる", () => {
    const md = defaultNotFoundMarkdown("en", { sections: [{ tag: "en", homeHref: "/" }, { tag: "ja-JP", homeHref: "/ja/" }] });
    assert.match(md, /^---\ntitle: Page not found\n---\n/);
    assert.ok(md.indexOf('<div lang="en">') < md.indexOf('<div lang="ja-JP">'));
    assert.match(md, /\[Back to the top page\]\(\/\)/);
    assert.match(md, /\[トップページへ戻る\]\(\/ja\/\)/);
  });

  test("sections が1件 → かたまりは1つ。homeHref に basePath は付けない", () => {
    const md = defaultNotFoundMarkdown("ja", { sections: [{ tag: "en", homeHref: "/en/" }] });
    assert.equal(md.match(/<div lang=/g).length, 1);
    assert.match(md, /<div lang="en">\n\n# Page not found\n/);
    assert.match(md, /\]\(\/en\/\)\n\n<\/div>\n$/);
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
  test("5番目を省略・空のオブジェクト → 今と同じ。labels が undefined でも既定の文言", () => {
    const base = renderPager(a, b, "/repo");
    assert.equal(renderPager(a, b, "/repo", undefined, {}), base);
    assert.equal(renderPager(a, b, "/repo", undefined, { hrefFor: (rel) => pageHref(rel, "/repo") }), base);
  });
  test("hrefFor を渡すとリンク先がそれで決まる(エスケープもする)", () => {
    const html = renderPager(a, b, "/repo", undefined, { hrefFor: (rel) => `/repo/en/${rel.replace(/\.md$/, ".html")}?q="1"` });
    assert.match(html, /rel="prev" href="\/repo\/en\/docs\/a\.html\?q=&quot;1&quot;"/);
    assert.match(html, /rel="next" href="\/repo\/en\/docs\/b\.html\?q=&quot;1&quot;"/);
  });
});

test("MERMAID_VERSION は deps/mermaid/package.json(Dependabot が更新する)のバージョンと同じ", async () => {
  const { readFileSync } = await import("node:fs");
  const { MERMAID_VERSION } = await import("../.github/scripts/lib/html-renderer.mjs");
  const manifest = JSON.parse(readFileSync(new URL("../deps/mermaid/package.json", import.meta.url), "utf-8"));
  assert.equal(
    MERMAID_VERSION,
    manifest.dependencies.mermaid,
    "Dependabot が deps/mermaid/package.json を更新したら、html-renderer.mjs の MERMAID_VERSION も同じバージョンにしてください"
  );
});

describe("renderAlert", () => {
  const note = "<p>[!NOTE]\n本文</p>\n";
  const expected = (type, title, body = "<p>本文</p>\n") =>
    `<div class="markdown-alert markdown-alert-${type}"><p class="markdown-alert-title">${title}</p>\n${body}</div>\n`;

  test("true(省略時)は日本語の見出し、false は英語の見出し(変更前と同じ)", () => {
    const ja = { note: "補足", tip: "ヒント", important: "重要", warning: "警告", caution: "注意" };
    const en = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" };
    for (const type of Object.keys(ja)) {
      const html = `<p>[!${type.toUpperCase()}]\n本文</p>\n`;
      assert.equal(renderAlert(html), expected(type, ja[type]));
      assert.equal(renderAlert(html, true), expected(type, ja[type]));
      assert.equal(renderAlert(html, false), expected(type, en[type]));
    }
  });

  test("オブジェクトを渡すと、その見出しを使う(エスケープもする)", () => {
    assert.equal(renderAlert(note, uiStrings("ja").alerts), expected("note", "補足"));
    assert.equal(renderAlert(note, uiStrings("en").alerts), expected("note", "Note"));
    assert.equal(renderAlert("<p>[!tip] 本文</p>\n", { tip: "Astuce <b>" }), expected("tip", "Astuce &lt;b&gt;"));
  });

  test("渡した表にその種類が無ければ英語の見出し", () => {
    assert.equal(renderAlert(note, { tip: "x" }), expected("note", "Note"));
  });

  test("注意書きでない・未知の種類は null(変更前と同じ)", () => {
    for (const labels of [true, false, uiStrings("ja").alerts]) {
      assert.equal(renderAlert("<p>ふつうの引用</p>\n", labels), null);
      assert.equal(renderAlert("<p>[!DANGER]\n本文</p>\n", labels), null);
    }
  });

  test("見出しだけの行のあとの空の段落は除く", () => {
    assert.equal(renderAlert("<p>[!WARNING]</p>\n<p>本文</p>\n", false), expected("warning", "Warning", "<p>本文</p>\n"));
  });
});

describe("renderLangSwitch", () => {
  const ja = uiStrings("ja");
  const en = uiStrings("en");
  const e = (tag, href, untranslated = false) => ({ tag, href, untranslated });

  test("2言語: リンク1つ。hreflang・今の言語の文言の title・<span lang>", () => {
    const html = renderLangSwitch({
      current: "ja",
      entries: [e("ja", "/repo/docs/cli.html"), e("en", "/repo/en/docs/cli.html")],
      strings: ja,
      placement: "nav",
    });
    assert.equal(
      html,
      '<a class="tsuzuri-lang-switch" href="/repo/en/docs/cli.html" hreflang="en" title="Englishに切り替える"><span lang="en">English</span></a>',
    );
    // 英語のページからは英語の文言で日本語へ
    const fromEn = renderLangSwitch({ current: "en", entries: [e("ja", "/a.html"), e("en", "/en/a.html")], strings: en, placement: "nav" });
    assert.equal(
      fromEn,
      '<a class="tsuzuri-lang-switch" href="/a.html" hreflang="ja" title="Switch language to 日本語"><span lang="ja">日本語</span></a>',
    );
  });

  test("2言語で未翻訳: data-untranslated と未翻訳の title", () => {
    const html = renderLangSwitch({ current: "ja", entries: [e("ja", "/docs/b.html"), e("en", "/en/", true)], strings: ja, placement: "nav" });
    assert.equal(
      html,
      '<a class="tsuzuri-lang-switch" href="/en/" hreflang="en" data-untranslated' +
        ' title="このページのEnglish版はありません。Englishのトップページを開きます。"><span lang="en">English</span></a>',
    );
  });

  test("3言語: <details>、今の言語に aria-current、languages(entries)の順、未翻訳に data-untranslated と title", () => {
    const html = renderLangSwitch({
      current: "en",
      entries: [e("ja", "/a.html"), e("en", "/en/a.html"), e("fr", "/fr/", true)],
      strings: en,
      placement: "nav",
    });
    assert.equal(
      html,
      '<details class="tsuzuri-lang-menu"><summary class="tsuzuri-lang-switch" title="Language"><span lang="en">English</span></summary><ul>' +
        '<li><a href="/a.html" hreflang="ja" lang="ja">日本語</a></li>' +
        '<li><a href="/en/a.html" hreflang="en" lang="en" aria-current="true">English</a></li>' +
        '<li><a href="/fr/" hreflang="fr" lang="fr" data-untranslated title="This page is not available in Français. Opens the Français top page.">Français</a></li>' +
        "</ul></details>",
    );
    assert.equal(html.match(/aria-current/g).length, 1);
    assert.equal(html.match(/data-untranslated/g).length, 1);
  });

  test("3言語で1つの href が空 → その言語を除く(残り1つならリンクの形)", () => {
    const one = renderLangSwitch({ current: "ja", entries: [e("ja", "/a.html"), e("en", ""), e("fr", "/fr/a.html")], strings: ja, placement: "nav" });
    assert.equal(
      one,
      '<a class="tsuzuri-lang-switch" href="/fr/a.html" hreflang="fr" title="Françaisに切り替える"><span lang="fr">Français</span></a>',
    );
    // 4言語で1つが空 → 残り2つでメニュー。空の言語は一覧に出ない
    const menu = renderLangSwitch({
      current: "ja",
      entries: [e("ja", "/a.html"), e("en", ""), e("fr", "/fr/a.html"), e("de", "/de/", true)],
      strings: ja,
      placement: "nav",
    });
    assert.match(menu, /^<details class="tsuzuri-lang-menu">/);
    assert.doesNotMatch(menu, /hreflang="en"/);
    assert.equal(menu.match(/<li>/g).length, 3);
  });

  test("placement が bar なら <div class=\"tsuzuri-lang-bar\"> で包む(リンク・メニューとも)", () => {
    const entries = [e("ja", "/a.html"), e("en", "/en/a.html")];
    const nav = renderLangSwitch({ current: "ja", entries, strings: ja, placement: "nav" });
    assert.equal(renderLangSwitch({ current: "ja", entries, strings: ja, placement: "bar" }), `<div class="tsuzuri-lang-bar">${nav}</div>`);
    const three = [...entries, e("fr", "/fr/a.html")];
    const menuNav = renderLangSwitch({ current: "ja", entries: three, strings: ja, placement: "nav" });
    assert.equal(renderLangSwitch({ current: "ja", entries: three, strings: ja, placement: "bar" }), `<div class="tsuzuri-lang-bar">${menuNav}</div>`);
  });

  test("切り替え先が0 → \"\"(1言語・ほかの言語の href がすべて空。bar でも包まない)", () => {
    assert.equal(renderLangSwitch({ current: "ja", entries: [e("ja", "/a.html")], strings: ja, placement: "nav" }), "");
    assert.equal(renderLangSwitch({ current: "ja", entries: [e("ja", "/a.html"), e("en", ""), e("fr", "")], strings: ja, placement: "bar" }), "");
    assert.equal(renderLangSwitch({ current: "ja", entries: [], strings: ja, placement: "bar" }), "");
  });

  test("属性の値はエスケープされる(href に \"・<・& を含む)", () => {
    const bad = '/x?a="1"&b=<2>';
    const esc = "/x?a=&quot;1&quot;&amp;b=&lt;2&gt;";
    const link = renderLangSwitch({ current: "ja", entries: [e("ja", "/a.html"), e("en", bad)], strings: ja, placement: "nav" });
    assert.ok(link.includes(`href="${esc}"`));
    assert.doesNotMatch(link, /="1"/);
    const menu = renderLangSwitch({
      current: "ja",
      entries: [e("ja", bad), e("en", bad, true), e("fr", bad)],
      strings: { ...ja, langMenu: 'L"<&' },
      placement: "nav",
    });
    assert.equal(menu.split(`href="${esc}"`).length, 4);
    assert.ok(menu.includes('title="L&quot;&lt;&amp;"'));
    assert.doesNotMatch(menu, /<2>|="1"/);
  });
});
