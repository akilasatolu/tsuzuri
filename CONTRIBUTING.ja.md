# Tsuzuri への貢献ガイド
[English](CONTRIBUTING.md) | 日本語

Tsuzuri に興味を持っていただきありがとうございます。このガイドは、プルリクエスト(PR)を送るまでの手順をまとめています。リリースなどのメンテナーの作業は [MAINTAINING.ja.md](MAINTAINING.ja.md) にあります。[行動規範](CODE_OF_CONDUCT.ja.md)も読んでください。

## どのブランチに送るか

| ブランチ | 中身 | PR を送る内容 |
|---|---|---|
| `main`(既定) | Tsuzuri 本体: CLI・ビルドスクリプト・テーマ CSS・テスト | コードの変更 |
| `docs` | Tsuzuri 自身で作った利用者向けサイト | 利用者向けドキュメント(`docs/`)の修正 |

2 つのブランチは履歴を共有しません。互いにマージしないでください。

自分のサイトを利用者向けサイトの事例のページに載せてほしいときは、Issue を開き、サイトの URL とソースの URL を書いてください。採用されたら、メンテナーが `docs` ブランチの `docs/examples.md` と `docs/examples.ja.md` に追加します。

## 準備

Node.js 20 以上が必要です。

```sh
npm ci
```

`npm install` ではなく `npm ci` を使ってください。`package-lock.json` に記録された版のとおりにインストールされます。

## 手元で試す

push しなくても、作業ツリーをそのまま実行して試せます。以下の例は、このリポジトリを `~/dev/tsuzuri` に clone し、`npm ci` 済みとします。

**サイトをビルドする。** Markdown のあるディレクトリで実行します(`git worktree add ../tsuzuri-docs docs` で `docs` ブランチを取り出すと試しやすいです)。

```sh
STYLE_DIR=~/dev/tsuzuri/styles node ~/dev/tsuzuri/.github/scripts/build-docs.mjs
```

- `STYLE_DIR` を指定すると、作業ツリーのテーマ CSS が使われます。
- GitHub Actions の外では、`.github/docs-pages.config` があれば読みます。環境変数で指定した値が優先されます(例: `THEME=nineties`)。サイトの言語は `LANGUAGES` で決まり、OS の `LANG` は使いません。
- 出力先は `_site/` です。前回のビルドが置いた目印のファイル `.tsuzuri-build` があれば、ビルドの前に中身をすべて消します。目印のないディレクトリは、消さずに上書きするだけです。

`init` 済みのディレクトリでは、`node ~/dev/tsuzuri/bin/cli.mjs preview` で、ビルドから配信と変更時の再ビルドまでまとめて試せます。

**表示する。** 生成されるリンクはサイトのルートからの絶対パスなので、`_site/index.html` をファイルとして開くとリンクが切れます。簡易サーバーで配信してください。`BASE_PATH` は指定しないでください。

```sh
python3 -m http.server --directory _site 8000
```

**`init` を試す。** 空のディレクトリで、作業ツリーの CLI を実行します(`init --update` も同じ要領で試せます)。

```sh
mkdir /tmp/tsuzuri-init-test && cd /tmp/tsuzuri-init-test
node ~/dev/tsuzuri/bin/cli.mjs
```

生成された `.github/tsuzuri/` でビルドするときは、先に、生成されたワークフローの「Install build dependency」の `npm install --prefix .github/tsuzuri ...` の行を実行してから、`node .github/tsuzuri/build-docs.mjs` を実行します。

**GitHub 上で試す。** ブランチを push し、別のテスト用リポジトリでそのブランチから `init` を実行して、GitHub Pages への公開まで確かめます。

```sh
npx github:akilasatolu/tsuzuri#<your-branch> init
```

## テストと lint

```sh
npm test
npm run lint
```

`npm test` は `node --test` を実行し、`test/` 配下のテストをすべて動かします。`npm run lint` は ESLint を実行します。PR を送る前に、どちらも通してください。

### ゴールデンテスト

`test/golden.test.mjs` は、いくつかの設定で作ったサイトの出力(HTML・CSS・スクリプトなど)を `test/fixtures/golden/` にまるごと保存しておき、今のコードの出力と 1 文字ずつ比べます。出力が**意図せず**変わったことに気づくためのテストです。

出力を**意図して**変えたとき(新しい機能・見た目の変更・文言の変更など)は、このテストが落ちます。そのときは、保存し直してください。

1. 保存し直す。

   ```sh
   UPDATE_GOLDEN=1 node --test test/golden.test.mjs
   ```

