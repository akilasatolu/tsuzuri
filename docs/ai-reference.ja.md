---
title: AIエージェント向けの参考情報
order: 2
---

# AIエージェント向けの参考情報

このページの枠の中には、Tsuzuri の導入から GitHub Pages での公開までの事実を、
1 つの文章にまとめてあります。枠の右上の「コピー」ボタンで全文をコピーし、
お使いの AI エージェントに貼り付けて使えます。

内容は Tsuzuri v1.30.4 の時点のものです。人が読むための手順は
[Getting Started](getting-started.ja.md) にあります。

````markdown
# Tsuzuri 参考情報

- 対象: Tsuzuri v1.30.4(v1 系)
- 最終確認日: 2026-10-07
- 公式ドキュメント: https://akilasatolu.github.io/tsuzuri/ja/
- ソースコード: https://github.com/akilasatolu/tsuzuri

この文書には、Tsuzuri の導入、設定、ページの作成、GitHub Pages での公開に
ついての事実が書かれています。内容は、上記のバージョンのソースコードと
公式ドキュメントにもとづいています。

## 1. Tsuzuri の概要

Tsuzuri は、リポジトリの `README.md` を起点に Markdown のリンクをたどり、
つながっている Markdown と画像を GitHub Pages のサイトにするツールです。
ライセンスは MIT です。

Tsuzuri は次の 4 つで構成されています。

- セットアップ用のコマンド: `init`(導入と更新)と `preview`(手元での確認)の
  2 つのサブコマンドがあります。npm のレジストリではなく、GitHub の
  リポジトリから `npx` で取得されます。
- ビルドスクリプト: `init` が利用者のリポジトリの `.github/tsuzuri/` に
  コピーします。ビルドスクリプトは、Markdown を HTML に変換します。
- ワークフロー: `.github/workflows/docs-pages.yml` です。ワークフローは、
  GitHub Actions でビルドと GitHub Pages へのデプロイを行います。
- 設定ファイル: `.github/docs-pages.config` です。

`init` のあと、ワークフローは利用者のリポジトリの中のファイルだけで動きます。
実行のたびに Tsuzuri のリポジトリを取得することはありません。

## 2. 前提条件

- 対象は GitHub のリポジトリです。サイトは GitHub Pages で公開されます。
  GitHub Pages を使える条件は、GitHub が定めています。
- `npx` で実行するコマンド(`init` と `preview`)は、Node.js 20 以上で動きます。
  手元の Node.js が使われるのは、このコマンドを実行するときだけです。
- ビルドとデプロイは GitHub Actions の上で行われます。ワークフローは
  Node.js 24 を使います。
- ワークフローが使う権限は、ワークフローのファイルの中で宣言されています。
  全体は `contents: read` で、デプロイのジョブだけが `pages: write` と
  `id-token: write` を持ちます。利用者が登録するシークレットはありません。
- GitHub の側で利用者が行う設定は、8 章の 2 つです。

## 3. 導入(init)

### 3.1 コマンド

利用者は、公開したいリポジトリの直下で次のコマンドを実行します。

```
npx github:akilasatolu/tsuzuri#v1 init
```

- `#v1` は、v1 系の最新のリリースを指すタグです。`#v1.30.4` のように
  完全なバージョンを書くと、そのリリースに固定されます。`#` 以降を省くと、
  リリース前の変更を含む `main` ブランチの内容が実行されます。
- コマンドは、最初の行に `tsuzuri v1.30.4` の形で、動いているバージョンを
  表示します。
- `init` と `preview` の画面の表示は日本語です。生成される設定ファイルと
  ワークフローのコメントも日本語です。
- `init` は省略できます。サブコマンドが無い場合は `init` として動きます。

### 3.2 実行する場所

ワークフローは、リポジトリの直下の `.github/workflows/` に置かれたものだけが
GitHub で動きます。git のリポジトリの外、またはリポジトリの直下以外で
`init` を実行すると、`init` は警告を表示します。対話形式では、続けて次の
質問を表示します。

`このまま続けますか? (y/N): `

何も入力しない場合と `n` の場合、`init` は何も生成せずに終了します。

### 3.3 対話形式の質問

オプションを付けずに実行すると、`init` は次の 7 つの質問を順に表示します。
何も入力せずに Enter を押すと、かっこ内の既定値になります。

1. `? トリガーブランチ (TRIGGER_BRANCH) [main]: `
   デプロイするブランチです。既定値は、`origin` の既定ブランチ、それが
   分からなければ今のブランチ、それも分からなければ `main` です。
