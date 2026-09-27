# 設定リファレンス(Configuration)

## `.github/docs-pages.config`の場所と書式

設定ファイルは、利用者リポジトリのルートからの相対パスで
`.github/docs-pages.config`に配置します(`npx github:akilasatolu/tsuzuri init`を実行すると
自動生成されます。詳細は[cli.md](./cli.md))。

書式は「`KEY=VALUE`」形式のシンプルなテキストで、1行につき1項目です。
`#`で始まる行と空行は読み飛ばされます(コメント・区切りとして自由に使えます)。
YAMLのような入れ子構造やクォート、複数行の値には対応していません。

## 設定キー一覧

### TRIGGER_BRANCH
デプロイをトリガーするブランチ名です。デフォルトは`main`です。このブランチへの
push(マージ含む)があったときだけ、GitHub Pagesへのデプロイが実行されます
(手動実行(`workflow_dispatch`)の場合はこの判定自体がスキップされ、常にデプロイされます。
詳細は[deployment.md](./deployment.md))。
既定ブランチ(通常は`main`)以外を指定する場合は、GitHub側で追加の設定が必要です
([deployment.md](./deployment.md)の「既定ブランチ以外をトリガーブランチにする場合」を参照)。

### ROOT_MD
サイトの起点となるMarkdownファイルの、リポジトリルートからの相対パスです。
デフォルトは`README.md`です。このファイルが実際に存在しない場合、ビルドはエラー終了します。

### OUT_DIR
ビルドしたHTML一式の出力先ディレクトリです。デフォルトは`_site`です。

### STYLE_FILE
独自CSSファイルへのパスです。`npx github:akilasatolu/tsuzuri init`が生成する
`.github/docs-pages.config`では`.github/tsuzuri/styles/custom.css`(組み込みテーマCSSと
同じディレクトリ)が指定されます。このキー自体を省略した場合のビルド側の既定値は
`.github/docs-pages.style.css`です。
3層カスケード(基礎CSS→THEME→STYLE_FILE)のうち最も優先度が高い、いわば
「最後に読み込まれて最優先で反映される」層に当たります。ファイルが存在しない場合は
黙って無視され(警告のみ)、既定のスタイルのままビルドされます。詳細は
[theming.md](./theming.md)を参照してください。

### THEME
組み込みのテーマ(配色+装飾のセット)を選択するキーです。
選択できる値は`wa`(和・既定)/`muji`(無地)/`sumi`(墨)/`ai`(藍)/`shu`(朱)/`none`
(装飾なし)の6つです。指定を省略した場合や、上記6つ以外の値(例: `sepia`のような
存在しない名前)を指定した場合は、警告(warn)を出したうえで`wa`にフォールバックします。
テーマごとの見た目は[theming.md](./theming.md)を参照してください。

### LANG
出力されるHTMLの`<html lang="...">`に設定する言語コードです。デフォルトは`ja`です。
空文字を指定した場合も同様に`ja`にフォールバックします。サイト全体で1つの固定値として
使われ、ページ単位(frontmatter)で上書きすることはできません(詳細は
[frontmatter.md](./frontmatter.md)の`lang`キーの説明を参照)。

### NAV_ENABLED
自動生成される簡易ページナビゲーション(サイト内の全ページへのリンク一覧)を
出力するかどうかです。`true`または`false`(大文字小文字は区別しません)のみ有効な値で、
デフォルトは`false`です。それ以外の値(例: `yes`)を指定した場合は警告を出したうえで
`false`扱いになります。

### FAVICON_FILE
生成されるサイトで使うfaviconの画像ファイルへの、リポジトリルートからの相対パスです。
未設定、またはファイルが実際に存在しない場合は、警告を出しつつビルドは継続し、
`<link rel="icon">`タグ自体を出力しません(faviconなしの状態になります)。
なお、これは利用者がサイトに設定するfaviconであり、OSS本体自体のロゴ・favicon
(`assets/`配下)とは無関係です。

### SITE_NAME
OGPの`og:site_name`相当の表示や、ナビゲーション有効時のサイトタイトルとして使われる
サイト名です。省略した場合は、ビルド実行時の環境変数`GITHUB_REPOSITORY`
(`"owner/repo"`形式。GitHub Actions実行時は常に自動設定される既定の環境変数です)から、
`/`より後ろのリポジトリ名部分を自動的に採用します。`GITHUB_REPOSITORY`自体が
存在しない場合(ローカル実行時など)は空文字のままになります。

### CUSTOM_DOMAIN
カスタムドメインを使う場合のドメイン名です(スキームなし。例: `docs.example.com`)。
設定すると、出力ディレクトリ直下に`CNAME`ファイルが自動生成されます。
ホスト名として妥当でない値(例: `https://`付きの値やパスを含む値)を指定した場合は
警告を出したうえで空文字にフォールバックし、`CNAME`は生成されません。
詳細は[deployment.md](./deployment.md)を参照してください。

### OGP_DEFAULT_IMAGE
frontmatterで`ogImage`を指定していないページに使う、既定のOGP画像です(相対パスまたは
絶対URL)。省略した場合、`ogImage`が指定されていないページでは`og:image`タグ自体が
出力されません。

## 後方互換性について

`LANG`/`NAV_ENABLED`/`FAVICON_FILE`/`SITE_NAME`/`CUSTOM_DOMAIN`/`OGP_DEFAULT_IMAGE`/
`THEME`の7キーは、いずれも**すべて省略可能**です。1つも指定しなかった場合、
すべて上記のデフォルト値が適用され、これらのキーが導入される前のバージョンと
完全に同じ挙動になります。既存の設定ファイル(旧4キーのみ)をそのまま使い続けても、
壊れたり動作が変わったりすることはありません。
