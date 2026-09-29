---
title: 使用例(Examples)
---

# 使用例(Examples)

## Tsuzuriで作られたサイト

### このサイト

いま見ているこのドキュメントサイトも、Tsuzuri自身で作っています
([ソース](https://github.com/akilasatolu/tsuzuri/tree/docs))。次の機能を組み合わせています。

- **独自CSSだけで作った見た目**: `THEME=none`にして、`STYLE_FILE`の独自CSSで配色・カード・ボタンを
  作っています([独自CSSの例](gallery/custom.md))。
- **トップページの入口**: `README.md`の冒頭に、`<div class="tsuzuri-hero">`のようにclass付きのHTMLを書き、
  独自CSSで見た目を付けています。GitHub上ではclassが消えて普通の文章として表示されるので、
  GitHubで読んでも崩れません。
- **テーマギャラリー**: 各テーマの見本ページは、frontmatterで`theme`(そのページのテーマ)と
  `styleFile`(中身が空のCSS)を指定して、組み込みテーマだけの見た目にしています
  ([テーマギャラリー](gallery.md))。
- **404ページ**: リポジトリ直下の`404.md`で作っています。
- **リンク切れを公開しない**: `STRICT_LINKS=true`にして、リンク切れや見出しの無いリンクがあると
  ビルドを失敗させています。

事例を募集しています。自分のサイトを載せてほしい場合は、下の「コントリビュート歓迎」を参照してください。

## ドキュメントサイトの例

リポジトリの`README.md`と`docs/`フォルダを、そのままドキュメントサイトにする構成です。

```
README.md                 … トップページ(docs/ の各ページへリンクする)
docs/getting-started.md   … order: 1
docs/guide.md             … order: 2
docs/reference/README.md  … order: 3(ディレクトリの位置もこの order で決まる)
docs/reference/api.md
docs/faq.md               … order を書かない(order を書いたページの後ろに並ぶ)
```

```
NAV_ENABLED=true
SITE_NAME=My Project
STRICT_LINKS=true
LAST_UPDATED=true
```

- ナビの並び順は、リンクを見つけた順です。READMEでのリンクの順番と違う順にしたいときは、
  frontmatterの`order`で指定します([Frontmatterリファレンス](frontmatter.md#order))。
- pushする前に`npx github:akilasatolu/tsuzuri#v1 preview --open`で確認すると、保存するたびに
  ブラウザの表示が更新されます([CLIリファレンス](cli.md#手元で確認するpreview))。

## コーポレートページとしての活用例

Tsuzuriは元々「READMEをそのままGitHub Pagesにする」ことを目的にしたツールですが、
設定を組み合わせることで、READMEを起点にした簡易的なコーポレートページ・製品紹介
ページのような使い方もできます。例えば次のような組み合わせが考えられます。

- `ROOT_MD`にトップページ用のMarkdownを指定し、そこから会社概要・サービス紹介・
  お問い合わせ方法などのページへリンクを張って構成する
- `NAV_ENABLED=true`にして、各ページ間を行き来できる簡易ナビゲーションを表示する
- 各ページのfrontmatterで`title`/`description`/`ogImage`を設定し、SNS等でシェアされた
  際の見え方(OGP)を整える(詳細は[frontmatter.md](./frontmatter.md)。`description`を書かないページは、
  本文の最初の段落から自動で作られます)
- `FAVICON_FILE`でブランドのfaviconを設定し、`CUSTOM_DOMAIN`で独自ドメインを割り当てる
  (詳細は[configuration.md](./configuration.md)、[deployment.md](./deployment.md))
- `THEME`を`umi`(海)や`sakura`(桜)のようなブランドカラーに近いテーマに変更する。さらに作り込みたい
  場合は、このサイトのように`THEME=none`と独自CSSで見た目を作る(詳細は[theming.md](./theming.md))
- 「お知らせ」の過去記事のように、ナビに並べるほどではないページは`nav: false`にする

このように、追加のビルドツールやCMSを用意しなくても、Markdownファイルと設定ファイルの
組み合わせだけである程度体裁の整ったページ群を用意できます。

## コントリビュート歓迎

自分が作ったサイトをこのページの事例集に載せてほしい場合は、ぜひご連絡ください。
掲載方法や、その他プロジェクトへの貢献方法全般については[CONTRIBUTING.md](https://github.com/akilasatolu/tsuzuri/blob/main/CONTRIBUTING.md)を
参照してください。
