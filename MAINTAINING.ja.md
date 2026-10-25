# Tsuzuri のメンテナンス
[English](MAINTAINING.md) | 日本語

この文書は、`main` に push できる人のためのものです。利用者向けドキュメント(`docs/`)の公開、PR のレビュー、依存パッケージの更新、リリースの手順をまとめています。貢献者は読まなくてかまいません。貢献の手順は [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) を見てください。

## ドキュメントサイト

`docs/`(と `README.md`)が、利用者向けサイトの原本です。サイトは Tsuzuri 自身で作っています。`main` にマージすると `.github/workflows/tsuzuri-pages.yml` が動き、サイトが GitHub Pages に公開されます。利用者向けドキュメントの修正も、コードと同じように `main` への PR で行います。

- `.github/tsuzuri/`(ビルドスクリプト、`lib/`、`styles/` の `base.css` と `default.css`、`package.json`・`package-lock.json`、`.gitignore`)と `tsuzuri-pages.yml` は、リリース時の `init --update` だけで変わります(「リリース」を参照)。手で編集しないでください。ただし、action の SHA とバージョンのコメントは例外で、「依存パッケージの更新」の手順で、ほかの 3 ファイルと同時に `tsuzuri-pages.yml` も手で直します。`.github/tsuzuri/config` と、`.github/tsuzuri/styles/` に置いた `default.css` 以外のカスタムスタイル(`tsuzuri.css`、ギャラリーで配るスタイルの `glass.css` ほかと `none.css` など)は、このサイト自身のファイルで、`init --update` では変更されません。ギャラリーで配るカスタムスタイルの CSS は、パッケージには含めて配らないので、手で保守します(`.github/tsuzuri/` を手で編集しないという決まりの例外です)。
- 公開は CI の成功を待ちません。マージ前のサイトの確認は、CI の `docs-build` ジョブ(公開せずにビルドだけ行う)で行います。

## リポジトリの初期設定(1 回だけ)

リポジトリを作ったときに、1 回だけ行います。

**サイトの公開設定。** `Settings > Pages` の `Source` を `GitHub Actions` にします(`github-pages` 環境が作成されます)。`Settings > Environments > github-pages` の `Deployment branches and tags` に規則があって `main` が無いときは、`main` を追加してください。無いと、デプロイのジョブが `Branch "main" is not allowed to deploy to github-pages due to environment protection rules.` で失敗します。

## PR のレビューとマージ

- CI(`.github/workflows/ci.yml`)が通っていること。
- PR が `test/fixtures/golden/` を保存し直しているときは、差分を読み、意図した変更だけであることを確かめる。CSS が変わると CSS のファイル名(`tsuzuri-<ハッシュ>.css`)も変わるのは正常です。
- PR が MIT ライセンスでの提供に同意していること(テンプレートのチェック項目)。
- `CHANGELOG.md` は PR では書きません。リリースのときにメンテナーが、英語と日本語で書きます(「リリース」を参照)。

## 依存パッケージの更新

依存パッケージと GitHub Actions は手で更新します。定期の頻度は決めていません。気が向いたときに確かめ、リリースの前には必ず確かめてください。更新の有無は `npm outdated` で、既知の脆弱性は `npm audit` で見ます。ここで入れた版は `init` を通して利用者にも配られるため、汚染された版が混ざると利用者にも届きます。次の対策をしています。

- **公開から 30 日たった安定版だけを取り込む**(セキュリティ修正は例外): 更新する版は、公開日が 30 日以上前であることを `npm view <名前> time --json` で確かめる。alpha・beta・rc などのプレリリース版は取り込まない(版に `-` を含むものを依存に書かないでください)。
- **インストールスクリプトを実行しない**: `.npmrc` の `ignore-scripts=true` と、CI の `npm ci --ignore-scripts`。生成されるワークフローと `preview` も `--ignore-scripts` でインストールします。
- **署名を確認する**: CI の `npm audit signatures`。
- **マージ前に確認する。** 更新するときも、変更された版とそのリリースノートを確認し、`package-lock.json` の差分に見覚えのない依存が増えていないことと、CI がすべて通っていることを確かめる。

**ビルド用の依存**(`marked`・`highlight.js`・`marked-footnote`。`bin/cli.mjs` の `BUILD_DEPENDENCIES`)は、利用者のワークフローでもインストールされます。これらの版は `package.json` に `12.0.2` のような完全一致で書いてください。範囲指定だと `scripts/build-lockfiles.mjs` とそのテストがエラーになります。`templates/tsuzuri/package.json` と `package-lock.json` は、ルートの lockfile から作ってコミットしてある完成品です(npm はパッケージを作るときにルートの `package-lock.json` を外すので、`init` はこれをコピーします)。PR がこれらの依存やその依存を更新するときは、同じ PR で完成品も作り直してください。作り直さないと、`test/cli.test.mjs` の、コミットしてある完成品と作り直したものを比べるテストが失敗します。

1. 更新用のブランチを作り、`npm install <名前>@<版>` で更新する(版を固定している依存には `--save-exact` を付ける)。
2. `node scripts/build-lockfiles.mjs` を実行する(インストールは不要)。
3. `templates/tsuzuri/` の差分が、更新した版とハッシュだけであることを確かめる。
4. コミットして更新用のブランチに push する。

開発用の依存(ESLint など)だけを更新する PR では、これらのファイルは変わりません。

**`gemoji`** は、絵文字のショートコードの表 `.github/scripts/lib/emoji-data.mjs` を作るための開発用の依存です(表はコミット済みで、手で編集しません。利用者には配りません)。`gemoji` を更新するときは、同じ PR で表も作り直してください。作り直さないと `test/emoji.test.mjs` が失敗します。

