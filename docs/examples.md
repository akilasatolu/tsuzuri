---
title: 使用例(Examples)
---

# 使用例(Examples)

## Tsuzuriで作られたサイト

現時点(初版)ではまだ掲載できる事例がないため、このセクションは空の状態です。
今後、実際にTsuzuriを使って公開されたサイトが増えてきたら、ここにリンク集として
追加していく予定です。

## コーポレートページとしての活用例

Tsuzuriは元々「READMEをそのままGitHub Pagesにする」ことを目的にしたツールですが、
設定を組み合わせることで、READMEを起点にした簡易的なコーポレートページ・製品紹介
ページのような使い方もできます。例えば次のような組み合わせが考えられます。

- `ROOT_MD`にトップページ用のMarkdownを指定し、そこから会社概要・サービス紹介・
  お問い合わせ方法などのページへリンクを張って構成する
- `NAV_ENABLED=true`にして、各ページ間を行き来できる簡易ナビゲーションを表示する
- 各ページのfrontmatterで`title`/`description`/`ogImage`を設定し、SNS等でシェアされた
  際の見え方(OGP)を整える(詳細は[frontmatter.md](./frontmatter.md))
- `FAVICON_FILE`でブランドのfaviconを設定し、`CUSTOM_DOMAIN`で独自ドメインを割り当てる
  (詳細は[configuration.md](./configuration.md)、[deployment.md](./deployment.md))
- `THEME`を`ai`(藍)や`shu`(朱)のようなブランドカラーに近いテーマに変更する
  (詳細は[theming.md](./theming.md))

このように、追加のビルドツールやCMSを用意しなくても、Markdownファイルと設定ファイルの
組み合わせだけである程度体裁の整ったページ群を用意できます。

## コントリビュート歓迎

自分が作ったサイトをこのページの事例集に載せてほしい場合は、ぜひご連絡ください。
掲載方法や、その他プロジェクトへの貢献方法全般については[CONTRIBUTING.md](https://github.com/akilasatolu/tsuzuri/blob/main/CONTRIBUTING.md)を
参照してください。
