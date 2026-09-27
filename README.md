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
- `docs`の`.github/tsuzuri/`配下とワークフローは、`main`のCIが成功するたびに自動で更新されます(下の「`docs`ブランチへの自動反映」)。直接編集しないでください。
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

### `docs`ブランチへの自動反映

`main`へのpushでCI(lint・test)が成功すると、`.github/workflows/sync-docs.yml`が
そのコミットのTsuzuriで`docs`ブランチに`init --update`を実行し、変更があれば`docs`へ
pushします。そのpushで`docs`の`docs-pages.yml`が動き、サイトが公開し直されます。

```
mainへpush → CI成功 → sync-docs.yml → docsへpush → docs-pages.yml → GitHub Pages
```

- 更新されるのは`docs`の`.github/workflows/docs-pages.yml`と`.github/tsuzuri/`配下だけです。
  `.github/docs-pages.config`・独自CSS・README・`docs/`は変更されません。
- CIが失敗したときや、PRのCIでは動きません。反映する変更が無いときはコミットしません。
- `docs`への手動のpushと重なった場合は、手元で`git pull --rebase`してからpushし直してください。

#### デプロイキーの登録(リポジトリ作成時に1回だけ)

`docs`へのpushには、書き込み権限付きのデプロイキーを使います。GitHub Actionsの既定の
`GITHUB_TOKEN`でpushすると、そのpushでは`docs-pages.yml`が起動せず、サイトが更新されないためです。

1. 手元で鍵ペアを作る(パスフレーズなし)

   ```sh
   ssh-keygen -t ed25519 -C "tsuzuri docs sync" -N "" -f tsuzuri_docs_deploy_key
   ```

2. 公開鍵を登録する: `Settings > Deploy keys > Add deploy key`
   - Title: `docs sync`(任意)
   - Key: `tsuzuri_docs_deploy_key.pub`の中身
   - **`Allow write access`にチェックを入れる**
3. 秘密鍵をSecretに登録する: `Settings > Secrets and variables > Actions > New repository secret`
   - Name: `DOCS_DEPLOY_KEY`
   - Secret: `tsuzuri_docs_deploy_key`(`.pub`ではない方)の中身
4. 手元の鍵ファイルを削除する

   ```sh
   rm tsuzuri_docs_deploy_key tsuzuri_docs_deploy_key.pub
   ```

登録していない場合、`sync-docs.yml`は`docs`のcheckoutで失敗します(`main`のCIや
公開済みのサイトには影響しません)。

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

既存の構成を最新化する更新モード(`node ~/dev/tsuzuri/bin/cli.mjs init --update`)も
同じ要領で試せます。

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
  lib/*.mjs                 config / crawler / frontmatter / link-extractor / path-utils / html-renderer / site-tree / slugger / sitemap
styles/*.css                テーマCSSの原本(base + wa / muji / sumi / ai / shu)
templates/.github/workflows/docs-pages.yml  initが生成するワークフローのひな形
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

`init`が生成するワークフローは、`templates/.github/workflows/docs-pages.yml`のひな形から作られます
(`bin/cli.mjs`がプレースホルダーを置き換えて出力)。ひな形の中のGitHub Actionsも
Dependabotの更新対象に含めています。本体のCI(`ci.yml`・`sync-docs.yml`)とひな形で
同じactionの版がずれるとテストが失敗するので、片方だけ更新された場合はもう片方も合わせてください。

## リリース

`v1`などのタグは`main`ブランチのコミットに付けます。利用者は
`npx github:akilasatolu/tsuzuri#v1 init`のようにタグを指定して実行できます。
リリース前の確認項目は[CONTRIBUTING.md](CONTRIBUTING.md)の「リリース前チェックリスト」を、
変更履歴は[CHANGELOG.md](CHANGELOG.md)を参照してください。

## コントリビュート

PRの作法・既知の限界などは[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

[MIT License](LICENSE)