2. `? ルートとなるMarkdownファイル (ROOT_MD) [README.md]: `
   サイトの起点になる Markdown ファイルです。既定値は `README.md` です。
3. 3 番目の質問は、テーマ(`THEME`)の一覧を 1 から 8 の番号付きで表示し、
   番号の入力を受け付けます。番号とテーマの対応は次のとおりです。

   - 1: `material`
   - 2: `glass`
   - 3: `neumorphism`
   - 4: `editorial`
   - 5: `minimal`
   - 6: `blueprint`
   - 7: `nineties`
   - 8: `none`

   何も入力しない場合、1 から 8 以外の番号を入力した場合、数字以外を
   入力した場合は、`material` になります。
4. `? サイドバーのナビ・サイト内検索・ページ内の目次を表示しますか? (NAV_ENABLED) (Y/n): `
   既定値は「表示する」です。
5. `? サイトの言語 (LANGUAGES。カンマ区切りで、先頭は README の言語。例: ja / en / ja,en) [en]: `
   既定値は `en` です。言語タグとして正しくない値(例: `ja_JP`)は、警告の
   うえで無視されます。正しい値が残らなければ `en` になります。
6. `? サイト名 (SITE_NAME。空ならリポジトリ名) []: `
   既定値は空です。空の場合、GitHub Actions でのビルドではリポジトリ名が
   サイト名になります。
7. `? 独自CSS用の空ひな形ファイル(.github/tsuzuri/styles/custom.css)を作成しますか? (y/N): `
   既定値は「作成しない」です。

### 3.4 対話なしの実行

次のオプションのどれかを付けると、`init` は質問をせずに生成します。

- `-y`、`--yes`: `init` は、すべて既定値で生成します。
- `--branch <name>`: `TRIGGER_BRANCH` の値です。
- `--root <path>`: `ROOT_MD` の値です。
- `--theme <name>`: `THEME` の値です。
- `--languages <list>`: `LANGUAGES` の値です(例: `ja`、`ja,en`)。
- `--site-name <name>`: `SITE_NAME` の値です。
- `--no-nav`: `NAV_ENABLED=false` になります。
- `--style`: `init` は、独自 CSS の空のひな形も生成します。

例:

```
npx github:akilasatolu/tsuzuri#v1 init --yes --branch main --languages ja
```

- 対話なしの場合、トリガーブランチの既定値は、`origin` の既定ブランチ、
  それが分からなければ `main` です。今のブランチは使われません。
- 対話なしの場合、すでにあるファイルは上書きされずに残ります。`--force` を
  付けると上書きされます。
- 知らないオプション、8 つのテーマ名以外の `--theme`、言語タグとして正しくない
  `--languages`、空の `--branch`・`--root`・`--languages` は、エラーになります。
  この場合、`init` は何も生成しません。

そのほかのオプションは次のとおりです。

- `--update`: `init` は、10 章の更新を行います。
- `-v`、`--version`: コマンドは、バージョンを表示します。
- `-h`、`--help`: コマンドは、使い方を表示します。

### 3.5 生成されるファイル

- `.github/workflows/docs-pages.yml`: ワークフロー
- `.github/docs-pages.config`: 設定ファイル
- `.github/tsuzuri/build-docs.mjs`: ビルドスクリプト
- `.github/tsuzuri/lib/*.mjs`: ビルドスクリプトが使うモジュール(14 個)
- `.github/tsuzuri/styles/*.css`: 基礎の CSS(`base.css`)と 7 つのテーマの CSS
- `.github/tsuzuri/package.json`、`.github/tsuzuri/package-lock.json`:
  ビルドに使う依存(marked、highlight.js、marked-footnote)のバージョンと
  ハッシュ
- `.github/tsuzuri/.gitignore`: `node_modules/` を git の対象から外す設定
- `.github/tsuzuri/styles/custom.css`: 独自 CSS の空のひな形(7 番目の質問に
  `y` と答えた場合、または `--style` を付けた場合だけ)

`.github/tsuzuri/` の中のビルドスクリプトとテーマの CSS は、利用者が編集する
ファイルではありません。編集や削除をすると、ビルドが失敗することがあります。
また、10 章の更新で上書きされます。

### 3.6 init が行わないこと

- `init` は、コミットと push を行いません。
- `init` は、GitHub の Pages と Environments の設定を変更しません。
- `init` は、起点の Markdown(`ROOT_MD` のファイル)を作りません。ファイルが無い場合、
  `init` は警告を表示します。
