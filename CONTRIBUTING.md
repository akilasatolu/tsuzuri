# コントリビューションガイド

このプロジェクト(tsuzuri)への貢献に興味を持っていただきありがとうございます。
このドキュメントでは、開発環境のセットアップ方法とPRを送る際のお願いをまとめています。

## ブランチについて

- **`main`**(既定ブランチ): Tsuzuri本体(CLI・ビルドスクリプト・テーマCSS)の開発ブランチです。
  本体への変更PRは`main`宛てに送ってください。
- **`docs`**: Tsuzuri自身を使って作った利用者向けサイトです。利用者向け
  ドキュメント(`docs/`)の修正PRは`docs`宛てに送ってください。

2つのブランチは履歴を共有しない独立したブランチです。互いにマージしないでください。

## 開発環境のセットアップ

Node.jsがインストールされていれば、以下のコマンドで依存パッケージをインストールできます。

```sh
npm ci
```

`npm install`ではなく`npm ci`を使うことで、`package-lock.json`に記録された
バージョンどおりに依存関係を再現できます。

## テストの実行方法

```sh
npm test
```

内部的には`node --test`が実行され、`test/`配下のテストファイルがすべて実行されます。

### ゴールデンテスト(生成されるサイトの出力の比較)

`test/golden.test.mjs`は、いくつかの設定で作ったサイトの出力(HTML・CSS・スクリプトなど)を
`test/fixtures/golden/`にまるごと保存しておき、今のコードの出力と1文字ずつ比べます。
出力が**意図せず**変わったことに気づくためのテストです。

出力を**意図して**変えたとき(新しい機能・見た目の変更・文言の変更など)は、このテストが落ちます。
そのときは次の手順で保存し直してください。

1. 保存し直す

   ```sh
   UPDATE_GOLDEN=1 node --test test/golden.test.mjs
   ```

2. 差分を確かめる。`git diff test/fixtures/golden/`の変更が、意図した変更だけであることを確認する
   (例: 見出しの見た目を変えたなら CSS だけ、文言を変えたならその文言だけ)。CSS の中身が変わると
   ファイル名(`tsuzuri-<ハッシュ>.css`)も変わるので、各ページの`<link>`の行が変わるのは正常です
3. 保存し直した`test/fixtures/golden/`を、コードの変更と同じPRに入れる。PRの説明に
   「ゴールデンを保存し直した理由」と「差分で何が変わったか」を書き、レビューでも差分を確かめてもらう

テストを通すためだけに保存し直すことはしないでください。意図しない変化を見逃すことになります。

## ESLintの実行方法

```sh
npm run lint
```

コードスタイルのチェックを行います。PRを送る前に、エラーが出ないことを確認してください。

## リポジトリの構成(編集してよい範囲・生成物との境界)

**開発者が編集する「ソース」**

- `bin/cli.mjs` — セットアップCLI本体。ワークフロー・設定ファイル・ベンダリング対象の
  生成ロジックはすべてここにある(利用者が受け取る内容の唯一の正)。
- `.github/scripts/build-docs.mjs` + `.github/scripts/lib/*.mjs` — ビルド本体。
- `styles/*.css` — テーマCSSの原本。
- `test/**` — テスト。`README.md`・本ファイル・`CHANGELOG.md` — 開発者向けドキュメント。
- `.github/workflows/ci.yml` — このリポジトリ自身の開発用CI(後述)。
- `.github/workflows/sync-docs.yml` — CI成功後に`docs`ブランチへ`init --update`を反映するワークフロー(後述)。

利用者向けドキュメント(`docs/**`)は`docs`ブランチにあります。

**「ワークフローの実行物」(利用者リポジトリだけに存在するもの)**

`npx github:akilasatolu/tsuzuri init` を実行すると生成される
`.github/workflows/docs-pages.yml`・`.github/docs-pages.config`・`.github/tsuzuri/`配下は、
**利用者リポジトリのためだけの生成物**です。`main`ブランチにはこれらのファイルを
コミットしないでください(`docs`ブランチには、利用者と同じ手順で生成したものが置かれています)。生成内容の正しさは `test/cli.test.mjs`(生成ロジックの
テスト)と `test/build-docs.e2e.test.mjs`(ビルド本体のE2Eテスト)で検証します。
実機で動作確認したい場合は、別のテスト用リポジトリ(本プロジェクト外)で`init`を
実行してください(詳しくは後述の「リリース手順」)。
(過去にはこのリポジトリのルート直下に生成物の古い例を置いていましたが、実際の
生成テンプレートと乖離して混乱の元になっていたため削除しました。)

**pushしたときに何が起きるか**

