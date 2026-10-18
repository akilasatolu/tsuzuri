# Tsuzuri のメンテナンス
[English](MAINTAINING.md) | 日本語

この文書は、`main` に push できる人のためのものです。`docs` ブランチの同期、PR のレビュー、依存パッケージの更新、リリースの手順をまとめています。貢献者は読まなくてかまいません。貢献の手順は [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) を見てください。

## ブランチと docs への同期

`main`(Tsuzuri 本体)と `docs`(利用者向けサイト)は、履歴を共有しない独立したブランチです。**互いにマージしないでください。**

`main` への push で CI が成功するたびに、`.github/workflows/sync-docs.yml` が、そのコミットの Tsuzuri で `docs` ブランチに `init --update` を実行し、変更があれば `docs` へ push します。その push で、`docs` にだけある `docs-pages.yml` が動き、サイトが公開し直されます。

```
push to main → CI passes → sync-docs.yml → push to docs → docs-pages.yml → GitHub Pages
```

- 更新されるのは、`docs` の `.github/workflows/docs-pages.yml` と `.github/tsuzuri/` 配下だけです。`.github/docs-pages.config`・独自 CSS・README・`docs/` は変更されません。更新されるファイルは、手で編集しないでください。
- CI が失敗したときや、PR の CI では動きません。反映する変更が無いときはコミットしません。
- `docs` への手動の push と重なったときは、`git pull --rebase` してから push し直してください。
- 利用者向けドキュメントの修正は、`main` ではなく `docs` への PR で行います。

## リポジトリの初期設定(1 回だけ)

リポジトリを作ったときに、1 回だけ行います。

**`docs` ブランチの公開設定。** `docs` は `TRIGGER_BRANCH=docs` で公開しています。既定ブランチ以外からのデプロイになるため、GitHub 側で次の 2 つの設定が必要です。

1. `Settings > Pages` の `Source` を `GitHub Actions` にする(`github-pages` 環境が作成される)。
2. `Settings > Environments > github-pages` の `Deployment branches and tags` に `docs` を追加する。

2 を忘れると、デプロイのジョブが `Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.` で失敗します。また、`docs-pages.yml` は `docs` にしか無いため、Actions タブに「Run workflow」ボタンは表示されません。`docs` への push でデプロイしてください。

**`sync-docs.yml` 用のデプロイキー。** `docs` への push に、既定の `GITHUB_TOKEN` は使えません。そのトークンで push すると、`docs-pages.yml` が起動しないためです。書き込み権限付きのデプロイキーを使います。

1. パスフレーズなしで鍵ペアを作る。

   ```sh
   ssh-keygen -t ed25519 -C "tsuzuri docs sync" -N "" -f tsuzuri_docs_deploy_key
   ```

2. 公開鍵を登録する: `Settings > Deploy keys > Add deploy key`。Title は `docs sync`(任意)、Key は `tsuzuri_docs_deploy_key.pub` の中身で、**`Allow write access` にチェックを入れる**。
3. 秘密鍵を Secret に登録する: `Settings > Secrets and variables > Actions > New repository secret`。Name は `DOCS_DEPLOY_KEY`、Secret は `tsuzuri_docs_deploy_key`(`.pub` ではない方)の中身。
4. 手元の鍵ファイルを削除する。

   ```sh
   rm tsuzuri_docs_deploy_key tsuzuri_docs_deploy_key.pub
   ```

鍵を登録していないと、`sync-docs.yml` は `docs` の checkout で失敗します。`main` の CI と公開済みのサイトには影響しません。

## PR のレビューとマージ

- CI(`.github/workflows/ci.yml`)が通っていること。
- PR が `test/fixtures/golden/` を保存し直しているときは、差分を読み、意図した変更だけであることを確かめる。CSS が変わると CSS のファイル名(`tsuzuri-<ハッシュ>.css`)も変わるのは正常です。
- PR が MIT ライセンスでの提供に同意していること(テンプレートのチェック項目)。
- `CHANGELOG.md` は PR では書きません。リリースのときにメンテナーが書きます(「リリース」を参照)。
- Dependabot の PR は、自動マージを有効にしないでください(下を参照)。

## 依存パッケージの更新

Dependabot が週 1 回、`package.json` の依存パッケージ、ワークフローの GitHub Actions、`deps/mermaid/package.json` の mermaid の版の更新 PR を作ります。ここで入れた版は `init` を通して利用者にも配られるため、汚染された版が混ざると利用者にも届きます。次の対策をしています。

- **公開から 30 日たった安定版だけを取り込む**: `.github/dependabot.yml` の `cooldown`。alpha・beta・rc などのプレリリース版の PR は作られません(依存にプレリリース版を書かないでください)。セキュリティ更新は待たされません。
- **インストールスクリプトを実行しない**: `.npmrc` の `ignore-scripts=true` と、CI の `npm ci --ignore-scripts`。生成されるワークフローと `preview` も `--ignore-scripts` でインストールします。
- **署名を確認する**: CI の `npm audit signatures`。
- **自動マージしない。** Dependabot の PR をマージする前に、変更された版とそのリリースノートを確認し、`package-lock.json` の差分に見覚えのない依存が増えていないことと、CI がすべて通っていることを確かめる。

