# Tsuzuri — 開発者向けREADME

[![CI](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml)

このブランチ(`main`)は、Tsuzuri本体(セットアップCLI・ビルドスクリプト・テーマCSS)の
開発ブランチです。利用者が実行する`init`コマンドも、このブランチからファイルを取得します。

**Tsuzuriの使い方(利用者向けドキュメント)は、こちらのサイトを参照してください:
https://akilasatolu.github.io/tsuzuri/**

このサイトは`docs`ブランチの内容をTsuzuri自身でビルドして公開しています。

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

`init`の動作確認は下の「開発中のTsuzuriをローカルで試す」を参照してください。

## 開発中のTsuzuriをローカルで試す

pushしなくても、手元の`main`ブランチの作業ツリーをそのまま使って動作確認できます。
以下の例では、Tsuzuriのリポジトリを`~/dev/tsuzuri`にcloneし、`npm ci`済みとします。

### 1. 手元のサイトでビルドする(いちばん手軽)

ビルドスクリプトは、Tsuzuriの作業ツリーにあるものを直接実行できます。`marked`は
Tsuzuri側の`node_modules`から読み込まれるので、ビルド対象のディレクトリに
インストールする必要はありません。

`docs`ブランチ(このリポジトリ自身のサイト)で試す場合は、worktreeで別ディレクトリに
取り出すと、`main`と並べて作業できます。

```sh
git worktree add ../tsuzuri-docs docs
cd ../tsuzuri-docs
```

ビルド対象のディレクトリ(任意のMarkdownのフォルダでも可)で、次のように実行します。
設定ファイルの値は環境変数で渡します(ワークフローが行っている処理と同じです)。

```sh
STYLE_DIR=~/dev/tsuzuri/styles NAV_ENABLED=true SITE_NAME=Tsuzuri \
  node ~/dev/tsuzuri/.github/scripts/build-docs.mjs
```

- `STYLE_DIR`は必須です(テーマCSSの置き場所。`init`後の構成では`.github/tsuzuri/styles`)。
- それ以外のキー(`ROOT_MD`・`THEME`・`LANG`など)は省略すると既定値になります。
- 出力先は`_site/`です(`OUT_DIR`で変更可)。

### 2. ブラウザで確認する

生成されるリンクはサイトのルートからの絶対パス(`/docs/cli.html`など)なので、
`_site/index.html`をファイルとして直接開くとリンクが切れます。簡易サーバーで配信してください。

```sh
python3 -m http.server --directory _site 8000
```

`http://localhost:8000/`を開きます。`BASE_PATH`は指定しないでください
(本番の`/tsuzuri`のようなパスを付けると、ローカルではリンクが切れます)。

### 3. `init`を試す

テスト用の空ディレクトリで、作業ツリーのCLIを直接実行します。

```sh
mkdir /tmp/tsuzuri-init-test && cd /tmp/tsuzuri-init-test
node ~/dev/tsuzuri/bin/cli.mjs
```

生成された`.github/tsuzuri/`を使ってビルドする場合は、1と同じ要領で
`STYLE_DIR=.github/tsuzuri/styles node .github/tsuzuri/build-docs.mjs`を実行します。
このときは`marked`がこのディレクトリから読み込まれるため、先に
`npm install --no-save marked@<package.jsonのmarkedと同じバージョン>`を実行してください。

### 4. GitHub上で本番と同じ流れを試す

作業ブランチをpushすれば、`npx`でそのブランチを指定して`init`できます。
テスト用の別リポジトリで実行し、GitHub Pagesへの公開まで確認してください。

```sh
npx github:akilasatolu/tsuzuri#<作業ブランチ名> init
```

## ディレクトリ構成

```
bin/cli.mjs                 セットアップCLI(init)。生成するワークフロー・設定ファイルのテンプレートもここ
.github/scripts/
  build-docs.mjs            ビルドのエントリーポイント
  lib/*.mjs                 config / crawler / frontmatter / link-extractor / path-utils / html-renderer / site-tree / sitemap
styles/*.css                テーマCSSの原本(base + wa / muji / sumi / ai / shu)
test/                       単体テスト・E2Eテスト(test/fixtures/ にフィクスチャ)
.github/workflows/ci.yml    lint・testのみを行う開発用CI(Pagesへのデプロイはしない)
```

`init`は`.github/scripts/`と`styles/`の中身を、利用者リポジトリの`.github/tsuzuri/`配下へ
そのままコピーします。ここに置いたファイルはそのまま利用者に配布される点に注意してください。

## 依存パッケージの更新

Dependabotが週1回、`package.json`の依存パッケージと`ci.yml`のGitHub Actionsの更新PRを作ります。

`marked`は、利用者側のワークフローでも使うビルド用の依存です。`init`が生成するワークフローは
`package.json`の`devDependencies.marked`の版をそのまま埋め込むため、`marked`の更新PRを
マージすれば、テストで使う版と利用者に配る版が一緒に更新されます。このため`marked`の版は
`^`などの範囲ではなく`12.0.2`のような完全一致で書いてください(範囲指定だと`init`がエラーになります)。

なお、生成ワークフロー内のGitHub Actions(`actions/upload-pages-artifact`など)の版は
`bin/cli.mjs`に直接書かれており、Dependabotの対象外です。更新する場合は手で書き換えてください。

## リリース

`v1`などのタグは`main`ブランチのコミットに付けます。利用者は
`npx github:akilasatolu/tsuzuri#v1 init`のようにタグを指定して実行できます。
リリース前の確認項目は[CONTRIBUTING.md](CONTRIBUTING.md)の「リリース前チェックリスト」を、
変更履歴は[CHANGELOG.md](CHANGELOG.md)を参照してください。

## コントリビュート

PRの作法・既知の限界などは[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

[MIT License](LICENSE)