- `init` は、リポジトリの直下の `.gitignore` を変更しません。`.gitignore` に `_site/` が
  無いリポジトリでは、手元でビルドした出力が git の未追跡ファイルとして
  現れます。

### 3.7 既存のリポジトリと新規のリポジトリ

コマンドと手順は、どちらも同じです。違いが出るのは次の点です。

- 起点の Markdown が無いリポジトリ(作ったばかりのリポジトリなど)では、
  起点のファイルができるまで、ビルドはエラーで終了します。
- `origin` が無いリポジトリでは、トリガーブランチの既定値は、対話形式では
  今のブランチ、対話なしでは `main` になります。
- 生成先に同じ名前のファイルがすでにある場合、対話形式の `init` は上書き
  するかどうかを質問します。ワークフローと `.github/tsuzuri/` の一式に
  ついては、まとめて 1 回だけ質問します。

  `ワークフローとビルドスクリプト一式(.github/tsuzuri/ 配下)は既に存在します。最新版で上書きしますか? (y/N): `

  設定ファイルと `custom.css` については、ファイルごとに質問します。

  `.github/docs-pages.config は既に存在します。上書きしますか? (y/N): `

  何も入力しない場合と `n` の場合、そのファイルは変更されません。

## 4. 設定ファイル

### 4.1 場所と書式

- 場所は `.github/docs-pages.config` です。
- 設定は、1 行に 1 項目の `KEY=VALUE` の形です。
- `#` で始まる行と空行は無視されます。
- 値の前後の空白は取り除かれます。
- 値の後ろに書いた `#` 以降は、コメントにならず、値の一部になります。
- 引用符は値の一部になります。複数行の値と入れ子の構造には対応していません。
- 一覧に無いキーは無視されます。GitHub Actions のワークフローでは警告が
  出ます。手元のビルドと `preview` では警告は出ません。
- `LANG` は廃止されたキーです。書かれていても、警告のうえで無視されます。
- `true` か `false` を取るキーは、大文字と小文字を区別しません。それ以外の
  値は、警告のうえで `false` になります。

### 4.2 設定キー

キーは 15 個で、すべて省略できます。「省略時」は、キーが無い場合と値が空の
場合の動きです。「init の値」は、`init` が生成する設定ファイルに書かれる値です。

- `TRIGGER_BRANCH`: デプロイするブランチです。このブランチへの push で
  サイトが更新されます。
  省略時: リポジトリの既定ブランチ(GitHub の設定上の既定ブランチ。通常は
  `main`)になります。
  init の値: 質問 1 の答えです。
- `ROOT_MD`: サイトの起点になる Markdown ファイルです。値は、リポジトリの
  直下からのパスです。ファイルが無い場合と、リポジトリの外を指している場合、
  ビルドはエラーで終了します。
  省略時: `README.md`
  init の値: 質問 2 の答えです。
- `OUT_DIR`: ビルドした出力の置き場所です。値は、リポジトリの中の
  サブディレクトリです。リポジトリの外とリポジトリの直下(`.`)は、エラーになります。
  出力先に `.tsuzuri-build` というファイルがあると、ビルドは書き出す前に
  出力先の中身をすべて消します。このファイルはビルドが自動で置きます。
  省略時: `_site`
  init の値: `_site`
- `STYLE_FILE`: 独自 CSS のファイルです。ファイルがあれば、テーマの後に
  読み込まれます。ファイルが無い場合は使われません。
  省略時: `.github/tsuzuri/styles/custom.css`
  init の値: `.github/tsuzuri/styles/custom.css`
- `THEME`: テーマです。値は `material`、`glass`、`neumorphism`、`editorial`、
  `minimal`、`blueprint`、`nineties`、`none` の 8 つです。それ以外の値は、
  警告のうえで `material` になります。
  省略時: `material`
  init の値: 質問 3 の答えです。
- `LANGUAGES`: サイトの言語です。値は、`ja`、`en`、`pt-BR` のような言語タグの
  カンマ区切りです。先頭が基本言語で、起点の Markdown の言語に
  当たります。1 つなら 1 言語のサイト、2 つ以上なら多言語のサイトになります。
  正しくないタグと重複したタグは、警告のうえで無視されます。
  省略時: `en`
  init の値: 質問 5 の答えです。
- `NAV_ENABLED`: サイドバーのナビ、サイト内検索、ページ内の目次、前後の
  ページへのリンク、ライトとダークの切り替えボタンを表示するかどうかです。
  省略時: `false`
  init の値: 質問 4 の答えです(既定値は `true`)。
