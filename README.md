---
title: Tsuzuri
---

<img src="assets/favicon.svg" width="48" alt="Tsuzuri logo">

# Tsuzuri

> READMEを起点に、リンクをたどってGitHub Pagesへ自動デプロイするツール

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/akilasatolu/tsuzuri/blob/main/LICENSE)
[![Build Status](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml)

## Tsuzuriとは

Tsuzuri(綴)は、リポジトリの`README.md`を起点にして本文中のリンクをたどり、
つながっているMarkdownファイルと画像をそのままGitHub Pagesのサイトへ変換・
デプロイするツールです。名前は「複数の紙を綴じて1冊にする」という製本用語に
由来しており、README起点でつながった複数のMarkdownファイルを1つのサイトに
束ねる、というこのツールの動きをそのまま表しています。

設定ファイルを1つ用意するだけで、READMEやdocsフォルダの構成をほぼそのまま
Webサイトとして公開できます。ページ数が増えても、READMEにリンクを追加する
だけで自動的にサイトへ反映されるので、ナビゲーションを手作業で作り直す必要
はありません。

**ブランディングについての注意**: ロゴの円(印章部分・藍色)と十字ステッチ
(和綴じの糸目・朱色)の配色は、Tsuzuri自身のブランディングです。利用者が
生成するページ側のfavicon(`FAVICON_FILE`設定キーで指定するもの)とは無関係
なので混同しないでください。

このドキュメント自体もTsuzuriで生成し、GitHub Pagesで公開しています:
https://akilasatolu.github.io/tsuzuri/

## 特徴

- 設定ファイル(`.github/docs-pages.config`)を1つ書き換えるだけで、ワークフローYAMLを直接編集せずに動作をカスタマイズできる
- READMEを起点にリンクをたどって自動でページを収集・階層化するので、サイトマップを手動で管理する必要がない
- テーマ5種(和/無地/墨/藍/朱)+独自CSSの3層カスケードで、見た目を自分好みに調整できる
- SEOメタタグ・OGP・favicon・簡易ナビゲーションに対応しており、社内サイトやコーポレートページのような使い方にも耐えられる

## クイックスタート

1. 自分のリポジトリのルートで次のコマンドを実行する(対話形式でファイルが生成されます)。

   ```sh
   npx github:akilasatolu/tsuzuri init
   ```

   このコマンドは、ワークフロー(`.github/workflows/docs-pages.yml`)・設定ファイル
   (`.github/docs-pages.config`)に加えて、ビルドスクリプト本体一式
   (`.github/tsuzuri/`配下)もリポジトリにコピーします。生成後は、実行のたびに
   `akilasatolu/tsuzuri`本体を参照することなく、あなたのリポジトリの中だけで
   ビルド・デプロイが完結します(詳しくは[CLIリファレンス](docs/cli.md)を参照)。

2. GitHubリポジトリの **Settings → Pages** で、Sourceを **GitHub Actions** に設定する(初回のみ)。
3. `.github/docs-pages.config`の`TRIGGER_BRANCH`に指定したブランチ(デフォルトは`main`)にpush/マージする。

Actionsタブでワークフローが実行され、完了するとGitHub Pagesに公開されます。URLは
Settings → Pagesに表示されます。設定ファイルの各項目の詳細は
[設定リファレンス](docs/configuration.md)を参照してください。

## ドキュメント

- [Getting Started](docs/getting-started.md)
- [仕組み(Concepts)](docs/concepts.md)
- [設定リファレンス(Configuration)](docs/configuration.md)
- [テーマ・スタイル(Theming)](docs/theming.md)
- [テーマギャラリー(Gallery)](docs/gallery.md)
- [Frontmatterリファレンス](docs/frontmatter.md)
- [CLIリファレンス](docs/cli.md)
- [デプロイ設定(Deployment)](docs/deployment.md)
- [使用例(Examples)](docs/examples.md)
- [FAQ](docs/faq.md)

## スタイルのカスタマイズ

見た目を変えたい場合、CSSを自分で書く必要は必ずしもありません。
`.github/docs-pages.config`の`THEME`に、和(`wa`・既定)/無地(`muji`)/墨(`sumi`)/
藍(`ai`)/朱(`shu`)/装飾なし(`none`)のいずれかを指定するだけで、配色や
リンクの下線の有無などの見た目がまとめて切り替わります。詳しくは
[テーマ・スタイル(Theming)](docs/theming.md)を参照してください。

さらに細かく配色だけを調整したい場合は、`.github/docs-pages.config`の
`STYLE_FILE`に指定したCSSファイルの中で、以下のCSSカスタムプロパティを
上書きしてください(THEMEの後に読み込まれる第3層として反映されます)。

| 変数 | 意味 |
|---|---|
| `--fg` | 本文の文字色 |
| `--bg` | 背景色 |
| `--border` | テーブル罫線・区切り線の色 |
| `--accent` | リンクなどの強調色 |
| `--code-bg` | コードブロック・インラインコードの背景色 |
| `--font` | 本文のフォント指定(font-family) |
| `--content-width` | 本文カラムの最大幅(例: `860px`) |
| `color-scheme` | `light` / `dark` / `light dark`(OS設定に追従) |

`THEME=none`を指定した場合はこれらの変数がどこにも定義されないため、
ブラウザの既定の見た目(黒文字・白背景など)がそのまま使われます。

## テーマプレビュー

組み込みテーマの見た目は、[テーマギャラリー](docs/gallery.md)で実際のページとして
見比べられます。

自分のサイトで見比べたい場合は、frontmatterの`theme`キーで
ページごとに異なるテーマを指定できます(サイト全体の`THEME`設定とは別に、
1ページだけテーマを差し替える機能。詳しくは[Frontmatterリファレンス](docs/frontmatter.md#theme)を参照)。
複数のMarkdownファイルにそれぞれ違う`theme`を指定してビルドすれば、
通常の`docs-pages.yml`だけで見た目を比較できます。

## コントリビュート

コード・ドキュメントいずれの貢献も歓迎します。Tsuzuri本体(CLI・ビルドスクリプト・
テーマCSS)の開発は[`main`ブランチ](https://github.com/akilasatolu/tsuzuri/tree/main)で
行っています。このサイト(利用者向けドキュメント)は`docs`ブランチにあり、Tsuzuri自身を
使ってGitHub Pagesに公開しています。開発環境のセットアップ方法やPRの作法は
[CONTRIBUTING.md](https://github.com/akilasatolu/tsuzuri/blob/main/CONTRIBUTING.md)を参照してください。

**Help Wanted**: ドキュメントは現状すべて日本語のみです。英語版ドキュメント
の整備に協力していただける方を募集しています。

## ライセンス

[MIT License](https://github.com/akilasatolu/tsuzuri/blob/main/LICENSE)
