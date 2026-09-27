---
title: FAQ
---

# FAQ

## デプロイが実行されない

まず、pushしたブランチ名が`.github/docs-pages.config`の`TRIGGER_BRANCH`と
一致しているか確認してください。ビルドジョブ自体はどのブランチへのpushでも実行されますが、
ブランチ名が一致しない場合は内部的に`should_deploy=false`という値が記録され、
後続のデプロイジョブ(実際にGitHub Pagesへ公開する処理)そのものがスキップされます。
リポジトリのActionsタブでワークフローの実行結果を開き、「Check trigger branch」という
ステップのログに

```
TRIGGER_BRANCH=main ではない push (feature/foo) のためスキップします
```

のようなメッセージが出ていれば、これが原因です。対象ブランチへマージ・pushするか、
`TRIGGER_BRANCH`の値自体を変更してください(手動実行(`workflow_dispatch`)の場合は
この判定自体が行われず常にデプロイされます。詳細は[deployment.md](./deployment.md))。

デプロイジョブ自体は起動したのに、次のエラーで失敗している場合は原因が異なります。

```
Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.
```

これは、既定ブランチ以外を`TRIGGER_BRANCH`にしたときに、`github-pages`環境で
そのブランチからのデプロイが許可されていないことが原因です。
[デプロイ設定](./deployment.md)の「既定ブランチ以外をトリガーブランチにする場合」の
手順で許可してください。

## リンク切れの警告が出る

Markdown内でリンクした先のファイルが実際には存在しない場合、ビルドはエラーにはならず、
そのリンクを「見つからなかったリンク」として記録したうえで処理を続けます。
どのリンクが該当するかは、ActionsタブのワークフローのログのBuildステップに、
「リンク先が見つからなかったファイル」「セキュリティ上の理由で無視されたリンク」として
参照元のファイルとともに表示されます。さらに詳しく調べたい場合は、一時的に`SITEMAP_JSON=true`に
してデバッグ用の`sitemap.json`を出力することもできます([concepts.md](./concepts.md)参照)。
リンク切れのまま公開したくない場合は、`STRICT_LINKS=true`にするとビルドを失敗させられます
([configuration.md](./configuration.md#strict_links)参照)。

## スタイルが反映されない

見た目が期待通りにならない場合は、以下を順番に確認してください。

1. `THEME`のスペルミス。存在しないテーマ名(例: `sepia`)を指定すると警告のうえ
   自動的に`wa`にフォールバックします([configuration.md](./configuration.md))。
2. `STYLE_FILE`に指定したパスに、実際にファイルが存在しているか。存在しない場合は
   警告は出ず(ビルドのログに`Custom style file not used`と出るだけで)、独自CSSは反映されません。
3. 3層カスケード(基礎CSS→THEME→STYLE_FILE)の優先順位。`STYLE_FILE`は最後に
   読み込まれる最優先層のため、ここに書いたCSSルールが期待通り上書きしているか、
   詳細度(セレクタの強さ)の観点でも確認してください。詳しくは
   [theming.md](./theming.md)を参照してください。

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
[deployment.md](./deployment.md)の「カスタムドメインの設定」を参照してください。

## Markdownに書いたHTMLはそのまま出力される?

はい。Markdownの中に書いたHTML(`<div>`・`<script>`など)や、`javascript:`で始まるリンクは、
無害化されずにそのまま生成されたページに出力されます。Tsuzuriは「自分のリポジトリの内容を
自分のサイトとして公開する」ためのツールで、Markdownを書く人をサイトの持ち主と同じく信頼する
前提だからです。

ほかの人からのプルリクエストでMarkdownを受け取る場合は、マージする前に、意図しない
`<script>`やリンクが含まれていないか確認してください。