1. 更新用のブランチを作り、`npm install gemoji@<版>` と `npm ci` を実行する。
2. `node scripts/build-emoji-data.mjs` を実行する。
3. `emoji-data.mjs` の差分が、絵文字の追加・変更・削除だけであることを確かめる。
4. コミットして push する。

**GitHub Actions。** `init` が生成するワークフローは `templates/.github/workflows/tsuzuri-pages.yml` のひな形から作られます。`ci.yml`(`docs-build` ジョブを含む)・`release.yml`・ひな形・コミット済みの `.github/workflows/tsuzuri-pages.yml` で同じ action の版がずれるとテストが失敗します。action を更新するときは次を行います。

1. 新しい版のタグから、コミットの SHA を調べる。例: `git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1*'`。注釈付きタグは、`^{}` が付いた行の SHA を使う。
2. 4 つのファイルで、古い SHA とバージョンのコメントを新しいものに置き換える。

   ```sh
   sed -i '' 's/<旧SHA> # <旧版>/<新SHA> # <新版>/' .github/workflows/*.yml templates/.github/workflows/*.yml
   ```

   (Linux では `sed -i` に `''` を付けません。)ここで `node bin/cli.mjs init --update` は使わないでください。`.github/tsuzuri/` も、まだリリースしていない `main` の内容で上書きされます。
3. `npm test` を通す。4 つのファイルの食い違いは、このテストが見つけます。

**mermaid。** 生成ページが CDN から読み込む版は、`.github/scripts/lib/html-renderer.mjs` の `MERMAID_VERSION` です。更新するときは次を行います。

1. `MERMAID_VERSION` を新しい版にする(公開から 30 日以上たった安定版だけ)。
2. `node scripts/mermaid-integrity.mjs` が表示するハッシュを `MERMAID_INTEGRITY` に書く。生成ページは、このハッシュと一致しないファイルを実行しません。一致は CI の `verify-cdn` が確認します。

## リリース

バージョン番号は [Semantic Versioning](https://semver.org/lang/ja/) に従います。タグは次の 2 種類を `main` のコミットに付けます。

- `vX.Y.Z`(例: `v1.0.0`): そのリリースを指す固定のタグ。以後は動かさない。
- `vX`(例: `v1`): 同じメジャーバージョンの最新リリースを指すタグ。リリースのたびに `release.yml` が付け替える。利用者は `npx github:akilasatolu/tsuzuri#v1 init` で、互換性を保ったまま最新版を使える。破壊的変更を含むリリースでは、新しいメジャー(`v2`)を作る。

手順:

1. `main` で `npm test` と `npm run lint` が通り、CI が成功していることを確認する。
2. `node scripts/check-package.mjs` を実行する。利用者が受け取るのと同じ、パッケージにまとめた中身を確かめる(内容はスクリプトの先頭のコメントを参照)。`init` が `.github/tsuzuri/styles/` に置くのは `base.css` と `default.css` だけであること、`init --update` が設定ファイル(`.github/tsuzuri/config`)と利用者が `styles/` に置いたカスタムスタイルを保持し、`default.css` を上書きすることも含まれる。
3. タグを付ける前に `CHANGELOG.md` を書く。`[Unreleased]` に、前回のタグから今回までの利用者に見える変更をまとめる(材料は、マージした PR と `git log v<前回の版>..main`。`v<前回の版>` の部分は前回のリリースのタグにする)。カテゴリは `CHANGELOG.md` の冒頭の説明に従う。見出しを `## [X.Y.Z] - YYYY-MM-DD` に改め、その上に空の `[Unreleased]` を追加する。各リリースの節には、英語のブロック、`<!-- ja -->` の行、日本語のカテゴリ名を使った日本語のブロックの順に書く(`CHANGELOG.md` の冒頭を参照)。`scripts/release-notes.mjs` は `## [X.Y.Z]` の節が無い、または空のとき、`<!-- ja -->` の行が無いとき、どちらかのブロックが空のときにエラーで止まり、`release.yml` はタグの push のあとにこれを実行する。
4. `docs/ai-reference.md` と `docs/ai-reference.ja.md` の対象バージョン(英語版は 13 行と 19 行、日本語版は 12 行と 18 行の `v1.38.0`)を、新しい版に更新する。`CHANGELOG.md` と同じコミットでかまいません。本文中の例(`#v1.36.0` など。英語版は 74・78・793 行、日本語版は 70・73・728 行付近)は例示なので、実在する版であれば更新は任意です。
5. `package.json` と `package-lock.json` の `version` を `X.Y.Z` にする(先頭の `version` と `packages[""].version`。依存パッケージの版は変えない)。
6. コミットして `main` に push し、タグを付けて push する。

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

7. タグの push で `.github/workflows/release.yml` が動く。Actions タブで結果を確認する。行うことは次のとおり。
   - タグと `package.json` の `version` が一致し、タグのコミットが `main` にあることの確認
   - `CHANGELOG.md` の該当する節から GitHub の Release を作成(`scripts/release-notes.mjs`。本文は英語、日本語の順)
   - メジャーバージョンのタグ(`vX`)をこのコミットに付け替え

   手元の `vX` タグは古いままです。必要なら `git fetch --tags --force` で取り込みます。
8. このリポジトリ自身のサイトの生成ファイルを、新しいタグのものに更新する。`main` で `npx github:akilasatolu/tsuzuri#<新しいタグ> init --update` を実行し(`#vX.Y.Z` は、いま push したタグ)、出た差分(`.github/tsuzuri/` と `.github/workflows/tsuzuri-pages.yml`)をコミットして `main` に push する。
9. リリースのあと(と `init --update` のコミットのあと)、Actions タブで、CI と `tsuzuri-pages`(`main` への push のたびに動く)が成功し、サイトが正しく公開されていることを確認する。