| イベント | 起動するワークフロー | 内容 |
|---|---|---|
| `main`へのpush・PR | `ci.yml` | `npm run lint`と`npm test`のみ。権限は`contents: read`だけで、GitHub Pagesには一切触れない |
| `main`へのpushでCIが成功 | `sync-docs.yml` | `docs`ブランチで`init --update`を実行し、変更があれば`docs`へpush(デプロイキーを使用) |
| `docs`へのpush | `docs-pages.yml`(`docs`にのみ存在) | `docs`の利用者向けサイトをビルドし、本リポジトリのGitHub Pagesにデプロイ(自己ドッグフーディング) |

開発中のブランチにpushしても、GitHub Pagesへのデプロイや外部リポジトリへの影響は
発生しません。安心してpush・ワークフロー実行してください。

## PRを送る際のお願い

- 変更はできるだけ小さく分けてください。1つのPRで複数の関心事を混ぜないようにお願いします。
- PRを送る前に、`npm test`と`npm run lint`の両方が通ることを確認してください。
- 変更内容がわかるように、PRの説明には「何を」「なぜ」変更したかを簡潔に書いてください。
- 既存の挙動を変更する場合は、その理由と影響範囲を書いてください。
- ゴールデンテストの保存データ(`test/fixtures/golden/`)を保存し直した場合は、その理由と差分で何が変わったかを書いてください
  ([ゴールデンテスト](#ゴールデンテスト生成されるサイトの出力の比較)参照)。

## ライセンスについて

本プロジェクトはMITライセンスで公開されています。
**PRを送ることで、その変更内容をMITライセンスの下で提供することに同意したものとみなします。**

## リリース手順

バージョン番号は[Semantic Versioning](https://semver.org/lang/ja/)に従います。タグは次の2種類を
`main`ブランチのコミットに付けます。

- `vX.Y.Z`(例: `v1.0.0`): そのリリースを指す固定のタグ。以後は動かさない
- `vX`(例: `v1`): 同じメジャーバージョンの最新リリースを指すタグ。リリースのたびに付け替える
  (`vX.Y.Z`のタグをpushすると`release.yml`が自動で付け替える)
  (利用者は`npx github:akilasatolu/tsuzuri#v1 init`で、互換性を保ったまま最新版を使える)。
  破壊的変更を含むリリースでは新しいメジャー(`v2`)を作る

1. `main`で`npm test`・`npm run lint`が通り、CIが成功していることを確認する
2. 実際の利用と同じ流れが通ることを確認する。CIの`package-check`ジョブが、`node scripts/check-package.mjs`で
   次を自動で確かめる(手元でも同じコマンドで実行できる)
   - `npm pack`で配布物と同じファイルを作り、そこから`npx`と同じ方法(`npm exec`)で`init`を実行して、
     ワークフロー・設定ファイル・`.github/tsuzuri/`(`package.json`・`package-lock.json`を含む)が作られること
     (作業ツリーを直接使うと、npm がパッケージから外すファイル(`package.json`の`files`に無いもの、
     ルートの`package-lock.json`)も見えてしまい、配布物の漏れに気づけないため)
   - 生成されたワークフローと同じく`npm ci --ignore-scripts`で依存を入れ、`STRICT_LINKS=true`でビルドできること
   - 設定ファイルを書き換えてから`init --update`を実行し、設定ファイルが保持されること
3. `CHANGELOG.md`の`[Unreleased]`を`[X.Y.Z] - YYYY-MM-DD`に改め、空の`[Unreleased]`を追加する
4. `package.json`・`package-lock.json`の`version`を`X.Y.Z`にする(依存パッケージの`version`は変えない)
5. コミットして`main`にpushし、`vX.Y.Z`のタグを付けてpushする

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

6. タグのpushで`.github/workflows/release.yml`が動き、次を自動で行う(Actionsタブで結果を確認する)
   - タグと`package.json`の`version`が一致し、タグのコミットが`main`にあることの確認
   - `CHANGELOG.md`の該当する節からGitHubのReleaseを作成(本文は`scripts/release-notes.mjs`で作る)
   - メジャーバージョンのタグ(`vX`)をこのリリースのコミットに付け替える

   手元の`vX`タグは古いままになるので、必要なら`git fetch --tags --force`で取り込む。

実際のGitHub Pagesへの公開と`init --update`による更新は、このリポジトリの`docs`ブランチ
(`main`のCI成功時に`sync-docs.yml`が`init --update`を実行し、Pagesへ公開する)で
継続的に確認されます。リリース後、`docs`のサイトが正しく公開されていることも確認してください。

## 既知の限界

- frontmatterは`key: value`形式のフラットな行だけを読む簡易パーサです(YAMLの配列・入れ子・
  複数行の値には対応していません)。
- mermaidの図は閲覧時にCDN(jsDelivr)から読み込むため、CDNに接続できない環境では図が表示されません
  (図の元のコードが表示されます)。