- `FAVICON_FILE`: favicon にする画像です。値は、リポジトリの直下からの
  パスです。
  省略時: favicon はありません。
  init の値: 空
- `SITE_NAME`: サイト名です。ナビの見出しと `og:site_name` に使われます。
  省略時: GitHub Actions でのビルドではリポジトリ名になります。手元のビルド
  では空になります。
  init の値: 質問 6 の答えです。
- `CUSTOM_DOMAIN`: 独自ドメインです(例: `docs.example.com`)。`https://` や
  パスを含む値は、警告のうえで無視されます。設定すると、出力先に `CNAME` が
  生成されます。
  省略時: 独自ドメインは使われません。
  init の値: 空
- `OGP_DEFAULT_IMAGE`: frontmatter に `ogImage` が無いページで使われる
  OGP 画像です。値は、リポジトリの直下からのパスか、`https://` で始まる
  URL です。
  省略時: `og:image` は出力されません。
  init の値: 空
- `STRICT_LINKS`: `true` にすると、リンクの問題があるときにビルドが失敗し、
  サイトは更新されません。対象は、リンク切れ、リポジトリの外を指すリンク、
  見つからない画像やファイル、出力先の重なり、リンク先のページに無い
  見出しへのリンク、同じページの同じ言語版の重複です。
  省略時: `false`(問題は警告として表示され、そのまま公開されます)
  init の値: `false`
- `LAST_UPDATED`: `true` にすると、各ページの末尾に、git で最後にコミット
  された日が表示されます。
  省略時: `false`
  init の値: `false`
- `EDIT_LINK`: `true` にすると、各ページの末尾に、GitHub の編集画面への
  リンクが付きます。ブランチが分からない場合(タグをビルドした、手元で
  `origin` が無い、など)は、リンクは付きません。
  省略時: `false`
  init の値: `false`
- `SITEMAP_JSON`: `true` にすると、調査用の `sitemap.json` が出力先に
  書き出されます。公開されるサイトにも含まれます。
  省略時: `false`
  init の値: `false`

### 4.3 自動で決まる値

サイトの URL の先頭に付くパス(`BASE_PATH`)は、設定キーではありません。
ワークフローが次のように決めます。

- `CUSTOM_DOMAIN` がある場合: パスは付きません。サイトは
  `https://<CUSTOM_DOMAIN>/` になります。
- リポジトリ名が `<owner>.github.io` の形の場合: パスは付きません。サイトは
  `https://<owner>.github.io/` になります。
- それ以外の場合: `/<repo>` が付きます。サイトは
  `https://<owner>.github.io/<repo>/` になります。

## 5. ページの作成と編集

### 5.1 サイトに含まれるページ

- ビルドは、起点の Markdown から、Markdown のリンクを順にたどってページを
  集めます。
- サイトに含まれるのは、起点からリンクでたどれる Markdown だけです。
  どこからもリンクされていない Markdown は、同じフォルダにあっても
  サイトに含まれません。
- ページを増やすときの作業は、Markdown ファイルを置くことと、すでに
  サイトに含まれているページからそのファイルへリンクを張ることの 2 つです。
- `http://`、`https://`、`mailto:` などで始まるリンクと、`#` だけのリンクは、
  たどる対象になりません。
- コードブロックとインラインコードの中に書いたリンクは、たどる対象にも、
  書き換えの対象にも、リンク切れの検査の対象にもなりません。

### 5.2 出力されるファイルと URL

- `docs/faq.md` は `docs/faq.html` になります。Markdown の中の `.md` への
  リンクは、自動で `.html` へのリンクに書き換わります。
- 起点の Markdown は、サイトのトップ(`index.html`)にもなります。
- サブディレクトリの `README.md` は、そのディレクトリの `index.html` にも
  なります(`guide/README.md` は `guide/` で開けます)。同じディレクトリに
  `index.md` がある場合は、`index.md` が `index.html` になります。
- ディレクトリへのリンク(`guide/`)は、その中の `README.md` か `index.md` の
  ページへのリンクになります。
- 画像(png、jpg、jpeg、gif、svg、webp、bmp、ico)は、リンクされているものだけが
  コピーされます。
- 拡張子のあるそのほかのファイル(PDF、zip など)も、リンクされているものだけが
  コピーされます。
- `.` で始まるファイルはコピーされません。`.` で始まるディレクトリの中の
  ファイルは、Markdown、画像、PDF、動画、音声だけがサイトに出力されます。
  出力先のパスは、先頭に `_` が付きます(`.github/logo.png` は
  `_.github/logo.png`)。
