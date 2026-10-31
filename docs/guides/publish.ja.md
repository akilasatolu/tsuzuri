---
title: 公開の設定
description: サイトを公開するブランチ・独自ドメイン・手動実行を設定する
order: 40
---

# 公開の設定

## 自己完結型のワークフロー

`npx github:akilasatolu/tsuzuri#v1 init`を実行すると、次のファイルが利用者リポジトリに
生成されます。

```
利用者リポジトリ
.github/workflows/tsuzuri-pages.yml  … ビルド・デプロイの手順一式(自己完結)
.github/tsuzuri/config               … 動作をカスタマイズする設定ファイル(利用者が編集する)
.github/tsuzuri/build-docs.mjs       … ビルド本体のスクリプト(コピー済み)
.github/tsuzuri/lib/*.mjs            … ビルド本体が依存するモジュール一式(コピー済み)
.github/tsuzuri/styles/base.css      … ベースCSS(コピー済み)
.github/tsuzuri/styles/default.css   … 標準のカスタムスタイル(コピー済み。自分で足すカスタムスタイルはこの隣に置く)
.github/tsuzuri/package.json         … ビルド用の依存(marked など)の版
.github/tsuzuri/package-lock.json    … 同上(ダウンロードした中身を確かめるハッシュを含む)
.github/tsuzuri/.gitignore           … 手元でインストールした依存(node_modules/)をコミットしないための設定
```

以前のバージョンでは、利用者側のワークフローのファイルはOSS本体リポジトリ(tsuzuri)の
再利用可能ワークフロー(`build.yml`)を`uses:`で呼び出すだけの薄いラッパーで、
実際のビルドスクリプトはワークフロー実行のたびにOSS本体リポジトリから取得していました。
現在は`init`実行時にビルドスクリプト本体を`.github/tsuzuri/`配下へコピー(ベンダリング)
するようになったため、**生成後のワークフローはOSS本体リポジトリに一切依存せず、
利用者リポジトリの中だけでビルド・デプロイが完結します**。ネットワーク越しにOSS本体
リポジトリを参照する処理(第2の`checkout`など)は行われません。

- **`tsuzuri-pages.yml`**: 設定ファイルの読み込み、`TRIGGER_BRANCH`との比較、
  `BASE_PATH`/`SITE_ORIGIN`の算出、実際のビルド(`.github/tsuzuri/build-docs.mjs`実行)、
  GitHub Pagesへのデプロイまで、すべての処理はこのファイル自身に書かれています。
  利用者はこのファイルを直接編集することはなく、`.github/tsuzuri/config`の値を
  変更することで動作をカスタマイズします。
- **`.github/tsuzuri/`配下**: ビルドスクリプト本体と、利用者が編集するファイルがあります。
  編集してよいのは、設定ファイル`config`と、`styles/`に置く自分のカスタムスタイル
  だけです。`base.css`・`default.css`とスクリプトは編集しないでください(削除・改変すると
  ビルドが失敗することがあります)。

## トリガーブランチの変更

デプロイを実行するブランチを変えたい場合は、ワークフローファイルではなく
`.github/tsuzuri/config`の`TRIGGER_BRANCH`キーを書き換えるだけで完結します。

```
TRIGGER_BRANCH=release
```

このように書き換えて、そのブランチへpushすれば、以後はそのブランチへのpushだけが
デプロイのトリガーになります(`TRIGGER_BRANCH`以外へのpushでもワークフロー自体は起動しますが、
`should_deploy=false`と判定され、ビルド(リンク切れの検査を含む)とデプロイジョブはスキップされます。詳細は
[faq.md](../faq.ja.md)の「デプロイが実行されない」を参照)。

### 既定ブランチ以外をトリガーブランチにする場合(追加設定が必要)

`TRIGGER_BRANCH`にリポジトリの**既定ブランチ(通常は`main`)以外**を指定した場合は、
`TRIGGER_BRANCH`の書き換えだけでは足りません。GitHub Pagesの公開先である
`github-pages`環境は、初期状態では既定ブランチからのデプロイしか許可していないためです。
このままpushすると、デプロイジョブが次のようなエラーで失敗します。

```
Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.
```

次の手順で、トリガーブランチからのデプロイを許可してください(最初の1回だけ)。

1. リポジトリの `Settings` タブを開く
2. 左メニューの `Environments` を選び、`github-pages` を開く
3. `Deployment branches and tags` の一覧で `Add deployment branch or tag rule` を押す
4. `Ref type` は `Branch` のまま、`Name pattern` にトリガーブランチ名(例: `docs`)を入力して追加する

`github-pages`環境は、`Settings > Pages`の`Source`を`GitHub Actions`にした時点で
自動的に作成されます。一覧に見当たらない場合は、先にPagesの設定を済ませてください。

あわせて、次の点にも注意してください。

- **ワークフローファイルもトリガーブランチに置く**: GitHub Actionsはpushされたブランチにある
  ワークフローファイルを実行します。`.github/workflows/tsuzuri-pages.yml`と
  `.github/tsuzuri/`(`config`を含む)は、トリガーブランチにコミットしてください。
- **手動実行ボタンは表示されない**: Actionsタブの「Run workflow」ボタンは、ワークフローファイルが
  既定ブランチにある場合にしか表示されません。トリガーブランチにだけ置いた場合は、
  そのブランチへのpushでデプロイしてください。

## カスタムドメインの設定

独自ドメインでサイトを公開したい場合は、`.github/tsuzuri/config`の`CUSTOM_DOMAIN`に
ドメイン名(スキームなし。例: `docs.example.com`)を設定します。

```
CUSTOM_DOMAIN=docs.example.com
```

これを設定すると、ビルド時に出力ディレクトリ直下へ`CNAME`ファイルが自動生成されます。
また、内部的な`SITE_ORIGIN`(OGPの絶対URL等に使われるサイトの基点URL)の算出方法も
変わり、`BASE_PATH`は空文字(ドメイン直下に配置)、`SITE_ORIGIN`は
`https://<CUSTOM_DOMAIN>`になります。カスタムドメイン設定後にGitHub側のDNS設定
(CNAMEレコードの登録など)が別途必要になる点は、GitHub Pages自体の標準的な手順に
従ってください。

## 手動実行(workflow_dispatch)

リポジトリのActionsタブから、`Tsuzuri: Deploy to GitHub Pages`ワークフローを選び、
「Run workflow」ボタンで手動実行することもできます(`workflow_dispatch`トリガー)。
手動実行の場合は、現在のブランチが`TRIGGER_BRANCH`と一致しているかどうかの判定
そのものがスキップされ、常にデプロイが実行されます。設定を変えずにトリガーブランチの内容を
デプロイし直したいときに使います。

実行するブランチは、「Run workflow」で選んだブランチです。トリガーブランチ以外を選ぶと、
`github-pages`環境で許可されていないブランチならデプロイが失敗し、許可されているブランチなら
公開中のサイトがそのブランチの内容で上書きされるので注意してください。

## 次に読む

- [見た目を変える](./style.ja.md): ギャラリーでスタイルを選ぶ。
- [更新する](./update.ja.md): コマンド1つでTsuzuriを最新にする。