**ビルド用の依存**(`marked`・`highlight.js`・`marked-footnote`。`bin/cli.mjs` の `BUILD_DEPENDENCIES`)は、利用者のワークフローでもインストールされます。これらの版は `package.json` に `12.0.2` のような完全一致で書いてください。範囲指定だと `scripts/build-lockfiles.mjs` とそのテストがエラーになります。`templates/tsuzuri/package.json` と `package-lock.json` は、ルートの lockfile から作ってコミットしてある完成品です(npm はパッケージを作るときにルートの `package-lock.json` を外すので、`init` はこれをコピーします)。PR がこれらの依存やその依存を更新するときは、同じ PR で完成品も作り直してください。作り直さないと、`test/cli.test.mjs` の、コミットしてある完成品と作り直したものを比べるテストが失敗します。

1. 更新 PR のブランチを手元に取り込む(例: `git fetch origin` のあと `git switch <ブランチ>`)。
2. `node scripts/build-lockfiles.mjs` を実行する(インストールは不要)。
3. `templates/tsuzuri/` の差分が、更新した版とハッシュだけであることを確かめる。
4. コミットして PR のブランチに push する。人が push した PR は、Dependabot が自動では作り直さなくなります。作り直してほしいときは、PR に `@dependabot recreate` とコメントしてから、この手順をやり直します。

開発用の依存(ESLint など)だけを更新する PR では、これらのファイルは変わりません。

**`gemoji`** は、絵文字のショートコードの表 `.github/scripts/lib/emoji-data.mjs` を作るための開発用の依存です(表はコミット済みで、手で編集しません。利用者には配りません)。`gemoji` を更新するときは、同じ PR で表も作り直してください。作り直さないと `test/emoji.test.mjs` が失敗します。

1. 更新 PR のブランチを手元に取り込み、`npm ci` を実行する。
2. `node scripts/build-emoji-data.mjs` を実行する。
3. `emoji-data.mjs` の差分が、絵文字の追加・変更・削除だけであることを確かめる。
4. コミットして push する(`@dependabot recreate` の扱いは上と同じ)。

**GitHub Actions。** `init` が生成するワークフローは `templates/.github/workflows/docs-pages.yml` のひな形から作られ、その中の action も Dependabot が更新します。`ci.yml`・`sync-docs.yml`・ひな形で同じ action の版がずれるとテストが失敗するので、片方だけ更新されたら、ほかも合わせてください。

**mermaid。** 生成ページが CDN から読み込む版は、`.github/scripts/lib/html-renderer.mjs` の `MERMAID_VERSION` です。`deps/mermaid/package.json` は Dependabot に監視させるために同じ版を書いているだけです(インストールはしません)。このファイルの更新 PR が来たら、同じ PR で次を行います。

1. `MERMAID_VERSION` を同じ版にする。
2. `node scripts/mermaid-integrity.mjs` が表示するハッシュを `MERMAID_INTEGRITY` に書く。生成ページは、このハッシュと一致しないファイルを実行しません。一致は CI の `verify-cdn` が確認します。

## リリース

バージョン番号は [Semantic Versioning](https://semver.org/lang/ja/) に従います。タグは次の 2 種類を `main` のコミットに付けます。

- `vX.Y.Z`(例: `v1.0.0`): そのリリースを指す固定のタグ。以後は動かさない。
- `vX`(例: `v1`): 同じメジャーバージョンの最新リリースを指すタグ。リリースのたびに `release.yml` が付け替える。利用者は `npx github:akilasatolu/tsuzuri#v1 init` で、互換性を保ったまま最新版を使える。破壊的変更を含むリリースでは、新しいメジャー(`v2`)を作る。

手順:

1. `main` で `npm test` と `npm run lint` が通り、CI が成功していることを確認する。
2. `node scripts/check-package.mjs` を実行する。利用者が受け取るのと同じ、パッケージにまとめた中身を確かめる(内容はスクリプトの先頭のコメントを参照)。`init --update` が設定ファイルと独自 CSS(`.github/tsuzuri/styles/custom.css`)を保持することも含まれる。
3. タグを付ける前に `CHANGELOG.md` を書く。`[Unreleased]` に、前回のタグから今回までの利用者に見える変更をまとめる(材料は、マージした PR と `git log v<前回の版>..main`。`v<前回の版>` の部分は前回のリリースのタグにする)。カテゴリは `CHANGELOG.md` の冒頭の説明に従う。見出しを `## [X.Y.Z] - YYYY-MM-DD` に改め、その上に空の `[Unreleased]` を追加する。`scripts/release-notes.mjs` は `## [X.Y.Z]` の節が無い、または空のときにエラーで止まり、`release.yml` はタグの push のあとにこれを実行する。
4. `package.json` と `package-lock.json` の `version` を `X.Y.Z` にする(先頭の `version` と `packages[""].version`。依存パッケージの版は変えない)。
5. コミットして `main` に push し、タグを付けて push する。

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

6. タグの push で `.github/workflows/release.yml` が動く。Actions タブで結果を確認する。行うことは次のとおり。
   - タグと `package.json` の `version` が一致し、タグのコミットが `main` にあることの確認
   - `CHANGELOG.md` の該当する節から GitHub の Release を作成(`scripts/release-notes.mjs`)
   - メジャーバージョンのタグ(`vX`)をこのコミットに付け替え

   手元の `vX` タグは古いままです。必要なら `git fetch --tags --force` で取り込みます。
7. リリースのあと、`docs` のサイトが正しく公開されていることを確認する(CI の成功、`sync-docs.yml`、`docs-pages.yml` の順に動く)。