2. `git diff test/fixtures/golden/` で、意図した変更だけであることを確かめる(見た目の変更なら CSS だけ、文言の変更ならその文言だけ)。CSS の中身が変わるとファイル名(`tsuzuri-<ハッシュ>.css`)も変わるので、各ページの `<link>` の行が変わるのは正常です。
3. 保存し直した `test/fixtures/golden/` を、コードの変更と同じ PR に入れる。PR の説明に、保存し直した理由と、差分で何が変わったかを書く。

テストを通すためだけに保存し直さないでください。意図しない変化を見逃すことになります。

## リポジトリの構成

編集してよいものは次のとおりです。

- `bin/`: セットアップ CLI。`bin/cli.mjs` は、利用者が受け取る内容(ワークフロー・設定ファイル・取り込む対象)の唯一の正で、`bin/preview.mjs` は `preview` の本体です。
- `templates/`: ワークフローのひな形(`.github/workflows/docs-pages.yml`)と、利用者に配るビルド用の依存の `package.json`・`package-lock.json` の完成品。
- `.github/scripts/`: ビルド本体(`build-docs.mjs` と `lib/`)。
- `styles/`: テーマ CSS。
- `test/`: テスト。フィクスチャは `test/fixtures/` にあります。
- `scripts/`・`deps/`: 開発・CI 用の補助(利用者には配りません)。各スクリプトの先頭に説明のコメントがあります。
- `.github/workflows/`・`.github/dependabot.yml`・`.github/PULL_REQUEST_TEMPLATE.md`・`.npmrc`: このリポジトリ自身の CI・リリース・docs の同期・依存パッケージの方針・PR テンプレート。
- `README.md`・`CONTRIBUTING.md`・`MAINTAINING.md`・`CHANGELOG.md`: 開発者向けのドキュメント。

利用者向けドキュメント(`docs/`)は `docs` ブランチにあります。

`init` は `.github/scripts/` と `styles/` の中身をそのまま利用者のリポジトリへコピーするので、ここに置いたファイルは利用者に配られます。

また、`init` は**利用者の**リポジトリに `.github/workflows/docs-pages.yml`・`.github/docs-pages.config`・`.github/tsuzuri/` を生成します。これらを `main` にコミットしないでください。生成は `test/cli.test.mjs` が、ビルドは `test/build-docs.e2e.test.mjs` が検証します。

利用者に見える既知の限界(frontmatter の書式、mermaid の CDN 依存)は、ここではなく利用者向けサイトに書いてあります: [frontmatter の制限事項](https://akilasatolu.github.io/tsuzuri/ja/docs/frontmatter.html#制限事項)、[外部から読み込むファイル](https://akilasatolu.github.io/tsuzuri/ja/docs/concepts.html#外部から読み込むファイルと依存の安全性)。

## CI の動き

`.github/workflows/ci.yml` は、すべての PR と `main` への push で動きます。リポジトリを読むだけ(`contents: read`)で、GitHub Pages には触れないので、ブランチを push しても安全です。

- `lint-and-test`: Node.js 20・22・24 で `npm run lint` と `npm test` を実行し、依存の署名も確認する。
- `actionlint`: ワークフローの静的チェック。`init` が生成するワークフローも含む。
- `verify-cdn`: 生成ページが読み込む mermaid のファイルのハッシュを確認する。
- `package-check`: パッケージにまとめた中身から、`init`・インストール・ビルド・`init --update` を通す(`scripts/check-package.mjs`)。

`docs` ブランチの同期とリリースはメンテナーが行います。[MAINTAINING.ja.md](MAINTAINING.ja.md) を見てください。

## PR を送る

- 変更は小さく分けてください。1 つの PR に複数の関心事を混ぜないでください。
- `npm test` と `npm run lint` が通ることを確認してください。
- 「何を」「なぜ」変更したかを書いてください。既存の挙動を変えるときは、理由と影響範囲も書いてください。
- `test/fixtures/golden/` を保存し直したときは、その理由と、差分で何が変わったかを書いてください([ゴールデンテスト](#ゴールデンテスト)を参照)。
- `CHANGELOG.md` は書かなくてかまいません。リリースのときにメンテナーがまとめて書きます。
- 依存パッケージの版は、PR で変えないでください。更新が必要だと思ったら、先に Issue で相談してください。メンテナーと Dependabot が更新します([MAINTAINING.ja.md](MAINTAINING.ja.md) を参照)。
- Tsuzuri は MIT ライセンスで公開されています。**PR を送ることで、その変更を MIT ライセンスの下で提供することに同意したものとみなします。**
