---
title: CLIリファレンス
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
| `--update` | 対話なしで最新版に更新する([後述](#最新版に更新する--update)) |
| `-y`, `--yes` | 対話なしで、すべて既定値で生成する |
| `--branch <名前>` | トリガーブランチ(`TRIGGER_BRANCH`)。既定: リポジトリの既定ブランチ(`origin`の既定ブランチ。分からなければ`main`。v1.3.0以前は今のブランチになることがある) |
| `--root <パス>` | 起点となるMarkdownファイル(`ROOT_MD`)。既定: `README.md` |
| `--theme <名前>` | テーマ(`THEME`)。`wa` / `sakura` / `tsuki` / `akari` / `yuki` / `clay` / `grainy` / `glass` / `neumorphism` / `material` / `frosted` / `liquid` / `retro` / `y2k` / `pixel` / `nineties` / `none`。既定: `wa` |
| `--site-name <名前>` | サイト名(`SITE_NAME`)。既定: 空(ビルド時にリポジトリ名になる) |
| `--no-nav` | ナビ・サイト内検索・目次を表示しない(`NAV_ENABLED=false`)。既定: 表示する |
| `--style` | 独自CSSの空ひな形(`.github/tsuzuri/styles/custom.css`)も作る |
| `--force` | 対話なしのとき、既存ファイルも上書きする |
| `--port <番号>` | `preview`で使うポート番号。既定: `4000` |
| `--no-watch` | `preview`で、ファイルの変更を見張らない(自動でビルドし直さない) |
| `--open` | `preview`で、起動したらブラウザでサイトを開く |
| `-v`, `--version` | バージョンを表示する |
| `-h`, `--help` | 使い方を表示する |

`--yes`・`--branch`・`--root`・`--theme`・`--site-name`・`--no-nav`・`--style`のいずれかを付けると、質問せずに生成します
(スクリプトやCIから実行する場合に使えます)。このとき、既に存在するファイルは上書きせずに
スキップします。上書きしたい場合は`--force`を付けてください。

```
npx github:akilasatolu/tsuzuri#v1 init --yes --branch docs --theme akari
```

知らないオプションを指定した場合はエラーになり、何も生成しません。

## 手元で確認する(`preview`)

pushする前に、公開時と同じ設定でサイトを手元にビルドして、ブラウザで確認できます(v1.5.0以降)。
`init`済みのリポジトリの直下で実行します。

```
npx github:akilasatolu/tsuzuri#v1 preview
```

1. ビルド用の依存が`.github/tsuzuri/node_modules/`に無ければ、ワークフローと同じく
   `.github/tsuzuri/package-lock.json`のとおりにインストールします(`init`が作る`.github/tsuzuri/.gitignore`で
   コミットの対象外になっています)。
2. `.github/tsuzuri/`のビルドスクリプトで、`.github/docs-pages.config`の設定どおりにビルドします
   (リンク切れなどの警告もここに表示されます)。
3. 出力先(`OUT_DIR`、既定は`_site/`)を`http://localhost:4000/`で配信します。
4. ファイルを保存すると、自動でビルドし直して、開いているページを再読み込みします(v1.6.0以降。
   v1.5.0では、`Ctrl+C`で止めてからもう一度実行します)。

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
3. **テーマ(`THEME`)の選択**
   - `wa`(和・推奨)/`sakura`(桜)/`tsuki`(月)/`akari`(灯)/`yuki`(雪)/`clay`(クレイ)/`grainy`(グレイン)/`glass`(グラス)/`neumorphism`(ニューモーフィズム)/`material`(マテリアル)/`frosted`(フロスト)/`liquid`(リキッド)/`retro`(レトロフューチャー)/`y2k`(Y2K)/`pixel`(ピクセル)/`nineties`(90年代)/`none`(装飾なし)の
     17択が番号(1〜17)付きで表示されるので、番号を入力します。未入力なら`1`(`wa`)になります。
   - テーマの見た目の詳細は[theming.md](./theming.md)を参照してください。
4. **ナビを表示するか(`NAV_ENABLED`)(Y/n)**(v1.7.0以降)
   - サイドバーのナビ・サイト内検索・ページ内の目次・前後のページへのリンクを表示するかどうかです。
     未入力(または`y`)なら表示します。
5. **サイト名(`SITE_NAME`)**(v1.7.0以降)
   - ナビの見出しやSNSでのシェアに使うサイト名です。未入力ならビルド時にリポジトリ名になります。
6. **独自CSSのひな形ファイルを作成するか(y/N)**
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
| `.github/tsuzuri/lib/*.mjs` | 常に生成 | ビルド本体が依存するモジュール一式(config/crawler/frontmatter/html-renderer/link-extractor/path-utils/site-tree/slugger/search/sitemap) |
| `.github/tsuzuri/styles/*.css` | 常に生成 | 組み込みテーマ(`base.css`+`wa`/`sakura`/`tsuki`/`akari`/`yuki`/`clay`/`grainy`/`glass`/`neumorphism`/`material`/`frosted`/`liquid`/`retro`/`y2k`/`pixel`/`nineties`)のCSS一式。frontmatterの`theme`キー([参照](./frontmatter.md#theme))で選択中以外のテーマを使う場合に備え、常に全テーマ分コピーされる |
| `.github/tsuzuri/package.json`・`package-lock.json` | 常に生成(v1.7.0以降) | ビルド用の依存(marked など)の版と、ダウンロードした中身を確かめるハッシュ。ワークフローと`preview`はこのとおりに`npm ci`でインストールする |
| `.github/tsuzuri/.gitignore` | 常に生成 | 手元でプレビューするときにインストールする依存(`node_modules/`)をコミットしないための設定 |
| `.github/tsuzuri/styles/custom.css` | 最後の質問で「y」と答えた場合のみ | コメントのみの空の独自CSSひな形。組み込みテーマCSSと同じディレクトリに置かれる |

`.github/tsuzuri/`配下のファイルは、`build-docs.mjs`実行時に読み込まれる「ビルドスクリプト本体
そのもの」です。利用者が直接編集する必要はありませんが、削除・改変すると
ビルドが失敗するため注意してください。スクリプトを最新版に更新したい場合は、
後述の「最新版に更新する(`--update`)」を参照してください。

生成されるキーの一覧・意味は[configuration.md](./configuration.md)を参照してください。

## 既存プロジェクトへの導入

既にこれらのファイルが存在するリポジトリで実行しても安全なように、既存のファイルが見つかった
場合は上書きするかどうかを確認します。

- **ワークフローとビルドスクリプト一式**(`docs-pages.yml`と`.github/tsuzuri/`配下)は、
  同じバージョンでそろっていないと動かないため、最初に1回だけまとめて確認します。

  ```
  ワークフローとビルドスクリプト一式(.github/tsuzuri/ 配下)は既に存在します。最新版で上書きしますか? (y/N):
  ```

- **設定ファイル・独自CSS**(`.github/docs-pages.config`・`custom.css`)は、ファイルごとに確認します。

  ```
  .github/docs-pages.config は既に存在します。上書きしますか? (y/N):
  ```

「n」(または未入力)を選んだファイルはスキップされ、既存の内容がそのまま保持されます。
ワークフローとスクリプトだけを最新版にしたい場合は、次の`--update`を使うと確認なしで行えます。

## 最新版に更新する(`--update`)

一度`init`したリポジトリのtsuzuriを最新版にするには、`--update`を付けて実行します。

```
npx github:akilasatolu/tsuzuri#v1 init --update
```

質問や上書き確認は一切なく、次のように動きます。

| ファイル | `--update`での扱い |
|---|---|
| `.github/workflows/docs-pages.yml` | 最新版で上書き |
| `.github/tsuzuri/`配下のビルドスクリプト・組み込みテーマCSS | 最新版で上書き(新しく増えたファイルは追加。最新版で使われなくなった`lib/`配下のスクリプトは削除) |
| `.github/docs-pages.config` | **変更しない** |
| 独自CSS(`.github/tsuzuri/styles/custom.css`) | **変更しない** |

実行後、`git diff`で変更内容を確認してからコミット・pushしてください。
`.github/docs-pages.config`が無いリポジトリ(まだ`init`していない)で実行すると、
何も書き込まずにエラー終了します。初回は`--update`を付けずに実行してください。

## refを固定して実行する

`npx github:akilasatolu/tsuzuri init`のように`ref`(バージョンやブランチ・タグ)を省略すると、
既定ブランチ(`main`)の最新版(まだリリースしていない変更を含むことがあります)が実行されます。
普段は`#v1`を付けて実行してください。ローカルのキャッシュや`npx`自体の実装によっては
古いバージョンが実行されてしまう場合もあるため、リリース済みのバージョンに固定したい場合は、
次のように`#v1`のようなタグを明示して実行してください。

```
npx github:akilasatolu/tsuzuri#v1 init
```

`v1`は互換性を保ったまま最新化されるタグです(破壊的変更が入る場合のみ`v2`が新設されます)。
「実行するたびに挙動が変わってしまう/最新の変更が反映されない」といった場合は、
まずこの`#v1`指定を試してください。