- 拡張子の無いファイル(`LICENSE` など)と、`README.md` も `index.md` も無い
  ディレクトリへのリンクは、GitHub の上のファイルや一覧へのリンクになります。
- リンク先が存在しない場合、そのリンクはリンク切れとして、ビルドのログに
  表示されます。

### 5.3 ページのタイトルとナビ

- ページのタイトルは、frontmatter の `title`、本文の最初の h1 の見出し、
  (起点のページでは)サイト名、ファイルのパスの順で決まります。
- ナビは、リポジトリのディレクトリの構成に沿った階層になります。並び順は、
  起点からリンクをたどってページが見つかった順です。起点の Markdown で
  リンクを書いた順が、そのまま並び順になります。
- ナビの定義ファイルはありません。

### 5.4 frontmatter

frontmatter は、Markdown ファイルの先頭に `---` で囲んで置かれる、
`key: value` の行の集まりです。

```markdown
---
title: Getting Started
description: How to set up the site
order: 1
---

# Getting Started
```

- 対応しているのは 1 行の `key: value` の形だけです。配列、入れ子、複数行の値には
  対応していません。
- 値の全体を囲む引用符は取り除かれます。
- 終わりの `---` が無い場合、警告が表示され、ブロック全体が本文として
  扱われます。
- ページの言語は frontmatter では決まりません(6 章)。

キーは次の 10 個です。

- `title`: ページのタイトルです。ナビの表示名にも使われます。
- `description`: 説明文です。無い場合、本文の最初の段落から 120 文字までの
  説明文が作られます。
- `ogImage`: OGP 画像です。値は、そのファイルからの相対パス、`/` で始まる
  リポジトリの直下からのパス、`https://` で始まる URL のどれかです。
- `ogType`: `og:type` の値です。無い場合は `website` です。
- `noindex`: `true` にすると、検索エンジン向けの `noindex` が出力され、
  `sitemap.xml` にも載りません。
- `theme`: そのページだけのテーマです。値は、8 つのテーマ名のどれかか、
  リポジトリの直下からの CSS ファイルのパスです。
- `styleFile`: そのページだけ、`STYLE_FILE` の代わりに使われる CSS ファイルです。
  値は、リポジトリの直下からのパスです。
- `nav`: `false` にすると、そのページはナビと前後のページへのリンクに
  載りません。ページ自体は出力されます。
- `order`: ナビでの並び順を表す数値です。同じディレクトリの中で、`order` の
  あるページが小さい順に先に並びます。ディレクトリの位置は、その中の
  `README.md` か `index.md` の `order` で決まります。
- `toc`: `false` にすると、そのページには目次が表示されません。

### 5.5 使える記法と機能

- GitHub Flavored Markdown(表、取り消し線、タスクリストなど)が使えます。
- 引用ブロックの 1 行目に `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、
  `[!CAUTION]` を書くと、種類ごとの色の枠で表示されます。
- 脚注(`[^1]`)が使えます。
- 言語名を書いたコードブロックは、ビルドのときに色分けされます。
  コードブロックには、コピー用のボタンが付きます。
- 言語名が `mermaid` のコードブロックは、図として表示されます。mermaid の
  図は、閲覧時にブラウザが CDN(jsDelivr)から読み込んで描きます。
- 見出しには、GitHub と同じ規則の id が付きます。`page.md#heading` の形の
  リンクが使えます。
- `NAV_ENABLED=true` の場合、h2 と h3 の見出しが合わせて 3 つ以上あるページに
  目次が表示されます。
- Markdown の中に書いた HTML(`<div>`、`<script>` など)は、無害化されずに
  そのまま出力されます。

### 5.6 404 ページ

リポジトリの直下に `404.md` がある場合、その内容が `404.html` になります。
無い場合は、既定の内容の `404.html` が生成されます。

## 6. 多言語のサイト(要点)

- `LANGUAGES` に 2 つ以上の言語を書くと、多言語のサイトになります
  (例: `LANGUAGES=ja,en`)。
- 翻訳のページの置き場所は、元のページと同じ場所です。ファイル名は
  `<name>.<lang>.md` の形です(`docs/cli.md` の英語版は `docs/cli.en.md`)。
- 言語の付かないファイルは、基本言語のページです。
- 基本言語のページの URL は 1 言語のサイトと同じです。ほかの言語のページは
  `/<lang>/` の下に出力されます(`docs/cli.en.md` は `/en/docs/cli.html`)。
  URL の中の言語は小文字になります。
