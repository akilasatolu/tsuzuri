# Getting Started

## 前提条件

- 対象がGitHubリポジトリであること(GitHub Pagesを使うため)。
- Node.jsやgit等をローカルに常設インストールしておく必要は基本的にありません。
  セットアップコマンド(`npx ...`)の実行にはNode.js(npx)が必要ですが、これは
  一時的に実行されるだけで、プロジェクトへの恒久的なインストールは発生しません。
- ビルド・デプロイ自体はGitHub Actions上で実行されるため、利用者のローカル環境に
  Node.jsをインストールしていなくてもデプロイは可能です(セットアップコマンドの
  実行時のみNode.jsが必要です)。

## インストール

リポジトリのルートで、次のコマンドを実行します。

```
npx github:akilasatolu/tsuzuri init
```

実行すると、トリガーブランチ・起点となるMarkdownファイル・テーマ・独自CSSひな形の
要否について、4つの質問が対話形式で表示されます。すべてEnterキーだけで既定値
(`main`ブランチ・`README.md`・和テーマ・ひな形は作らない)を選ぶこともできます。
対話フローの詳細は[cli.md](./cli.md)を参照してください。

このコマンドにより、ワークフロー・設定ファイルに加えて、ビルドスクリプト本体一式が
リポジトリに生成されます。

- `.github/workflows/docs-pages.yml`
- `.github/docs-pages.config`
- `.github/tsuzuri/`(ビルドスクリプト本体一式。`build-docs.mjs`・`lib/*.mjs`・`styles/*.css`)
- (任意)`.github/tsuzuri/styles/custom.css`(組み込みテーマCSSと同じディレクトリに置かれる独自CSSひな形)

ビルドスクリプト本体もリポジトリにコピーされるため、生成後のワークフローは実行のたびに
OSS本体リポジトリ(tsuzuri)を参照することなく、このリポジトリの中だけでビルド・
デプロイが完結します。詳しくは[デプロイ設定(deployment.md)](./deployment.md)を
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
必要があります。手順は[デプロイ設定](./deployment.md)の「既定ブランチ以外を
トリガーブランチにする場合」を参照してください。

## 初回デプロイ

生成されたファイル一式をコミットし、`.github/docs-pages.config`の`TRIGGER_BRANCH`
(デフォルト`main`)へpushしてください。pushが完了すると、GitHub Actionsのワークフローが
自動的に起動します。

リポジトリの `Actions` タブを開くと、`Deploy Docs to GitHub Pages`という名前の
ワークフロー実行が表示されます。緑のチェックマークが付けば成功です。
`Settings > Pages`のページに表示されるURLから、生成されたサイトを確認できます
(反映まで数分かかる場合があります)。

## 次のステップ

- サイトがどのように組み立てられているかを知りたい場合は[仕組み(concepts.md)](./concepts.md)
- 設定できる項目の一覧は[設定リファレンス(configuration.md)](./configuration.md)
- 見た目(配色・装飾)を変えたい場合は[テーマ・スタイル(theming.md)](./theming.md)
