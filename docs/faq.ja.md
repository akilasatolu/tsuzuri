---
title: FAQ
description: Tsuzuriの導入や実行でよくある困りごとへの答え
order: 60
---

# FAQ

## デプロイが実行されない

まず、pushしたブランチ名が`.github/tsuzuri/config`の`TRIGGER_BRANCH`と
一致しているか確認してください。ワークフロー自体はどのブランチへのpushでも起動しますが、
ブランチ名が一致しない場合は内部的に`should_deploy=false`という値が記録され、
ビルド(依存のインストールやリンク切れの検査を含む)と、
後続のデプロイジョブ(実際にGitHub Pagesへ公開する処理)そのものがスキップされます。
リポジトリのActionsタブでワークフローの実行結果を開き、「Check trigger branch」という
ステップのログに

```
Skipping because this push (feature/foo) is not to TRIGGER_BRANCH=main
```

のようなメッセージが出ていれば、これが原因です。対象ブランチへマージ・pushするか、
`TRIGGER_BRANCH`の値自体を変更してください(手動実行(`workflow_dispatch`)の場合は
この判定自体が行われず常にデプロイされます。詳細は[公開の設定](./guides/publish.ja.md))。

デプロイジョブ自体は起動したのに、次のエラーで失敗している場合は原因が異なります。

```
Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.
```

これは、既定ブランチ以外を`TRIGGER_BRANCH`にしたときに、`github-pages`環境で
そのブランチからのデプロイが許可されていないことが原因です。
[公開の設定](./guides/publish.ja.md)の「既定ブランチ以外をトリガーブランチにする場合」の
手順で許可してください。

## リンク切れの警告が出る

