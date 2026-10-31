---
title: CLIリファレンス
description: initとpreviewのオプション、initの質問、生成されるファイル
order: 30
---

# CLIリファレンス

このページでは、セットアップ用コマンド([`bin/cli.mjs`](https://github.com/akilasatolu/tsuzuri/blob/main/bin/cli.mjs))の使い方をまとめます。
コマンド1つで、GitHub Pagesへの自動デプロイに必要なワークフロー・設定ファイルに加えて、
ビルドスクリプト本体一式(`.github/tsuzuri/`配下)を、対話形式の質問に答えるだけで
利用者リポジトリにコピーできます。生成後は、実行のたびにOSS本体リポジトリ
(`akilasatolu/tsuzuri`)を参照することなく、利用者リポジトリの中だけでビルド・
デプロイが完結します。

## 実行方法

利用者リポジトリのルートで次のコマンドを実行します(事前に`npm install`等は不要です)。

```
npx github:akilasatolu/tsuzuri#v1 init
```

`npx`はNode.jsに付属するコマンドで、パッケージをローカルにインストールせずに一時的に取得して
実行できる仕組みです(Node.js 20以上が必要です)。サブコマンドは、セットアップの`init`(省略可)と、
手元でサイトを確認する[`preview`](#手元で確認するpreview)の2つです。

実行すると、最初に`tsuzuri v1.0.0`のように、実際に動いているtsuzuriのバージョンが表示されます。
意図したバージョンか確認してください(`npx`のキャッシュで古いバージョンが動くことがあるため)。

## オプション

| オプション | 内容 |
|---|---|
| (なし) | 対話形式で質問に答えながら生成する(次の「対話フロー」) |
| `--update` | 対話なしで最新版に更新する([後述](../guides/update.ja.md#最新版に更新する--update)) |
| `-y`, `--yes` | 対話なしで、すべて既定値で生成する |
| `--branch <名前>` | トリガーブランチ(`TRIGGER_BRANCH`)。既定: リポジトリの既定ブランチ(`origin`の既定ブランチ。分からなければ`main`) |
| `--root <パス>` | 起点となるMarkdownファイル(`ROOT_MD`)。既定: `README.md` |
| `--lang <en\|ja>` | 表示するメッセージと、生成する設定ファイルのコメントの言語。既定: `en`。質問は省略しない |
| `--force` | 対話なしのとき、既存ファイルも上書きする |
| `--port <番号>` | `preview`で使うポート番号。既定: `4000` |
| `--no-watch` | `preview`で、ファイルの変更を見張らない(自動でビルドし直さない) |
| `--open` | `preview`で、起動したらブラウザでサイトを開く |
| `-v`, `--version` | バージョンを表示する |
| `-h`, `--help` | 使い方を表示する |

`--yes`・`--branch`・`--root`のいずれかを付けると、質問せずに生成します
(スクリプトやCIから実行する場合に使えます)。このとき、既に存在するファイルは上書きせずに
スキップします。上書きしたい場合は`--force`を付けてください。設定ファイル`.github/tsuzuri/config`も上書きされます(設定が、生成される内容に置き換わります)。`.github/tsuzuri/styles/`に自分で置いたカスタムスタイルは、`init`が作るものではないので、上書きされません。

```
npx github:akilasatolu/tsuzuri#v1 init --yes --branch docs
```

`init`と`preview`のメッセージは英語で表示されます。日本語で
表示したいときは、`npx github:akilasatolu/tsuzuri#v1 init --lang ja`のように、コマンドに`--lang ja`を付けます。
`init`が作る設定ファイルのコメントも日本語になります。値は`en`と`ja`(小文字)だけで、
付けたコマンドのときだけ有効です。サイトの言語(`LANGUAGES`。[設定リファレンス](./configuration.ja.md#languages)参照)とは別のものです。
`init`が生成するワークフローと`.gitignore`は、常に英語です。

知らないオプションを指定した場合はエラーになり、何も生成しません。

## 手元で確認する(`preview`)

pushする前に、公開時と同じ設定でサイトを手元にビルドして、ブラウザで確認できます。
`init`済みのリポジトリの直下で実行します。

```
npx github:akilasatolu/tsuzuri#v1 preview
```

1. ビルド用の依存が`.github/tsuzuri/node_modules/`に無ければ、ワークフローと同じく
   `.github/tsuzuri/package-lock.json`のとおりにインストールします(`init`が作る`.github/tsuzuri/.gitignore`で
   コミットの対象外になっています)。
2. `.github/tsuzuri/`のビルドスクリプトで、`.github/tsuzuri/config`の設定どおりにビルドします
   (リンク切れなどの警告もここに表示されます)。
3. 出力先(`OUT_DIR`、既定は`_site/`)を`http://localhost:4000/`で配信します。
4. ファイルを保存すると、自動でビルドし直して、開いているページを再読み込みします。

`--open`を付けると、起動したときにブラウザでサイトを開きます。
ポートが使用中の場合は、`--port 4001`のように別の番号を指定してください。自動でビルドし直したくない場合は
`--no-watch`を付けます。終了するには`Ctrl+C`を押します。

ビルドには、リポジトリにコピー済みのビルドスクリプトを使います(公開時と同じ結果にするため)。
コピー済みのバージョンと`npx`で実行したバージョンが違う場合は、その旨を表示します。最新にするには
`init --update`を実行してください。

## 実行する場所の確認

`init`は、ワークフローを`.github/workflows/`に生成します。GitHubはリポジトリの直下にある
`.github/workflows/`のワークフローしか動かさないため、リポジトリの直下以外(サブディレクトリなど)や
gitリポジトリではない場所で実行すると、警告を表示します。対話形式では続けるかどうかを確認します。
また、起点のMarkdown(`ROOT_MD`)がまだ無い場合も、作成を促す警告を表示します。

## 対話フロー

実行すると、次の質問に順番に答えます(すべてEnterキーだけで既定値を選べます)。

1. **トリガーブランチ(`TRIGGER_BRANCH`)** `[main]`
   - デプロイを実行するブランチ名を聞かれます。空欄のまま(未入力で)Enterを押すと、かっこ内の既定値に
     なります。既定値は、リポジトリの既定ブランチ(`origin`の`HEAD`)、分からなければ今のブランチ、
     それも分からなければ`main`です。
2. **起点となるMarkdownファイル(`ROOT_MD`)** `[README.md]`
   - サイトの入り口となるMarkdownファイルのパスです。未入力なら`README.md`になります。

質問は以上の2つです。ナビ・言語・サイト名・見た目についての質問はありません。
`init`は、設定ファイルに`NAV_ENABLED=true`・`LANGUAGES=en`・`SITE_NAME=`(空。ビルド時にリポジトリ名になる)を書き、
`THEME=default.css`(パッケージに入っている標準のカスタムスタイル)で始めます。変えたいときは、`init`の後に
`.github/tsuzuri/config`を編集します。READMEが日本語なら`LANGUAGES=ja`([多言語サイト](../guides/multilingual.ja.md)参照)、
サイト名を決めるなら`SITE_NAME`、ナビを出さないなら`NAV_ENABLED=false`です。ほかのカスタムスタイルを使うときは、
[ギャラリー](../../gallery/README.ja.md)でダウンロードして、そのファイル名を`THEME`に書きます([見た目を変える](../guides/style.ja.md)参照)。

## 生成されるファイル

質問への回答をもとに、以下のファイルが生成されます。

| ファイル | 常に生成されるか | 内容 |
|---|---|---|
| `.github/workflows/tsuzuri-pages.yml` | 常に生成 | ビルド・デプロイの手順を直接持つ、自己完結型のワークフロー |
| `.github/tsuzuri/config` | 常に生成 | `TRIGGER_BRANCH`/`ROOT_MD`は回答内容を反映し、それ以外のキー(`THEME=default.css`を含む)は既定値で出力される設定ファイル。利用者が編集するファイル |
| `.github/tsuzuri/build-docs.mjs` | 常に生成 | ビルド本体のスクリプト(OSS本体リポジトリの`.github/scripts/build-docs.mjs`と同一内容) |
| `.github/tsuzuri/lib/*.mjs` | 常に生成 | ビルド本体が依存するモジュール一式(config/copy-button/crawler/emoji/emoji-data/frontmatter/html-renderer/i18n/image-size/link-extractor/llms-txt/path-utils/search/site-tree/sitemap/slugger/theme-toggle の17ファイル) |
| `.github/tsuzuri/styles/base.css`・`default.css` | 常に生成 | ベースCSS(`base.css`)と、標準のカスタムスタイル(`default.css`)。置かれるのはこの2つだけで、ほかのカスタムスタイルは配布せず、[ギャラリー](../../gallery/README.ja.md)でダウンロードして使う |
| `.github/tsuzuri/package.json`・`package-lock.json` | 常に生成 | ビルド用の依存(marked など)の版と、ダウンロードした中身を確かめるハッシュ。ワークフローと`preview`はこのとおりに`npm ci`でインストールする |
| `.github/tsuzuri/.gitignore` | 常に生成 | 手元でプレビューするときにインストールする依存(`node_modules/`)をコミットしないための設定 |

`.github/tsuzuri/`配下で編集してよいのは、設定ファイル`config`と、`styles/`に置く自分のカスタムスタイル
だけです。`base.css`・`default.css`とスクリプトは、`build-docs.mjs`実行時に
読み込まれる「ビルドスクリプト本体そのもの」なので、編集しないでください(削除・改変すると
ビルドが失敗することがあります)。スクリプトを最新版に更新したい場合は、
後述の「最新版に更新する(`--update`)」を参照してください。

生成される設定ファイルでは、サイトの言語は常に次のように書かれます(`init`は言語を聞きません。READMEが日本語なら、あとで`LANGUAGES=ja`に直します)。コメントは英語です
(`--lang ja`を付けると日本語になります)。

```
# Site languages, comma-separated; the first is the base language (the language of the starting README). Examples: ja / en / ja,en
# With one language you get a single-language site (<html lang="..."> and the interface text use that language).
# With two or more you get a multilingual site (how to place pages: https://akilasatolu.github.io/tsuzuri/docs/guides/multilingual.html). If empty, it is en.
LANGUAGES=en
```

生成されるキーの一覧・意味は[設定リファレンス](./configuration.ja.md)を参照してください。

## 既存プロジェクトへの導入

既にこれらのファイルが存在するリポジトリで実行しても安全なように、既存のファイルが見つかった
場合は上書きするかどうかを確認します。

- **ワークフローとビルドスクリプト一式**(`tsuzuri-pages.yml`と、`.github/tsuzuri/`配下の
  `config`を除くファイル)は、同じバージョンでそろっていないと動かないため、
  最初に1回だけまとめて確認します。

  ```
  The workflow and the build scripts (under .github/tsuzuri/, except config) already exist. Overwrite them with the latest version? (y/N):
  ```

  (`--lang ja`のときは、日本語で表示されます:
  `ワークフローとビルドスクリプト一式(.github/tsuzuri/ 配下。config を除く)は既に存在します。最新版で上書きしますか? (y/N):`)

- **設定ファイル**(`.github/tsuzuri/config`)は、ファイルごとに確認します。

  ```
  .github/tsuzuri/config already exists. Overwrite it? (y/N):
  ```

  (`--lang ja`のときは、`.github/tsuzuri/config は既に存在します。上書きしますか? (y/N):`と表示されます)

「n」(または未入力)を選んだファイルはスキップされ、既存の内容がそのまま保持されます。
ワークフローとスクリプトだけを最新版にしたい場合は、次の`--update`を使うと確認なしで行えます。

## 更新とバージョンの固定

最新版への更新(`--update`)と、バージョンの固定(`#v1`・`#v1.2.0`)は、[更新する](../guides/update.ja.md)を見てください。
