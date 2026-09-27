# Changelog

このプロジェクトの変更履歴は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に従って記録します。
また、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

## フォーマットについて

各リリースは以下のカテゴリのうち、該当するものだけを記載します。

- `Added` - 新機能
- `Changed` - 既存機能の変更
- `Deprecated` - 将来的に削除予定の機能
- `Removed` - 今回削除された機能
- `Fixed` - 不具合修正
- `Security` - 脆弱性に関する変更

## [Unreleased]

初回リリース(`v1`)に向けて準備中です。

### Added

- `init --update`を追加。対話なしで、ワークフローとビルドスクリプトだけを最新版に上書きする
  (設定ファイル・独自CSSは変更しない)。
- `SITE_NAME`を`og:site_name`メタタグとして出力するようにした。
- ナビゲーションを、リポジトリのディレクトリ構成に沿った階層構造で出力するようにした。
  ページの表示名はfrontmatterの`title`、無ければファイル名。`sitemap.json`にも
  同じ構造の`tree`フィールドを追加した。
- frontmatterが改行コードCRLF・先頭BOM付きのファイルでも認識されるようにした。

- frontmatterに`theme`キーを追加。ページ単位で、サイト全体の`THEME`とは違う
  組み込みテーマ、またはユーザーが用意した独自CSSファイル(パス指定)に
  テーマ層(2層目)を差し替えられるようになった([Frontmatterリファレンス](https://github.com/akilasatolu/tsuzuri/blob/docs/docs/frontmatter.md#theme)参照)。

### Changed

- `NAV_ENABLED`・`THEME`・`LANG`を省略(未設定・空文字)したときは警告を出さずに既定値を
  使うようにした(不正な値のときだけ警告する)。
- `LANG`が言語タグとして不正な値(例: ローカル実行時のOSの`en_US.UTF-8`)のときは、
  警告して`ja`にフォールバックするようにした。
- `STYLE_DIR`に絶対パスを指定できるようにした(ローカルでの動作確認用)。
- `init`が生成するワークフローでインストールする`marked`のバージョンを、ハードコードではなく
  `package.json`の`devDependencies.marked`(完全一致で固定)から埋め込むようにした。
  テストで使う版と利用者に配る版が常に一致し、Dependabotの更新PR 1つで両方が追従する。

- `npx github:akilasatolu/tsuzuri init`が生成するワークフローを自己完結型に変更。
  以前は利用者側`docs-pages.yml`がOSS本体リポジトリの再利用可能ワークフロー
  (`build.yml`)を`uses:`で呼び出し、実行のたびにビルドスクリプト本体を取得していたが、
  `init`実行時にビルドスクリプト本体(`build-docs.mjs`/`lib/*.mjs`/`styles/*.css`)を
  `.github/tsuzuri/`配下へコピーするようにした。生成後のワークフローは実行時に
  OSS本体リポジトリへ一切依存せず、利用者リポジトリの中だけでビルド・デプロイが
  完結する([デプロイ設定](https://github.com/akilasatolu/tsuzuri/blob/docs/docs/deployment.md)参照)。
- `init`で(任意で)生成する独自CSSひな形の配置先を`.github/docs-pages.style.css`から
  `.github/tsuzuri/styles/custom.css`に変更。組み込みテーマCSS一式と同じディレクトリに
  置かれるようになり、既存テーマのCSSを参考にしながら独自CSSを書けるようにした。
  `.github/docs-pages.config`の`STYLE_FILE`のデフォルト出力値もこれに合わせて変更した
  (ビルド側の内部フォールバック値`.github/docs-pages.style.css`自体は変更していない)。

### Fixed

- `marked`を18系に更新し、v13以降のレンダラーAPI(引数がトークンオブジェクト)に対応。
  旧APIのままだと`link.startsWith is not a function`でビルドが失敗していた。
- `npx`経由(`node_modules/.bin/`のシンボリックリンク経由)で起動すると、CLIが何もせずに
  終了していた不具合を修正。

### Security

- リポジトリ外のファイルを読み書きしないようにした。frontmatterの`theme`、`STYLE_FILE`、
  `FAVICON_FILE`、`ROOT_MD`、リンク先のMarkdown・画像が、`../`や絶対パス、
  リポジトリ外を指すシンボリックリンクでリポジトリの外を指す場合は無視する。
  `OUT_DIR`がリポジトリ外またはリポジトリ直下を指す場合はビルドを中止する。
- `init`が生成するワークフローを強化した。設定ファイルからは既知のキーだけを環境変数として
  取り込み(`NODE_OPTIONS`等を注入できないようにする)、Pagesへの書き込み権限は
  deployジョブだけに付与し、`marked`のインストール時にinstallスクリプトを実行しない。
  あわせて、値に`'`や`"`を含むとワークフローが失敗する不具合を修正した。

### Removed

- リポジトリ直下に残っていた、旧方式(薄いラッパー+`build.yml`呼び出し)時代の
  生成物の古い例(`.github/workflows/docs-pages.yml`・`.github/docs-pages.config`・
  `.github/workflows/build.yml`)を削除。現行の`init`が生成するテンプレートと
  内容が乖離しており、「本リポジトリ内のどこまでが編集してよいソースで、
  どこからが利用者向けの生成物か」が分かりにくくなっていたための整理。
  あわせて`ci.yml`の`build-smoke-test`ジョブ(削除した`build.yml`への依存)を廃止し、
  `ci.yml`全体の権限を`contents: read`のみに縮小した(lint・test以外何もしないため、
  GitHub Pagesへは一切触れなくなった)。ビルドロジック自体の検証は、既存の
  `test/build-docs.e2e.test.mjs`・`test/cli.test.mjs`で引き続きカバーされる。
