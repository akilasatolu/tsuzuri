# CLIリファレンス

このページでは、セットアップ用コマンド(`developブランチ`の[`bin/cli.mjs`](https://github.com/akilasatolu/tsuzuri/blob/develop/bin/cli.mjs))の使い方をまとめます。
コマンド1つで、GitHub Pagesへの自動デプロイに必要なワークフロー・設定ファイルに加えて、
ビルドスクリプト本体一式(`.github/tsuzuri/`配下)を、対話形式の質問に答えるだけで
利用者リポジトリにコピーできます。生成後は、実行のたびにOSS本体リポジトリ
(`akilasatolu/tsuzuri`)を参照することなく、利用者リポジトリの中だけでビルド・
デプロイが完結します。

## 実行方法

利用者リポジトリのルートで次のコマンドを実行します(事前に`npm install`等は不要です)。

```
npx github:akilasatolu/tsuzuri#develop init
```

`npx`はNode.jsに付属するコマンドで、パッケージをローカルにインストールせずに一時的に取得して
実行できる仕組みです。`init`は将来のサブコマンド追加に備えた名前ですが、v1時点では省略しても
(引数を何も付けずに実行しても)常にinit相当の動作になります。

## 対話フロー

実行すると、次の4つの質問に順番に答えます(すべてEnterキーだけで既定値を選べます)。

1. **トリガーブランチ(`TRIGGER_BRANCH`)** `[main]`
   - デプロイを実行するブランチ名を聞かれます。空欄のまま(未入力で)Enterを押すと`main`になります。
2. **起点となるMarkdownファイル(`ROOT_MD`)** `[README.md]`
   - サイトの入り口となるMarkdownファイルのパスです。未入力なら`README.md`になります。
3. **テーマ(`THEME`)の選択**
   - `wa`(和・推奨)/`muji`(無地)/`sumi`(墨)/`ai`(藍)/`shu`(朱)/`none`(装飾なし)の
     6択が番号(1〜6)付きで表示されるので、番号を入力します。未入力なら`1`(`wa`)になります。
   - テーマの見た目の詳細は[theming.md](./theming.md)を参照してください。
4. **独自CSSのひな形ファイルを作成するか(y/N)**
   - `.github/tsuzuri/styles/custom.css`という、コメントだけが書かれた空のCSSファイルを
     作るかどうかを聞かれます。組み込みテーマCSS一式と同じディレクトリに置かれるため、
     既存テーマのCSSを参考にしながら書けます。未入力(または`n`)なら作成しません。

## 生成されるファイル

質問への回答をもとに、以下のファイルが生成されます。

| ファイル | 常に生成されるか | 内容 |
|---|---|---|
| `.github/workflows/docs-pages.yml` | 常に生成 | ビルド・デプロイの手順を直接持つ、自己完結型のワークフロー(以前のように`build.yml`を`uses:`で呼び出すことはしない) |
| `.github/docs-pages.config` | 常に生成 | `TRIGGER_BRANCH`/`ROOT_MD`/`THEME`は回答内容を反映し、それ以外のキーは既定値で出力される設定ファイル |
| `.github/tsuzuri/build-docs.mjs` | 常に生成 | ビルド本体のスクリプト(OSS本体リポジトリの`.github/scripts/build-docs.mjs`と同一内容) |
| `.github/tsuzuri/lib/*.mjs` | 常に生成 | ビルド本体が依存するモジュール一式(config/crawler/frontmatter/html-renderer/link-extractor/path-utils/sitemap) |
| `.github/tsuzuri/styles/*.css` | 常に生成 | 組み込み6テーマ(`base.css`+`wa`/`muji`/`sumi`/`ai`/`shu`)のCSS一式。frontmatterの`theme`キー([参照](./frontmatter.md#theme))で選択中以外のテーマを使う場合に備え、常に全テーマ分コピーされる |
| `.github/tsuzuri/styles/custom.css` | 質問4で「y」と答えた場合のみ | コメントのみの空の独自CSSひな形。組み込みテーマCSSと同じディレクトリに置かれる |

`.github/tsuzuri/`配下のファイルは、`build-docs.mjs`実行時に読み込まれる「ビルドスクリプト本体
そのもの」です。利用者が直接編集する必要はありませんが、削除・改変すると
ビルドが失敗するため注意してください。スクリプトを最新版に更新したい場合は、
セットアップコマンドを再実行してください(後述の「既存プロジェクトへの導入」参照)。

生成されるキーの一覧・意味は[configuration.md](./configuration.md)を参照してください。

## 既存プロジェクトへの導入

既にこれらのファイルが存在するリポジトリで実行しても安全なように、ファイル単位で
上書き確認を行います。生成対象の1ファイルごとに、既存ファイルが見つかった場合だけ

```
.github/docs-pages.config は既に存在します。上書きしますか? (y/N):
```

のように尋ねられます。ここで「n」(または未入力)を選んだファイルはスキップされ、
既存の内容がそのまま保持されます。あるファイルをスキップしても、他の生成対象ファイルの
処理は止まらず、1ファイルずつ独立して確認・書き出しが行われます。

`.github/tsuzuri/`配下のビルドスクリプト一式も同じ仕組みで1ファイルずつ確認されるため、
最新版のtsuzuriに対してこのコマンドを再実行すれば、既存の`docs-pages.config`や
独自CSSはそのままに、ビルドスクリプト本体だけを最新化する、といった使い方もできます
(その場合は各ファイルの上書き確認に「y」で応答してください)。

## refを固定して実行する

`npx github:akilasatolu/tsuzuri#develop init`の`#develop`の部分は`ref`(ブランチ・タグ)の指定です。
Tsuzuri本体(CLIとビルドスクリプト)は`develop`ブランチにあり、既定ブランチの`main`には
Tsuzuri自身で作ったこのサイトのファイルしか置かれていないため、**`ref`を省略した
`npx github:akilasatolu/tsuzuri init`は動作しません**。必ず`ref`を付けて実行してください。

`#develop`は開発中の最新版を指します。リリース済みのバージョンに固定したい場合は、
次のように`#v1`のようなタグを明示して実行してください(タグ発行後に利用できます)。

```
npx github:akilasatolu/tsuzuri#v1 init
```

`v1`は互換性を保ったまま最新化されるタグです(破壊的変更が入る場合のみ`v2`が新設されます)。
「実行するたびに挙動が変わってしまう/最新の変更が反映されない」といった場合は、
まずこの`#v1`指定を試してください。