Markdown内でリンクした先のファイルが実際には存在しない場合、ビルドはエラーにはならず、
そのリンクを「見つからなかったリンク」として記録したうえで処理を続けます。
どのリンクが該当するかは、ActionsタブのワークフローのログのBuildステップに、
「Files that links point to were not found: N」「Links ignored for security reasons: N」として、参照元のファイルとともに表示されます。さらに詳しく調べたい場合は、一時的に`SITEMAP_JSON=true`に
してデバッグ用の`sitemap.json`を出力することもできます([ビルドの仕組み](./reference/how-it-works.ja.md)参照)。
リンク切れのまま公開したくない場合は、`STRICT_LINKS=true`にするとビルドを失敗させられます
([設定リファレンス](./reference/configuration.ja.md#strict_links)参照)。

コピーするファイルの一覧にない拡張子のファイル(`src/foo.js`など)へのリンクも、同じように確かめます。
実在すればGitHubへのリンクになり、実在しなければ「リンク先が見つからなかった」リンクとして記録されます。
[ビルドの仕組み](./reference/how-it-works.ja.md)の「コピーされるファイル」を参照してください。

## GitHubへのリンクが開けない(非公開リポジトリ)

サイトにコピーしないファイル(コード・設定ファイル・`LICENSE`など)へのリンクは、GitHub上のそのファイルを指します。
サイトを公開していても、非公開リポジトリのようにリポジトリを見られない閲覧者には、そのリンクは開けません。
そうした閲覧者にも見せたいファイルは、サイトにコピーされる形式(たとえばPDF)にするか、内容をページに
直接書いてください。ビルドがリポジトリのURLを分からないとき(GitHub以外のホストなど)は、警告を出して
サイト内のパスのままリンクするため、こちらも開けません。

## 更新履歴のページを作るには

`CHANGELOG.md`を、READMEなどのページから`[更新履歴](CHANGELOG.md)`のようにリンクします。ほかのMarkdownと同じく
サイトのページになり、ナビや検索にも入ります。

## スタイルが反映されない

見た目が期待通りにならない場合は、以下を順番に確認してください。

1. `THEME`のスペルミス。CSSファイル名でない値(`none`、
   `.github/tsuzuri/styles/glass.css`のようなフォルダを含むパス、`.css`で終わらない名前)を指定すると、
   警告のうえ自動的に`default.css`にフォールバックします([設定リファレンス](./reference/configuration.ja.md))。
2. `THEME`に指定したファイル名のファイルが、`.github/tsuzuri/styles/`の中に実際に存在しているか。
   存在しない場合は警告が出て(`THEME ("…") was not found`)、ベースだけでビルドされます。
   `default.css`以外のカスタムスタイルはパッケージに入っていないので、[ギャラリー](../gallery/README.ja.md)で
   ダウンロードしてください。
3. 2層(ベースCSS→カスタムスタイル)の優先順位。カスタムスタイルはベースの後に
   読み込まれるため、ここに書いたCSSルールが期待通り上書きしているか、
   詳細度(セレクタの強さ)の観点でも確認してください。ページのfrontmatterの`theme`は、
   そのページだけサイト全体のカスタムスタイルを置き換えます。詳しくは
   [見た目を変える](./guides/style.ja.md)を参照してください。

## previewの表示が公開サイトと違う

`preview`は、リポジトリにコピー済みのビルドスクリプト(`.github/tsuzuri/`)と`.github/tsuzuri/config`の
設定でビルドするので、基本的には公開サイトと同じ見た目になります。違う場合は、次を確認してください。

1. **まだpushしていない変更**: 手元の変更は`preview`には反映されますが、公開サイトにはpushするまで反映されません。
2. **ブラウザのキャッシュ**: 公開サイトが古いまま表示されていることがあります。再読み込みしてください。
3. **サイトのURLの違い**: 公開サイトは`https://<owner>.github.io/<repo>/`のようにパスが付き、`preview`は
   `http://localhost:4000/`で開きます。リンクは自動で合わせるので通常は問題ありませんが、Markdownに
   `https://<owner>.github.io/<repo>/...`のような公開サイトの完全なURLを書いた場合は、公開サイトへ移動します。

## previewで「Port 4000 is in use」と出る

(`--lang ja`のときは日本語で、「ポート 4000 は使用中です」と出ます。)
別のアプリ(または別の`preview`)が同じポートを使っています。`--port 4001`のように別の番号を
指定してください([CLIリファレンス](reference/cli.ja.md#手元で確認するpreview))。

## npx実行時にキャッシュが古い

`npx github:akilasatolu/tsuzuri#v1 init`を実行した際に、最新の変更が反映されていない
(修正したはずの挙動が変わらない)場合は、`npx`側またはgit側のキャッシュが古いバージョンを
再利用している可能性があります。実行時の最初の行に表示されるバージョン(`tsuzuri v1.0.0`など)で、
実際に動いているバージョンを確認できます。古い場合は、次のように完全なバージョン
([リリース一覧](https://github.com/akilasatolu/tsuzuri/releases)にある最新のもの)を指定して
実行してみてください。

```
npx github:akilasatolu/tsuzuri#v<最新のバージョン> init --update
```

これでも解消しない場合は、ローカル環境の`npx`のキャッシュを一度クリアしてから
再実行することも検討してください。

## カスタムドメインにしたらページが崩れた

`CUSTOM_DOMAIN`を設定すると、内部的な`BASE_PATH`(サイト内リンクの先頭に付与される
パス)が空文字に、`SITE_ORIGIN`(絶対URLの基点)が`https://<CUSTOM_DOMAIN>`に
それぞれ切り替わります。カスタムドメイン移行前後でこの値が変わるため、
画像やCSSが読み込めない・リンクが二重にパスを含んでいるといった崩れが起きた場合は、
まずビルドが正しい`CUSTOM_DOMAIN`の値を認識しているか(ホスト名として妥当な形式に
なっているか。スキームやパスを含めると無効な値として空文字にフォールバックします)、
`SITEMAP_JSON=true`で出力した`sitemap.json`の`customDomain`/`siteOrigin`の値を確認してください。詳細は
[公開の設定](./guides/publish.ja.md)の「カスタムドメインの設定」を参照してください。

## `llms.txt`を作りたくない・自分で書いたものを使いたい

`llms.txt`は、GitHub Actionsでビルドすると既定で出力されます。止めるには、
`.github/tsuzuri/config`に`LLMS_TXT=false`と書きます。自分で書いたものを使うには、
リポジトリの直下に`llms.txt`を置きます。それがそのままサイトにコピーされ、自動では作られません。
シンボリックリンクや、通常のファイルでないものは使われません(警告が表示され、コピーも自動生成もされません)。
詳しくは[ビルドの仕組み](./reference/how-it-works.ja.md)の「llms.txt」を参照してください。

## Markdownに書いたHTMLはそのまま出力される?

はい。Markdownの中に書いたHTML(`<div>`・`<script>`など)や、`javascript:`で始まるリンクは、
無害化されずにそのまま生成されたページに出力されます。Tsuzuriは「自分のリポジトリの内容を
自分のサイトとして公開する」ためのツールで、Markdownを書く人をサイトの持ち主と同じく信頼する
前提だからです。

ほかの人からのプルリクエストでMarkdownを受け取る場合は、マージする前に、意図しない
`<script>`やリンクが含まれていないか確認してください。

