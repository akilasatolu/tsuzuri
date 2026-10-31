---
title: シェアと検索
description: リンクがシェアされたときの見え方と、検索での見つけやすさのために何を書くか(OGP・favicon・sitemap・llms.txt)
order: 60
---

# シェアと検索

いくつかの設定で、ページのリンクがシェアされたときの見え方と、検索エンジンやAIツールからの見つけやすさが決まります。

## シェアされたときの見え方(OGP)

- **タイトルと説明**: 各ページのfrontmatterに`title`と`description`を書きます。リンクのプレビューと検索結果に出ます。`description`を書かなければ、最初の段落の先頭120文字までが使われます。
- **画像**: ページのfrontmatterに`ogImage`を書くか、書いていないすべてのページ向けに`.github/tsuzuri/config`の`OGP_DEFAULT_IMAGE`を設定します(例: `assets/ogp.png`)。どちらもなければ、画像は出ません。
- **サイト名**: `SITE_NAME`が、プレビューのサイト名とナビの見出しに使われます。空ならリポジトリ名になります。

詳細: [`OGP_DEFAULT_IMAGE`](../reference/configuration.ja.md#ogp_default_image)、[`SITE_NAME`](../reference/configuration.ja.md#site_name)、[`description`と`ogImage`](../reference/frontmatter.ja.md)。

## favicon

`FAVICON_FILE`に画像のパスを書くと(例: `FAVICON_FILE=assets/favicon.svg`)、すべてのページで、ブラウザのタブのアイコンとして表示されます。書かなければ、faviconはありません。詳細: [`FAVICON_FILE`](../reference/configuration.ja.md#favicon_file)。

> [!NOTE]
> Tsuzuriのロゴの色(紺の地に、炎のオレンジの線と白いページ)は、Tsuzuri自身のブランドの色です。`FAVICON_FILE`で設定する、あなたのサイトのfaviconとは関係ありません。

## sitemap.xmlとrobots.txt

GitHub Actionsでは、検索エンジン向けに、サイトのページを並べた`sitemap.xml`が書かれます(`noindex: true`のページは除く)。`LAST_UPDATED=true`なら、各ページの最終更新日も入ります。`robots.txt`は、サイトがドメイン直下にあるとき(`<owner>.github.io`というリポジトリか、`CUSTOM_DOMAIN`)だけ、`sitemap.xml`を指すものが書かれます。どれも自分で書く必要はありません。

## llms.txt

`LLMS_TXT`は既定でオンで、GitHub Actionsでは、AIツール向けにサイトのページを並べた`llms.txt`が書かれます。`## Docs`の並びはナビの順なので、AIに最初に読んでほしいページが先になるように`order`を決めます。`nav: false`のページは`## Optional`に入ります。止めるには`LLMS_TXT=false`と書きます。詳細: [ビルドの仕組み](../reference/how-it-works.ja.md)。

## 次に読む

- [更新する](./update.ja.md): コマンド1つでTsuzuriを最新にする。
- [FAQ](../faq.ja.md): うまくいかないとき。
