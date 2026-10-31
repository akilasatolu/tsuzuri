---
title: はじめる
description: READMEをGitHub Pagesのサイトとして公開する3つの手順: initを実行し、Pagesを設定し、pushする
order: 10
---

# はじめる

READMEをサイトとして公開するには、3つの手順です。`init`を実行し、GitHub PagesのSourceをGitHub Actionsにして(最初の1回だけ)、pushします。[このサイト](../README.ja.md)も、まさにこの手順で公開しています。

## 前提条件

- 対象がGitHubリポジトリであること(GitHub Pagesを使うため)。
- Node.jsやgit等をローカルに常設インストールしておく必要は基本的にありません。
  セットアップコマンド(`npx ...`)の実行にはNode.js 20以上(npx)が必要ですが、これは
  一時的に実行されるだけで、プロジェクトへの恒久的なインストールは発生しません。
- ビルド・デプロイ自体はGitHub Actions上で実行されるため、利用者のローカル環境に
  Node.jsをインストールしていなくてもデプロイは可能です(セットアップコマンドの
  実行時のみNode.jsが必要です)。

## インストール

リポジトリのルートで、次のコマンドを実行します。

```
npx github:akilasatolu/tsuzuri#v1 init
```

実行すると、トリガーブランチと起点となるMarkdownファイルについて、2つの質問が対話形式で表示されます。
すべてEnterキーだけで既定値(リポジトリの既定ブランチと`README.md`)を選ぶこともできます。
ナビの表示・サイトの言語・サイト名は質問されません。`init`は`NAV_ENABLED=true`・`LANGUAGES=en`・空の`SITE_NAME`
(リポジトリ名になります)を書き、設定ファイルは、パッケージに入っている標準のカスタムスタイル
`THEME=default.css`で始まります。READMEが日本語なら、`init`の後に`.github/tsuzuri/config`の
`LANGUAGES`を直してください(例: `LANGUAGES=ja`)。
対話フローの詳細は[cli.md](./reference/cli.ja.md)を参照してください。

このコマンドにより、ワークフロー・設定ファイルに加えて、ビルドスクリプト本体一式が
リポジトリに生成されます。

- `.github/workflows/tsuzuri-pages.yml`
- `.github/tsuzuri/`(利用者が編集する設定ファイル`config`と、ビルドスクリプト本体一式。`build-docs.mjs`・`lib/*.mjs`・`styles/base.css`と`styles/default.css`、ビルド用の依存を固定する`package.json`・`package-lock.json`、`.gitignore`)

`.github/tsuzuri/`配下で編集してよいのは、設定ファイル`config`と、`styles/`に置く自分のカスタムスタイル
だけです。`base.css`・`default.css`・スクリプトは編集しないでください。ほかの見た目にしたいときは、
[ギャラリー](../gallery/README.ja.md)でカスタムスタイルをダウンロードして`styles/`に置き、`THEME`に指定します
([見た目を変える](./guides/style.ja.md)参照)。

ビルドスクリプト本体もリポジトリにコピーされるため、生成後のワークフローは実行のたびに
OSS本体リポジトリ(tsuzuri)を参照することなく、このリポジトリの中だけでビルド・
デプロイが完結します。詳しくは[公開の設定](./guides/publish.ja.md)を
参照してください。

## GitHub Pagesの設定

生成されたファイルをコミットする前後どちらでも構いませんが、GitHubリポジトリの
設定画面で、GitHub Pagesのソースを切り替える必要があります(最初の1回だけ)。

1. リポジトリの `Settings` タブを開く
2. 左メニューの `Pages` を選ぶ
3. `Build and deployment` の `Source` を `GitHub Actions` に変更する

この設定をしていないと、ワークフロー自体は正常に実行されても、実際のPagesへの公開が
行われません。

`TRIGGER_BRANCH`に既定ブランチ(通常は`main`)以外のブランチを指定した場合は、
さらに`Settings > Environments > github-pages`でそのブランチからのデプロイを許可する
必要があります。手順は[公開の設定](./guides/publish.ja.md)の「既定ブランチ以外を
トリガーブランチにする場合」を参照してください。

## 初回デプロイ

生成されたファイル一式をコミットし、`.github/tsuzuri/config`の`TRIGGER_BRANCH`
(省略した場合は、リポジトリの既定ブランチ。通常は`main`)へpushしてください。pushが完了すると、GitHub Actionsのワークフローが
自動的に起動します。

リポジトリの `Actions` タブを開くと、`Tsuzuri: Deploy to GitHub Pages`という名前の
ワークフロー実行が表示されます。緑のチェックマークが付けば成功です。
`Settings > Pages`のページに表示されるURLから、生成されたサイトを確認できます
(反映まで数分かかる場合があります)。

pushする前に、自分のパソコンでサイトを確認することもできます。[公開前にローカルで確認する](./preview.ja.md)を見てください。

## 次のステップ

- [ギャラリー](../gallery/README.ja.md)で見た目を選び、`THEME`に指定します([見た目を変える](./guides/style.ja.md)参照)。
- READMEからリンクを足して、ページを増やします([ページを書く](./guides/write-pages.ja.md)参照)。
- AIエージェントに任せるなら、[AIエージェント向けの参考情報](./ai-reference.ja.md)を貼り付けます。