- ほかの言語のトップは、起点のファイル名に言語を付けたファイルです
  (`README.md` に対して `README.en.md`)。
- 集めたページの別の言語版のファイルは、リンクが無くても自動で集められて
  公開されます。
- ファイルへのリンクは、書いたとおりのファイルを指します。英語のページから
  英語のページへのリンクは、`cli.en.md` の形になります。
- ナビ、前後のページへのリンク、サイト内検索は、言語ごとに作られます。
- 画面の決まった文言(メニュー、コピーなど)は、英語と日本語に対応しています。
  ほかの言語のページでは英語になります。
- 各ページには、言語を切り替えるボタンが付きます。

## 7. 見た目(要点)

- ページの CSS は、基礎の CSS、テーマ(`THEME`)、独自 CSS(`STYLE_FILE`)の
  順に重なります。後のものが優先されます。
- `THEME=none` の場合、テーマの層は使われません。
- 独自 CSS では、`--fg`、`--bg`、`--border`、`--accent`、`--code-bg`、`--font`、
  `--content-width` などの CSS 変数を上書きできます。
- 見た目は、frontmatter の `theme` と `styleFile` で、ページごとに変わります。
- `nineties` はライト表示だけ、`blueprint` は常に同じ表示です。`material`、
  `glass`、`neumorphism`、`editorial`、`minimal` の 5 つのテーマは、OS の設定に
  合わせてライトとダークが切り替わります。

## 8. 公開

### 8.1 GitHub の側の設定

利用者が GitHub の画面で行う設定は、次の 2 つです。どちらも最初の 1 回だけです。

1. 利用者は、Settings > Pages を開き、Build and deployment の Source を
   「GitHub Actions」にします。この設定が無いと、ワークフローが成功しても
   サイトは公開されません。
2. `TRIGGER_BRANCH` がリポジトリの既定ブランチ以外の場合だけ、利用者は、
   Settings > Environments > github-pages を開き、Deployment branches and tags に
   そのブランチを追加します(Ref type は Branch、Name pattern はブランチ名)。

`github-pages` という環境は、1 の設定をした時点で自動で作られます。
そのため、2 の設定は 1 の後に行えます。

### 8.2 公開までの流れ

1. 利用者が `init` を実行します(3 章)。
2. 利用者が、起点の Markdown をリポジトリに用意します。
3. 利用者が 8.1 の設定を行います。
4. 利用者が、生成されたファイルをコミットし、`TRIGGER_BRANCH` のブランチに
   push します。
5. Actions タブに `Deploy Docs to GitHub Pages` という名前のワークフローの
   実行が現れます。成功すると、Settings > Pages にサイトの URL が表示されます。

`TRIGGER_BRANCH` を既定ブランチ以外にする場合、ワークフロー、設定ファイル、
`.github/tsuzuri/` は、そのブランチにコミットされている状態で動きます。

### 8.3 ワークフローの動き

- ワークフローは、すべてのブランチへの push と、手動の実行
  (`workflow_dispatch`)で起動します。プルリクエストでは起動しません。
- push されたブランチが `TRIGGER_BRANCH` と同じ場合だけ、ビルドとデプロイが
  行われます。
- push されたブランチが `TRIGGER_BRANCH` と違う場合、実行されるのは
  チェックアウト、設定ファイルの読み込み、ブランチの判定の 3 つだけです。
  依存のインストール、ビルド、リンクの検査、デプロイは行われません。
  このとき、Check trigger branch のステップのログに次の表示が出ます。

  `TRIGGER_BRANCH=main ではない push (feature/foo) のためスキップします`

- 設定ファイルに `TRIGGER_BRANCH` が無い場合と、値が空の場合、ワークフローは
  リポジトリの既定ブランチを使います。このとき、同じステップのログに次の
  表示が出ます。

  `設定ファイルに TRIGGER_BRANCH が無い(または空の)ため、リポジトリの既定ブランチ main を使います`

- 手動の実行では、ブランチの判定は行われず、選んだブランチの内容が
  デプロイされます。このとき、ログに次の表示が出ます。

  `手動実行のためブランチ判定をスキップします`

  Actions タブの「Run workflow」のボタンは、ワークフローのファイルが
  既定ブランチにある場合に表示されます。
- ビルドの前に、ワークフローは `.github/tsuzuri/package-lock.json` のとおりに
  依存をインストールします。
