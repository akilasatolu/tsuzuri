---
title: 手元で確認する
description: pushする前に、自分のパソコンで見た目とリンク切れを確かめる
order: 20
---

# 手元で確認する

pushする前に、コマンド1つで、自分のパソコンで見た目とリンク切れを確かめられます。

pushしてGitHub Actionsを待たなくても、手元で同じビルドを実行して見た目やリンク切れを確認できます
(Node.js 20以上が必要です)。リポジトリの直下で、次のコマンドを実行するのがいちばん簡単です(v1.5.0以降)。

```sh
npx github:akilasatolu/tsuzuri#v1 preview
```

ビルドが終わると`http://localhost:4000/`でサイトを開けます(詳しくは[CLIリファレンス](reference/cli.ja.md#手元で確認するpreview))。

`preview`を使わずに、手動で同じことをする場合は次の順に実行します。

1. ビルドに使う依存を`.github/tsuzuri/`にインストールします。`.github/tsuzuri/package-lock.json`の
   とおりに入るので、ワークフローと同じ版になります(v1.7.0以降)。

   ```sh
   npm ci --prefix .github/tsuzuri --ignore-scripts
   ```

   `.github/tsuzuri/package-lock.json`が無い(古い版で`init`した)リポジトリでは、先に
   `npx github:akilasatolu/tsuzuri#v1 init --update`で更新してください。

   インストール先の`.github/tsuzuri/node_modules/`は、`init`が生成する`.github/tsuzuri/.gitignore`に
   よってコミットの対象外になっています。

2. ビルドします。`.github/tsuzuri/config`の設定がそのまま使われるので、公開サイトと同じ
   見た目で確認できます。

   ```sh
   node .github/tsuzuri/build-docs.mjs
   ```

   試しに設定を変えたいときは、`THEME=glass.css node .github/tsuzuri/build-docs.mjs`のように
   環境変数で渡すと、そのキーだけ設定ファイルより優先されます。

   > [!NOTE]
   > 設定ファイルを自動で読むのはv1.4.0以降です。それより前のバージョンでは、設定ファイルの値を
   > 環境変数で渡してください(例: `STYLE_DIR=.github/tsuzuri/styles NAV_ENABLED=true node .github/tsuzuri/build-docs.mjs`)。
   > リポジトリにコピー済みのバージョンは、`.github/workflows/tsuzuri-pages.yml`の先頭のコメント
   > (`# tsuzuri v1.37.0 generated this …`。v1.36.0までは`# tsuzuri v1.4.0 の …`)で確認できます。古い場合は`init --update`で更新できます
   > ([CLIリファレンス](reference/cli.ja.md)参照)。

3. できあがった`_site/`を簡易サーバーで開きます(ファイルを直接開くとリンクが切れます)。

   ```sh
   npx serve _site
   ```

   `http://localhost:3000/`などで確認できます。確認が終わったら`_site/`は削除して構いません。
   v1.5.0以降は、ビルドの前に前回の出力が自動で消されます(それより前のバージョンでは、ページを
   削除・改名したときは`_site/`を消してからビルドし直してください)。
   `_site/`を誤ってコミットしないよう、リポジトリの`.gitignore`に次の1行を追加しておくと安心です。

   ```
   _site/
   ```

## 次に読む

- [公開の設定](./guides/publish.ja.md): サイトを公開するブランチを決める。
- [見た目を変える](./guides/style.ja.md): ギャラリーでスタイルを選ぶ。
