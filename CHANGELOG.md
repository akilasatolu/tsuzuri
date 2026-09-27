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

## [1.1.0] - 2026-09-27

### Added

- CLIの実行時に、最初に実行中のバージョン(`tsuzuri vX.Y.Z`)を表示するようにした。
  `--version`(`-v`)・`--help`(`-h`)も追加。生成するワークフローの先頭コメントにも生成時のバージョンを記載する。
- `init`を対話なしで実行できるオプションを追加(`--yes`・`--branch`・`--root`・`--theme`・`--style`)。
  対話なしのときは既存ファイルをスキップし、`--force`を付けたときだけ上書きする。
- 言語名付きのコードブロックを、ビルド時にhighlight.jsで色分けするようにした(閲覧時のJavaScriptは不要)。
  色はテーマに合わせて決まり、独自CSSで`--hl-*`変数を指定すれば変えられる。
- `NAV_ENABLED=true`のとき、ナビの上部にサイト内検索を表示するようにした。
- `SITEMAP_JSON`設定を追加。`true`のときだけデバッグ用の`sitemap.json`を出力する。

### Changed

- デバッグ用の`sitemap.json`を既定では出力しないようにした(リンク切れや拒否したリンクのパスが
  公開サイトから見えてしまうため)。リンクの問題はこれまでどおりワークフローのログに表示される。
- 起点のページ(`ROOT_MD`)にfrontmatterの`title`が無い場合、ナビの表示名にサイト名(`SITE_NAME`)を使うようにした。
- 対応するNode.jsのバージョン(20以上)を`package.json`の`engines`に明記し、CIでNode.js 20/22/24を試すようにした。
- 不明なオプション・サブコマンドを指定したときはエラーにするようにした。

## [1.0.0] - 2026-09-27

初回リリース。

### Added

**セットアップ**
- `npx github:akilasatolu/tsuzuri init`で、対話形式でワークフロー・設定ファイル・ビルドスクリプト一式を
  生成する。生成後は利用者リポジトリの中だけでビルド・公開が完結し、tsuzuri本体を参照しない。
- `init --update`で、設定ファイル・独自CSSを残したままワークフローとビルドスクリプトを最新版にする。
- `#v1`(v1系の最新版)・`#v1.0.0`(固定)のタグでバージョンを指定できる。

**サイトの生成**
- `README.md`(`ROOT_MD`)を起点にリンクをたどり、到達できるMarkdown・画像・その他のファイル(PDF等)
  だけをサイトにする。Markdownへのリンクは`.html`に書き換える。
- ディレクトリの`README.md`は`index.html`としても出力する。`404.html`も生成する。
- 見出しにGitHubと同じ規則の`id`を付け、`page.md#見出し`のリンクが使える。
- 検索エンジン向けの`sitemap.xml`・`robots.txt`、canonical・OGP(`og:image`は絶対URL)を出力する。
- `STRICT_LINKS=true`で、リンク切れがあるときにビルドを失敗させて公開を止められる。

**見た目**
- テーマ5種(和・無地・墨・藍・朱)と装飾なしから選べる。ページ単位でも切り替えられる(frontmatterの`theme`)。
- 基礎CSS → テーマ → 独自CSS の3層で、CSS変数による配色の調整ができる。
- `NAV_ENABLED=true`で、ディレクトリ階層のナビ(広い画面はサイドバー、狭い画面は「メニュー」ボタン)と、
  前後のページへのリンクを表示する。

**設定**
- `.github/docs-pages.config`(`KEY=VALUE`形式)で、トリガーブランチ・テーマ・言語・favicon・サイト名・
  カスタムドメイン・OGP画像などを設定する。すべて省略可能。
- frontmatterでページごとに`title`・`description`・`ogImage`・`ogType`・`noindex`・`theme`を指定できる。

**安全性**
- リポジトリの外を指すパス(`../`・絶対パス・シンボリックリンク)は読み書きしない。
- 生成ワークフローは設定ファイルから既知のキーだけを読み込み、Pagesへの書き込み権限は公開ジョブだけに付ける。

[Unreleased]: https://github.com/akilasatolu/tsuzuri/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/akilasatolu/tsuzuri/releases/tag/v1.0.0