- `LAST_UPDATED=true` の場合、ワークフローは git の全履歴を取得してから
  ビルドします。
- 同じブランチの実行は、push された順に 1 つずつ進みます。

### 8.4 独自ドメイン

`CUSTOM_DOMAIN` にドメイン名を書くと、出力先に `CNAME` が生成され、サイトの
URL はドメインの直下になります。DNS の設定は、GitHub Pages の手順に従って
利用者が別に行います。

### 8.5 検索エンジン向けの出力

GitHub Actions でのビルドでは、`sitemap.xml` が出力されます。サイトが
ドメインの直下にある場合は、`robots.txt` も出力されます。

## 9. 手元での確認

### 9.1 preview

`init` を済ませたリポジトリの直下で、利用者は次のコマンドを実行できます。

```
npx github:akilasatolu/tsuzuri#v1 preview
```

- `.github/tsuzuri/node_modules/` に依存が無い場合、`preview` は
  `.github/tsuzuri/package-lock.json` のとおりに依存をインストールします。
- `preview` は、リポジトリにコピー済みのビルドスクリプトと設定ファイルで
  ビルドし、出力先を `http://localhost:4000/` で配信します。
- ファイルを保存すると、`preview` は自動でビルドし直し、開いているページを
  再読み込みします。
- `--port <number>` はポート番号、`--no-watch` は自動の再ビルドの停止、
  `--open` はブラウザの起動のオプションです。
- 終了は Ctrl+C です。

### 9.2 手動のビルド

`preview` を使わない場合の流れは次のとおりです。

```
npm ci --prefix .github/tsuzuri --ignore-scripts
node .github/tsuzuri/build-docs.mjs
```

- 1 行目は依存のインストール、2 行目はビルドです。
- 手元のビルドは、`.github/docs-pages.config` を自動で読みます。
- 環境変数で渡したキーは、設定ファイルより優先されます
  (例: `THEME=nineties node .github/tsuzuri/build-docs.mjs`)。
- 出力先のファイルは、ファイルとして直接開くとリンクが切れます。簡易サーバーで
  配信すると開けます(例: `npx serve _site`)。

### 9.3 作られるファイル

- 出力先(既定は `_site/`)が作られます。出力先には `.tsuzuri-build` という
  目印のファイルが置かれ、次のビルドの前に出力先の中身はすべて消されます。
- `.github/tsuzuri/node_modules/` が作られます。`.github/tsuzuri/.gitignore` に
  より、git の対象から外れています。
- `init` はリポジトリの直下の `.gitignore` を変更しないので、`.gitignore` に
  `_site/` が無いリポジトリでは、出力先が git の未追跡ファイルとして現れます。

### 9.4 公開されるサイトとの違い

- 手元のビルドでは、URL の先頭のパス(`/<repo>`)が付きません。
- 手元のビルドでは、`sitemap.xml`、`robots.txt`、正規の URL のタグは
  出力されません。
- 手元のビルドでは、`SITE_NAME` を省略した場合のサイト名は空になります。

## 10. 更新

`init` を済ませたリポジトリで、利用者は次のコマンドで Tsuzuri を更新できます。

```
npx github:akilasatolu/tsuzuri#v1 init --update
```

- 質問と上書きの確認はありません。
- `.github/workflows/docs-pages.yml` と、`.github/tsuzuri/` の中の
  ビルドスクリプト、テーマの CSS、`package.json`、`package-lock.json`、
  `.gitignore` が、実行したバージョンの内容で上書きされます。
- `.github/tsuzuri/lib/` の中で、実行したバージョンに無い `.mjs` ファイルは
  削除されます。
- `.github/docs-pages.config` と `.github/tsuzuri/styles/custom.css` は
  変更されません。
- 設定ファイルに無いキーがある場合、`init` はそのキーの名前を表示します。
- `.github/docs-pages.config` が無いリポジトリでは、`init` は何も書き込まずに
  エラーで終了します。
- 更新のあと、変更されたファイルをコミットして push すると、サイトに
  反映されます。

リポジトリにコピー済みのバージョンは、`.github/workflows/docs-pages.yml` の
先頭のコメントに、`tsuzuri v1.30.4` の形で書かれています。更新しない限り、
リポジトリの中のバージョンは変わりません。

## 11. つまずきやすい点

- 症状: ワークフローは成功しますが、サイトが公開されません。
  原因: Settings > Pages の Source が「GitHub Actions」になっていません。
  症状が出ない条件: Source が「GitHub Actions」になっています。
