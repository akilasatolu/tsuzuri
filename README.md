# Tsuzuri — 開発者向けREADME

[![CI](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml)

このブランチ(`main`)は、Tsuzuri本体(セットアップCLI・ビルドスクリプト・テーマCSS)の
開発ブランチです。利用者が実行する`init`コマンドも、このブランチからファイルを取得します。

Tsuzuriの使い方(利用者向けの説明)は、`docs`ブランチの
[README](https://github.com/akilasatolu/tsuzuri/blob/docs/README.md)と
[ドキュメント](https://github.com/akilasatolu/tsuzuri/tree/docs/docs)を参照してください。

## ブランチ運用

| ブランチ | 役割 | 中身 |
|---|---|---|
| `main`(既定ブランチ) | Tsuzuri本体の開発。`npx github:akilasatolu/tsuzuri init`の取得元 | CLI・ビルドスクリプト・テーマCSS・テスト・開発者向けドキュメント、GitHub用テンプレート類 |
| `docs` | Tsuzuri自身を使って作った、利用者向けのサイト(GitHub Pagesで公開) | 利用者向けREADME・`docs/`・`assets/`と、`init`で生成したワークフロー一式 |

- 2つのブランチは履歴を共有しない独立したブランチです。**`main`と`docs`を互いにマージしないでください**。
- 本体の変更は`main`へのPRで行います。
- `docs`の`.github/tsuzuri/`配下は、利用者と同じ手順(`init`の再実行)で更新します。直接編集しないでください。
- 利用者向けドキュメント(`docs`ブランチの`docs/`)の修正は、`docs`へのPRで行います。

### `docs`ブランチの公開設定(リポジトリ作成時に1回だけ)

`docs`ブランチは`TRIGGER_BRANCH=docs`で公開しています。既定ブランチ(`main`)以外からの
デプロイになるため、GitHub側で次の設定が必要です。

1. `Settings > Pages`の`Source`を`GitHub Actions`にする(`github-pages`環境が作成される)
2. `Settings > Environments > github-pages`の`Deployment branches and tags`に`docs`を追加する

2を忘れると、デプロイジョブが`Branch "docs" is not allowed to deploy to github-pages due to
environment protection rules.`で失敗します。また、`docs-pages.yml`は`docs`ブランチにしか
ないため、Actionsタブの手動実行(Run workflow)ボタンは表示されません。`docs`への
pushでデプロイしてください。

## 開発環境のセットアップ

Node.js 20以上が必要です。

```sh
npm ci
```

## よく使うコマンド

```sh
npm test       # node --test で test/ 配下を全件実行
npm run lint   # ESLint
```

ローカルでビルドを試す場合は、ビルド対象のMarkdownがあるディレクトリで次のように実行します
(出力先は`_site/`)。

```sh
STYLE_DIR=/path/to/tsuzuri/styles NAV_ENABLED=false THEME=wa node /path/to/tsuzuri/.github/scripts/build-docs.mjs
```

`init`の動作確認は、テスト用の空ディレクトリで`node /path/to/tsuzuri/bin/cli.mjs`を実行します。

## ディレクトリ構成

```
bin/cli.mjs                 セットアップCLI(init)。生成するワークフロー・設定ファイルのテンプレートもここ
.github/scripts/
  build-docs.mjs            ビルドのエントリーポイント
  lib/*.mjs                 config / crawler / frontmatter / link-extractor / path-utils / html-renderer / sitemap
styles/*.css                テーマCSSの原本(base + wa / muji / sumi / ai / shu)
test/                       単体テスト・E2Eテスト(test/fixtures/ にフィクスチャ)
.github/workflows/ci.yml    lint・testのみを行う開発用CI(Pagesへのデプロイはしない)
```

`init`は`.github/scripts/`と`styles/`の中身を、利用者リポジトリの`.github/tsuzuri/`配下へ
そのままコピーします。ここに置いたファイルはそのまま利用者に配布される点に注意してください。

## リリース

`v1`などのタグは`main`ブランチのコミットに付けます。利用者は
`npx github:akilasatolu/tsuzuri#v1 init`のようにタグを指定して実行できます。
リリース前の確認項目は[CONTRIBUTING.md](CONTRIBUTING.md)の「リリース前チェックリスト」を、
変更履歴は[CHANGELOG.md](CHANGELOG.md)を参照してください。

## コントリビュート

PRの作法・既知の限界などは[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

[MIT License](LICENSE)