- 症状: デプロイのジョブが次のエラーで失敗します。
  `Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.`
  原因: `TRIGGER_BRANCH` が既定ブランチ以外で、`github-pages` 環境が
  そのブランチからのデプロイを許可していません。
  症状が出ない条件: Settings > Environments > github-pages の
  Deployment branches and tags に、そのブランチが登録されています。
- 症状: push しても、サイトが更新されません。
  原因: push されたブランチが `TRIGGER_BRANCH` と違います。この場合、
  ビルドもデプロイも行われません(8.3)。
  症状が出ない条件: push されたブランチが `TRIGGER_BRANCH` と同じです。
- 症状: ビルドが次のエラーで終了します。
  `起点となる README.md(または README.en.md)が見つかりません。処理を中止します。`
  原因: `ROOT_MD` のファイルがリポジトリにありません。
  症状が出ない条件: `ROOT_MD` のファイルが、そのブランチにコミットされています。
- 症状: README が日本語なのに、「Menu」などの画面の文言が英語になります。
  原因: `LANGUAGES` が省略されているか、先頭が `en` です。
  症状が出ない条件: `LANGUAGES` の先頭が `ja` です。
- 症状: ナビ、検索、目次が表示されません。
  原因: `NAV_ENABLED` が省略されているか、`false` です。
  症状が出ない条件: `NAV_ENABLED=true` です。
- 症状: 設定ファイルに書いた値が効きません。
  原因: 値の後ろに `# comment` が書かれていて、値の一部として読まれています。
  症状が出ない条件: コメントが、値とは別の行に書かれています。
- 症状: 作った Markdown がサイトにありません。
  原因: そのファイルが、起点からリンクでたどれません。
  症状が出ない条件: サイトに含まれているページから、そのファイルへの
  リンクがあります。
- 症状: 公開したくない翻訳のファイルが公開されます。
  原因: 多言語のサイトでは、集めたページの別の言語版が、リンクが無くても
  自動で集められます。
  症状が出ない条件: そのファイルがリポジトリにありません。
- 症状: リンク切れのあるサイトが公開されます。
  原因: `STRICT_LINKS` が `false` です。この場合、リンク切れは警告だけです。
  症状が出ない条件: `STRICT_LINKS=true` です。この場合、ビルドは次の表示を
  出して失敗し、サイトは前回の内容のままになります。
  `STRICT_LINKS=true のため、リンクの問題 3 件でビルドを失敗させます。`
- 症状: `.github/tsuzuri/` の中のファイルへの変更が、更新のあとに消えます。
  原因: `init --update` が、ビルドスクリプトとテーマの CSS を上書きします。
  症状が出ない条件: 見た目の変更が、`STYLE_FILE` の独自 CSS に書かれています。
- 症状: リリースされていない動きをするバージョンが実行されます。
  原因: コマンドに `#v1` が無く、`main` ブランチの内容が実行されています。
  症状が出ない条件: コマンドに `#v1` か、完全なバージョンのタグが付いています。
- 症状: `preview` が次の表示を含むエラーで終了します。
  `ポート 4000 は使用中です。`
  原因: ほかのプログラムが同じポートを使っています。
  症状が出ない条件: `--port` オプションで、空いているポート番号が
  指定されています。

## 12. 詳しい情報の場所

各項目の詳しい説明は、次の URL にあります。

- 導入の手順: https://akilasatolu.github.io/tsuzuri/ja/docs/getting-started.html
- 仕組み: https://akilasatolu.github.io/tsuzuri/ja/docs/concepts.html
- 設定キー: https://akilasatolu.github.io/tsuzuri/ja/docs/configuration.html
- テーマと独自 CSS: https://akilasatolu.github.io/tsuzuri/ja/docs/theming.html
- テーマの見本: https://akilasatolu.github.io/tsuzuri/ja/docs/gallery.html
- frontmatter: https://akilasatolu.github.io/tsuzuri/ja/docs/frontmatter.html
- 多言語のサイト: https://akilasatolu.github.io/tsuzuri/ja/docs/i18n.html
- コマンド: https://akilasatolu.github.io/tsuzuri/ja/docs/cli.html
- デプロイ: https://akilasatolu.github.io/tsuzuri/ja/docs/deployment.html
- 使用例: https://akilasatolu.github.io/tsuzuri/ja/docs/examples.html
- よくある質問: https://akilasatolu.github.io/tsuzuri/ja/docs/faq.html
- リリースの一覧: https://github.com/akilasatolu/tsuzuri/releases
````
