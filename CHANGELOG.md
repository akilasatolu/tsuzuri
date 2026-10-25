# Changelog

All notable changes to this project are recorded in this file, following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Versioning follows [Semantic Versioning](https://semver.org/).

## Format

Each release lists only the categories that apply:

- `Added` - new features
- `Changed` - changes to existing features
- `Deprecated` - features that will be removed in the future
- `Removed` - features removed in this release
- `Fixed` - bug fixes
- `Security` - changes related to vulnerabilities

Every release section has an English block, then a line `<!-- ja -->`, then a Japanese block. The Japanese block uses the Japanese category names (`追加` `変更` `非推奨` `削除` `修正` `セキュリティ`). `scripts/release-notes.mjs` splits the section at that line, so do not remove it.

このプロジェクトの変更履歴は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) の形式に従って記録します。
また、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

## フォーマットについて

各リリースは以下のカテゴリのうち、該当するものだけを記載します。

- `Added`(追加) - 新機能
- `Changed`(変更) - 既存機能の変更
- `Deprecated`(非推奨) - 将来的に削除予定の機能
- `Removed`(削除) - 今回削除された機能
- `Fixed`(修正) - 不具合修正
- `Security`(セキュリティ) - 脆弱性に関する変更

各リリースの節は、英語のブロック、`<!-- ja -->` の行、日本語のブロックの順に書きます。日本語のブロックでは、カテゴリの名前を日本語(`追加` `変更` `非推奨` `削除` `修正` `セキュリティ`)にします。`scripts/release-notes.mjs` はこの行で節を英語と日本語に分けるので、消さないでください。

## [Unreleased]

## [1.38.0] - 2026-10-26

This release changes how styles are chosen, and it is **not backward compatible** for sites that use `STYLE_FILE`, the frontmatter `styleFile`, `THEME` with a built-in theme name, or `THEME=none`. Read "What to do after `init --update`" below.

### Added

- The look of a page is now the base CSS (`base.css`) plus **one custom style**: a CSS file in `.github/tsuzuri/styles/`. `default.css` (the former `material.css`, renamed) is the one included in the package; the others are offered in the [gallery](https://akilasatolu.github.io/tsuzuri/docs/gallery.html), where each custom style has a screenshot carousel (light and dark) and a download button.
- A linked `.css` file is now copied to the site like a PDF or a video (also inside folders that start with `.`, such as `.github/tsuzuri/styles/glass.css`, which is written under `_.github/`). The gallery uses this for its download buttons.
- `base.css` has a CSS-only carousel (`.tsuzuri-carousel`, `overflow-x: auto` with `scroll-snap-type: x mandatory`; no JavaScript, and it has no colors).

### Changed

- `THEME` in `.github/tsuzuri/config` is now the **file name of a custom style** (for example `THEME=default.css` or `THEME=glass.css`). It is always read from `.github/tsuzuri/styles/`; `STYLE_DIR` only affects where `base.css` is read from. The default, when it is omitted or empty, is `default.css`. A value that is not the name of a `.css` file (`none`, an old theme name such as `material`, a path with folders) shows a warning and `default.css` is used. If the file does not exist, a warning is shown and the site is built with `base.css` only.
- The frontmatter `theme` is now the file name of a custom style too (`theme: glass.css`), and it **replaces** the site-wide custom style (the two are not mixed). A value that cannot be used, or a missing file, shows a warning and the page uses the site-wide custom style.
- `init` no longer asks about the theme (five questions instead of six). The config file it creates starts with `THEME=default.css`. `init` and `init --update` place only `base.css` and `default.css` in `.github/tsuzuri/styles/`.
- `init --update` overwrites `default.css` (copy it under another name to edit it). It does not change or delete the custom styles you put in `styles/`; an old `material.css` stays there until you delete it.
- `sitemap.json` (`SITEMAP_JSON=true`) no longer has `styleFile` and `customStyleApplied`; its `theme` is the custom style file name (for example `default.css`).
- The pages of the gallery are now samples of custom styles; the wording of the documentation uses "custom style" instead of "built-in theme" and "custom CSS".

### Removed

- `STYLE_FILE` in the config file (the workflow no longer accepts it: GitHub Actions shows `Ignoring unknown setting key STYLE_FILE`), the frontmatter `styleFile`, and the empty `custom.css` template that `init` created.
- The `--theme` option of `init`, and the theme question.
- The `THEME=none` keyword and the built-in theme names. Use a CSS file instead: for no decoration, `none.css` (a file that contains only comments) from the gallery.
- The seven themes `glass`, `neumorphism`, `editorial`, `minimal`, `kintsugi`, `blueprint` and `nineties` are no longer distributed with the package. They are in the gallery as downloadable custom styles (`glass.css` and so on).

**What to do after `init --update`**

`init --update` brings the new build script. Your config file and the custom styles in `styles/` are not changed, so update them by hand:

- Step 1: In `.github/tsuzuri/config`, change `THEME` to a file name: `THEME=material` becomes `THEME=default.css`; for any other built-in theme (for example `THEME=glass`) and for `THEME=none`, download the file (`glass.css`, `none.css`) from the gallery, put it in `.github/tsuzuri/styles/`, and write `THEME=glass.css` (`THEME=none.css`). `none.css` is not placed by `init` or `init --update`; without the file, a warning is shown and the site is built with `base.css` only.
- Step 2: Delete the `STYLE_FILE` line. The file it pointed to (`custom.css` by default) is not loaded any more. To keep your own rules, make them a custom style: copy the custom style you use (`default.css` or a downloaded one) under another name such as `my.css`, write your rules in the copy, and set `THEME=my.css`.
- Step 3: In frontmatter, change `theme: nineties` to `theme: nineties.css` (download the file as in step 1), and remove `styleFile:` lines (they are ignored now).
- Step 4: Delete the files that are no longer used, such as the old `.github/tsuzuri/styles/material.css`.
- Step 5: Run `npx github:akilasatolu/tsuzuri#v1 preview` to check the look.

<!-- ja -->

このリリースではスタイルの選び方が変わり、`STYLE_FILE`、frontmatter の `styleFile`、組み込みテーマ名の `THEME`、`THEME=none` を使っているサイトでは**互換性がありません**。下の「`init --update` のあとに行うこと」を読んでください。

### 追加

- ページの見た目は、ベース(`base.css`)と**カスタムスタイル1つ**(`.github/tsuzuri/styles/` の中の CSS ファイル)で決まるようになった。パッケージに入っているのは `default.css`(これまでの `material.css` の名前を変えたもの)だけで、ほかのものは[ギャラリー](https://akilasatolu.github.io/tsuzuri/ja/docs/gallery.html)に載せている。ギャラリーには、各カスタムスタイルのスクリーンショットのカルーセル(ライトとダーク)と、ダウンロードのボタンがある。
- リンクされた `.css` ファイルを、PDF や動画と同じようにサイトへコピーするようにした(`.github/tsuzuri/styles/glass.css` のように `.` で始まるフォルダの中のものも。出力では `_.github/` の下に書かれる)。ギャラリーのダウンロードのボタンが使う。
- `base.css` に、CSS だけのカルーセル(`.tsuzuri-carousel`。`overflow-x: auto` と `scroll-snap-type: x mandatory`。JavaScript は使わず、色も持たない)を追加した。

### 変更

- 設定ファイル `.github/tsuzuri/config` の `THEME` は、**カスタムスタイルのファイル名**にした(例: `THEME=default.css`、`THEME=glass.css`)。ファイルは常に `.github/tsuzuri/styles/` の中から読む。`STYLE_DIR` は `base.css` を読む場所だけに影響する。省略した場合・空の場合は `default.css`。`.css` のファイル名でない値(`none`、`material` のような昔のテーマ名、フォルダを含むパス)は、警告して `default.css` を使う。ファイルが無い場合は、警告して `base.css` だけでビルドする。
- frontmatter の `theme` も、カスタムスタイルのファイル名にした(`theme: glass.css`)。サイト全体のカスタムスタイルを**置き換える**(混ざらない)。使えない値や無いファイルは、警告して、そのページはサイト全体のカスタムスタイルを使う。
- `init` はテーマを質問しなくなった(質問は6つから5つ)。作られる設定ファイルは `THEME=default.css` で始まる。`init` と `init --update` が `.github/tsuzuri/styles/` に置くのは、`base.css` と `default.css` だけ。
- `init --update` は `default.css` を上書きする(編集したいときは別の名前にコピーする)。`styles/` に置いた自分のカスタムスタイルは、変更も削除もしない。昔の `material.css` は、自分で消すまで残る。
- `sitemap.json`(`SITEMAP_JSON=true`)から `styleFile` と `customStyleApplied` をなくした。`theme` は、カスタムスタイルのファイル名(例: `default.css`)になる。
- ギャラリーの各ページは、カスタムスタイルの見本ページになった。ドキュメントの用語も、「組み込みテーマ」「独自 CSS」から「カスタムスタイル」に統一した。

### 削除

- 設定ファイルの `STYLE_FILE`(ワークフローも受け付けなくなり、GitHub Actions では `Ignoring unknown setting key STYLE_FILE` と警告される)、frontmatter の `styleFile`、`init` が作っていた空の `custom.css` のひな形。
- `init` の `--theme` オプションと、テーマの質問。
- `THEME=none` というキーワードと、組み込みテーマ名。代わりに CSS ファイルを指定する。装飾なしにしたいときは、ギャラリーの `none.css`(コメントだけのファイル)を使う。
- `glass`・`neumorphism`・`editorial`・`minimal`・`kintsugi`・`blueprint`・`nineties` の7つのテーマを、パッケージに含めて配らないようにした。ギャラリーに、ダウンロードできるカスタムスタイル(`glass.css` など)として載せている。

**`init --update` のあとに行うこと**

`init --update` は新しいビルドスクリプトを取り込みます。設定ファイルと `styles/` のカスタムスタイルは変更されないので、手で直してください。

- 手順1: `.github/tsuzuri/config` の `THEME` をファイル名にする。`THEME=material` は `THEME=default.css`、ほかの組み込みテーマ(例: `THEME=glass`)と `THEME=none` は、ギャラリーからファイル(`glass.css`、`none.css`)をダウンロードして `.github/tsuzuri/styles/` に置き、`THEME=glass.css`(`THEME=none.css`)にする。`none.css` は `init` も `init --update` も置かないので、ファイルが無いと警告が出て、`base.css` だけでビルドされる。
- 手順2: `STYLE_FILE` の行を消す。指していたファイル(既定は `custom.css`)は、もう読み込まれない。自分で書いたルールを残すには、カスタムスタイルにする: 使っているカスタムスタイル(`default.css` かダウンロードしたもの)を `my.css` のような別の名前にコピーし、コピーの中にルールを書いて、`THEME=my.css` にする。
- 手順3: frontmatter の `theme: nineties` を `theme: nineties.css` にし(ファイルは手順 1 と同じようにダウンロードする)、`styleFile:` の行を消す(今は無視される)。
- 手順4: 昔の `.github/tsuzuri/styles/material.css` など、使われなくなったファイルを消す。
- 手順5: `npx github:akilasatolu/tsuzuri#v1 preview` で見た目を確かめる。

## [1.37.0] - 2026-10-25

### Added

- Added the `--lang <en|ja>` option to `init` and `preview` (and `--help`, `--update`). It sets the language of the messages the command prints. Only `en` (the default) and `ja`, in lowercase, are accepted; any other value is an error. It applies only to the command it is given to: there is no environment variable for it, and the OS locale is not read. `--lang` alone does not skip the questions (only `--yes`, `--branch` and the like do), and it is not the language of the site (that is still `LANGUAGES` in the config file).

### Changed

- The messages of `init` and `preview` (questions, progress lines, warnings, errors and `--help`) are now in English by default. Up to v1.36.0 they were always in Japanese; add `--lang ja` to get the Japanese messages.
- The comments in the config file (`.github/tsuzuri/config`) and in the empty custom CSS template (`.github/tsuzuri/styles/custom.css`) that `init` creates follow `--lang`: English by default, Japanese with `--lang ja` (they were always Japanese). The keys and values written to the config file are the same in both languages. The workflow (`.github/workflows/tsuzuri-pages.yml`) and `.github/tsuzuri/.gitignore` that `init` generates are always in English, whatever `--lang` is.
- The messages of the build script (the log of the build on GitHub Actions and of the build that `preview` runs: warnings, errors, and the list of problems printed with `STRICT_LINKS=true`) are now always in English; `--lang` does not change them. The text of `.tsuzuri-build`, the marker file the build writes to the output directory, is in English too. If you search the logs for a message, the wording has changed: the old Japanese wording and the new English wording of the main messages are listed in `docs/ai-reference.md` and `docs/faq.md`.
- The first comment of the generated workflow now reads `# tsuzuri vX.Y.Z generated this self-contained workflow with npx ...` (it was Japanese up to v1.36.0). `preview` reads the version from the beginning of this comment (`# tsuzuri vX.Y.Z `), so it works with both the old and the new text.
- What `init --update` changes in an existing repository: the workflow `.github/workflows/tsuzuri-pages.yml` (the log messages and the comments become English; the steps themselves do not change), the comment in `.github/tsuzuri/.gitignore`, the `description` line of `.github/tsuzuri/package.json`, and the build scripts under `.github/tsuzuri/` (whose messages become English). The config file `.github/tsuzuri/config` and an existing `.github/tsuzuri/styles/custom.css` are not changed. Because the build script is updated by `init --update`, a repository that has not run it yet keeps printing the Japanese messages.

<!-- ja -->

### 追加

- `init` と `preview`(`--help`・`--update` も含む)に、`--lang <en|ja>` オプションを追加した。コマンドが表示するメッセージの言語を決める。指定できるのは `en`(既定)と `ja`(小文字)だけで、ほかの値はエラーになる。付けたコマンドのときだけ有効で、環境変数は用意していない。OS のロケールも見ない。`--lang` だけでは質問を省略しない(省略するのは `--yes`・`--branch` などを付けたとき)。サイトの言語でもない(サイトの言語は、これまでどおり設定ファイルの `LANGUAGES`)。

### 変更

- `init` と `preview` のメッセージ(質問・進み具合の表示・警告・エラー・`--help`)を、既定で英語にした。v1.36.0 までは常に日本語だった。日本語で表示したいときは `--lang ja` を付ける。
- `init` が作る設定ファイル(`.github/tsuzuri/config`)と空の独自 CSS のひな形(`.github/tsuzuri/styles/custom.css`)のコメントは、`--lang` に従うようにした。既定は英語で、`--lang ja` なら日本語(これまでは常に日本語)。設定ファイルに書かれるキーと値は、どちらの言語でも同じ。`init` が生成するワークフロー(`.github/workflows/tsuzuri-pages.yml`)と `.github/tsuzuri/.gitignore` は、`--lang` に関係なく常に英語。
- ビルドスクリプトのメッセージ(GitHub Actions でのビルドと、`preview` が実行するビルドのログ。警告・エラー・`STRICT_LINKS=true` のときに出す問題の一覧)を、常に英語にした。`--lang` では変わらない。ビルドが出力先に書く目印のファイル `.tsuzuri-build` の中身も英語にした。ログからメッセージを検索している場合は、文言が変わっている。主なメッセージの、古い日本語の文言と新しい英語の文言は、`docs/ai-reference.md` と `docs/faq.md`(どちらにも日本語版がある)に載せている。
- 生成するワークフローの最初のコメントを、`# tsuzuri vX.Y.Z generated this self-contained workflow with npx ...` の形にした(v1.36.0 までは日本語)。`preview` はこのコメントの先頭 `# tsuzuri vX.Y.Z ` から版を読むので、古い文言でも新しい文言でも動く。
- 既存のリポジトリで `init --update` を実行すると変わるもの: ワークフロー `.github/workflows/tsuzuri-pages.yml`(ログのメッセージとコメントが英語になる。手順そのものは変わらない)、`.github/tsuzuri/.gitignore` のコメント、`.github/tsuzuri/package.json` の `description` の 1 行、`.github/tsuzuri/` 配下のビルドスクリプト(メッセージが英語になる)。設定ファイル `.github/tsuzuri/config` と、既にある `.github/tsuzuri/styles/custom.css` は変わらない。ビルドスクリプトは `init --update` で更新されるので、まだ実行していないリポジトリは、日本語のメッセージのままになる。

## [1.36.0] - 2026-10-19

### Changed

- In the "Build" step of the generated workflow (`.github/workflows/tsuzuri-pages.yml`), the `env:` list (20 items) that copied each value from the config file one by one has been reduced to just `STYLE_DIR`. The config file values, `BASE_PATH` and `SITE_ORIGIN` are passed as environment variables by an earlier step, so the behavior does not change. The comment in the workflow that explains the build dependencies was also reworded so that it no longer names the dependencies or their versions. This is applied by `init --update`. You do not need to edit your config file.
- `init` now always creates `.github/tsuzuri/styles/custom.css`, an empty template for your own CSS (the question about it is gone). If the file already exists, it is not overwritten (even with `--yes --force`). `init --update` also creates it if it is missing.
- `STYLE_FILE`, the frontmatter `styleFile`, and the CSS given in `theme` are now written as a file name only. The file is read from `.github/tsuzuri/styles/` (for example `STYLE_FILE=custom.css`, `styleFile: plain.css`, `theme: my-theme.css`). A file name must end with `.css`, must not contain `/`, `\` or `:`, and must not start with `.`. For `theme`, a value ending in `.css` is treated as a CSS file name, and any other value as a built-in theme name. An old value written as a path is ignored with a warning (`STYLE_FILE` then uses no custom CSS, `styleFile` uses the site-wide one, and `theme` uses the site-wide `THEME`). If the `STYLE_FILE` value in your `.github/tsuzuri/config` uses the old form (`.github/tsuzuri/styles/custom.css`), change it to `custom.css`. `styleFile` in `sitemap.json` is still output as a path from the repository root (empty when no custom CSS is used).
- The files that `init` generates have new names. The workflow is now `.github/workflows/tsuzuri-pages.yml` (its displayed name is "Tsuzuri: Deploy to GitHub Pages") and the config file is now `.github/tsuzuri/config`. Of the files under `.github/tsuzuri/`, you edit only `config` and your own CSS files in `styles/` (`custom.css` by default), not the built-in theme CSS or the scripts; `init --update` never changes `config` or `custom.css`. Files that `init` generated under the old names are not migrated.
- The text of a GitHub Release is now written in both English and Japanese. `scripts/release-notes.mjs` builds it from the `CHANGELOG.md` section for that version: the usage and update guide and the English block, then the same in Japanese. The Japanese block is the part after the `<!-- ja -->` line. Every section of `CHANGELOG.md` now has an English block, a `<!-- ja -->` line and a Japanese block, including the sections of past versions.

### Removed

- Removed `pageRels` from `sitemap.json`. The same content is in `pages[].rel`. `sitemap.json` is debugging output and is produced only when `SITEMAP_JSON=true`.
- For repositories that ran `init` before v1.7.0, `preview` no longer reads the dependencies from the `npm install` line of the workflow. If there is no `package-lock.json` (even if the dependencies are installed), it points you to `init --update` and exits.
- Removed the warning dedicated to the discontinued config key `LANG`. A `LANG` line is now treated like any other unknown key (the generated workflow ignores it with an "unknown config key" warning; a local build ignores it silently). The language is determined only by `LANGUAGES`.
- Removed the `--style` option of `init` and the question about the template for your own CSS.

<!-- ja -->

### 変更

- 生成するワークフロー(`.github/workflows/tsuzuri-pages.yml`)の「Build」ステップで、設定ファイルの値を 1 つずつ書き写していた `env:` の列挙(20 項目)を整理し、`STYLE_DIR` だけにした。設定ファイルの値と `BASE_PATH`・`SITE_ORIGIN` は、前のステップが環境変数として渡すので、動作は変わらない。あわせて、ワークフローのコメント(ビルド用の依存の説明)を、依存の名前と版を書かない文面にした。`init --update` で反映される。設定ファイルを書き換える必要はない。
- `init` が独自 CSS の空ひな形 `.github/tsuzuri/styles/custom.css` を必ず作るようにした(質問は無くなった)。既にあれば上書きしない(`--yes --force` でも)。`init --update` でも、無ければ作る。
- `STYLE_FILE`・frontmatter の `styleFile`・`theme` の CSS を、ファイル名だけで書くように変えた。ファイルは `.github/tsuzuri/styles/` の中から読む(例: `STYLE_FILE=custom.css`、`styleFile: plain.css`、`theme: my-theme.css`)。ファイル名は `.css` で終わり、`/`・`\`・`:` を含まず、`.` で始まらないもの。`theme` は、`.css` で終われば CSS のファイル名、そうでなければ組み込みテーマ名として扱う。パスで書いた古い値は、警告を出して無視する(`STYLE_FILE` は独自 CSS を使わない。`styleFile` はサイト全体のものを、`theme` はサイト全体の `THEME` を使う)。`.github/tsuzuri/config` の `STYLE_FILE` の値が古い書き方(`.github/tsuzuri/styles/custom.css`)の人は、`custom.css` に書き換える。`sitemap.json` の `styleFile` は、これまでどおりリポジトリの直下からのパスで出る(独自 CSS を使わないときは空)。
- `init` が生成するファイルの名前を変えた。ワークフローは `.github/workflows/tsuzuri-pages.yml`(画面に出る名前は "Tsuzuri: Deploy to GitHub Pages")、設定ファイルは `.github/tsuzuri/config` になった。`.github/tsuzuri/` の中で利用者が編集するのは、`config` と、`styles/` に置く独自 CSS(既定は `custom.css`)だけで、組み込みのテーマ CSS とスクリプトは編集しない。`init --update` は `config` と `custom.css` を変更しない。以前の名前で `init` が生成したファイルは、移行されない。
- GitHub の Release の本文を、英語と日本語の両方で書くようにした。`scripts/release-notes.mjs` が、その版の `CHANGELOG.md` の節から、使い方・更新方法の案内と英語のブロック、続けて同じものを日本語で並べて作る。日本語のブロックは、`<!-- ja -->` の行より後ろの部分。`CHANGELOG.md` のすべての節が、英語のブロック、`<!-- ja -->` の行、日本語のブロックの順になった(過去の版の節も同じ)。

### 削除

- `sitemap.json` の `pageRels` を削除した。同じ内容が `pages[].rel` にある。`sitemap.json` はデバッグ用の出力で、`SITEMAP_JSON=true` のときだけ出る。
- v1.7.0 より前に `init` したリポジトリで、`preview` がワークフローの `npm install` の行から依存を読む処理をやめた。`package-lock.json` が無いときは(依存が入っていても)、`init --update` を案内して終了する。
- 廃止した設定キー `LANG` 専用の警告を削除した。`LANG` の行は、ほかの未知のキーと同じ扱いになる(生成ワークフローは「未知の設定キー」の警告を出して無視する。手元のビルドは黙って無視する)。言語は `LANGUAGES` だけで決まる。
- `init` の `--style` オプションと、独自 CSS のひな形についての質問を削除した。

## [1.35.0] - 2026-10-11

### Added

- Added a built-in theme, Kintsugi (`kintsugi`), styled after kintsugi, the Japanese craft of mending a broken vessel with lacquer and gold. Gold seams run across white-porcelain-like cards, and code blocks are lacquer black. The light mode is white porcelain, and the dark mode is black lacquer. Use it with `THEME=kintsugi`, or with `theme: kintsugi` in frontmatter. In the theme question of `init`, the numbers change: Kintsugi is 6, Blueprint becomes 7, 90s becomes 8, and no decoration becomes 9.

### Fixed

- Fixed a problem on pages with navigation: when the screen width was about 960px to 1130px and the page had a long table or a long code line that does not wrap, the body overlapped the navigation and the whole page scrolled horizontally. This happened in all 7 built-in themes (Editorial and Minimal did not overlap but overflowed to the right). The body now fits in its column, and only the table or code block scrolls horizontally. Because the theme CSS changed, the CSS file name (the hash at the end) changes.

<!-- ja -->

### 追加

- 組み込みテーマ「金継ぎ(`kintsugi`)」を追加した。割れた器を漆と金で継ぐ「金継ぎ」のスタイル。白磁のようなカードに金の継ぎ目が走り、コードブロックは漆の黒。ライト表示は白磁、ダーク表示は黒漆。`THEME=kintsugi`、または frontmatter の `theme: kintsugi` で使う。init の質問でのテーマの番号は、金継ぎが 6 になり、ブループリントが 7、90年代が 8、装飾なしが 9 に変わる。

### 修正

- ナビのあるページで、画面の幅が 960px から 1130px ほどのとき、長い表や折り返さない長いコード行があると、本文がナビに重なり、ページ全体が横にスクロールしていた問題を直した。7つの組み込みテーマすべてで起きていた(エディトリアルとミニマルは、重ならずに右へはみ出していた)。本文の幅は列に収まり、表とコードブロックは、その中だけが横にスクロールする。テーマの CSS を変えたため、CSS のファイル名(後ろのハッシュ)が変わる。

## [1.34.0] - 2026-10-10

### Added

- Tsuzuri now automatically creates `llms.txt`, a table of contents of the site written for AI (LLMs), at the top of the site. It works without any setup, and **one more file is published**. The format is as follows (the H1 is the site name, the blockquote is the description of the starting page, and each link line is `- [title](URL): description`).

  ```
  # Site name

  > Description of the starting page

  ## Docs

  - [Title](https://owner.github.io/repo/page.html): Description
  - [Title](https://owner.github.io/repo/other.html)

  ## Optional

  - [Page not in the nav](https://owner.github.io/repo/hidden.html): Description
  - [日本語](https://owner.github.io/repo/ja/)
  ```

  - When it is created: when the site URL (`SITE_ORIGIN`) is known. It is always known on GitHub Actions, so the file is created there; it is not created when `SITE_ORIGIN` is missing, such as in a local preview. If `SITE_ORIGIN` has an invalid form, a warning is shown and the file is not created.
  - `## Docs` lists the pages of the base language in the same order as the sidebar nav (the same order even with `NAV_ENABLED=false`). The title and description are the same values as `<title>` and the meta description. For a page without a description, nothing after `: ` is output.
  - `## Optional` lists the pages with `nav: false` in their frontmatter and, for a multilingual site, links to the top page of each language other than the base language (the display name is the name of the language). A section with nothing to list is omitted, heading included.
  - Pages that are not listed: pages whose frontmatter has `noindex: true`, the 404 page, and pages in languages other than the base language (only the link to the top page appears in `## Optional`).
  - Even for a multilingual site there is only one `llms.txt`. For a site with `BASE_PATH`, it is placed at the top of the site (`https://owner.github.io/repo/llms.txt`), not at the root of the domain, and the links also include `BASE_PATH`.
  - A run of whitespace and control characters (newlines, tabs, and so on) in a title or description is collapsed into a single space. `\`, `[`, `]`, backticks and `<` are escaped with a preceding `\`. A title is cut at 200 characters and a description at 300 characters (so that the Markdown structure is not broken). `(` and `)` in a URL become `%28` and `%29`.
  - How to turn it off: `LLMS_TXT=false` in the config file. A value other than `true` or `false` (such as `off`) shows a warning and is treated as `false` (not created). The config file created by `init` contains `LLMS_TXT=true`. For an old config file, `init --update` reports it as an "item missing from the config file" (it works even if you do not add it).
  - If there is an `llms.txt` that you wrote yourself at the top of the repository, it is not generated automatically; that file is copied as it is to the top of the site (even without `SITE_ORIGIN`). Even if the README links to that `llms.txt`, the link becomes a link to the file on GitHub, so the output destinations do not collide. An `llms.txt` that is a symbolic link or not a regular file (such as a folder) is neither copied nor generated automatically, and a warning is shown (so that following a link does not publish files such as `.env` in the repository). This alone does not fail the build even with `STRICT_LINKS=true`. With `LLMS_TXT=false`, nothing is copied either.

<!-- ja -->

### 追加

- AI(LLM)向けにサイトの目次を書いた `llms.txt` を、サイトの直下に自動で作るようにした。書かなくても有効で、**公開されるファイルが 1 つ増える**。形は次のとおり(H1 がサイト名、引用ブロックが起点のページの説明、リンクの行が `- [題名](URL): 説明`)。

  ```
  # サイト名

  > 起点のページの説明

  ## Docs

  - [題名](https://owner.github.io/repo/page.html): 説明
  - [題名](https://owner.github.io/repo/other.html)

  ## Optional

  - [ナビに載せないページ](https://owner.github.io/repo/hidden.html): 説明
  - [日本語](https://owner.github.io/repo/ja/)
  ```

  - 作られる条件: サイトの URL(`SITE_ORIGIN`)が決まっているとき。GitHub Actions では必ず決まるので作られ、手元のプレビューなど `SITE_ORIGIN` がないときは作られない。`SITE_ORIGIN` の形が正しくないときは、警告を出して作らない。
  - `## Docs` には、基本言語のページを、サイドバーのナビと同じ順(`NAV_ENABLED=false` でも同じ順)で載せる。題名と説明は、`<title>` と meta description と同じ値。説明がないページは `: ` 以降を出さない。
  - `## Optional` には、frontmatter に `nav: false` と書いたページと、多言語のサイトでは、基本言語以外の各言語のトップページへのリンク(表示名は言語の名前)を載せる。載せるものがない節は、見出しごと出さない。
  - 載せないページ: frontmatter が `noindex: true` のページ、404 のページ、基本言語以外のページ(トップページへのリンクだけ `## Optional` に載る)。
  - 多言語のサイトでも `llms.txt` は 1 つ。`BASE_PATH` があるサイトでは、ドメインの直下ではなく、サイトの直下(`https://owner.github.io/repo/llms.txt`)に置かれ、リンクにも `BASE_PATH` が入る。
  - 題名・説明に含まれる空白と制御文字(改行・タブなど)の並びは、空白 1 つにまとめる。`\`・`[`・`]`・バッククォート・`<` は、前に `\` を付けてエスケープする。題名は 200 文字、説明は 300 文字で切る(Markdown の構造を壊さないため)。URL の `(` `)` は `%28` `%29` にする。
  - 止め方: 設定ファイルの `LLMS_TXT=false`。`true`・`false` 以外の値(`off` など)は、警告を出して `false`(作らない)として扱う。`init` で作る設定ファイルには `LLMS_TXT=true` を書く。古い設定ファイルには、`init --update` で「設定ファイルに無い項目」として案内される(書かなくても有効で動く)。
  - リポジトリの直下に自分で書いた `llms.txt` があるときは、自動では作らず、それをそのままサイトの直下にコピーする(`SITE_ORIGIN` がなくてもコピーする)。README からその `llms.txt` へリンクしていても、リンクは GitHub 上のファイルへのリンクになり、出力先は重ならない。シンボリックリンクや、通常のファイル以外(フォルダなど)の `llms.txt` は、警告を出して、コピーも自動生成もしない(リンクをたどって、リポジトリの中の `.env` などのファイルを公開してしまわないため)。`STRICT_LINKS=true` でも、これだけではビルドは失敗しない。`LLMS_TXT=false` のときは、コピーもしない。

## [1.33.0] - 2026-10-10

### Added

- Added the settings `REPO_LINK`, `REPO_VERSION` and `REPO_LICENSE`. Only the ones you set are shown at the end of every page (including 404) in the form "GitHub repository · Version: v1.2.3 · License: MIT" (on Japanese pages, "GitHub リポジトリ · バージョン: … · ライセンス: …". The wording follows the language of the page, and the values are the same in all languages). All three default to the same as before (not shown), so the output does not change if you do not write them.
  - `REPO_LINK`: set it to `true` to show a link to the GitHub repository. The link target is taken from environment variables on GitHub Actions, and from the URL of the git origin in a local build (users do not write the URL). If the URL cannot be determined, a warning is shown once and only the link is omitted.
  - `REPO_VERSION`, `REPO_LICENSE`: the strings to display (for example `v1.2.3` and `MIT`). What you write in the config file is shown as it is. **They are not updated automatically** (change them at each release). Up to 64 characters on one line. A value containing control characters such as a newline, or a value that is too long, is not shown, and a warning is shown.
  - The display is a separate paragraph (`<p class="tsuzuri-updated tsuzuri-repo-info">`) from the last-updated date and the edit link, placed after the links to the previous and next pages. It is shown even with `NAV_ENABLED=false`.
  - For an existing config file, `init --update` reports them as "items missing from the config file".

<!-- ja -->

### 追加

- 設定 `REPO_LINK`・`REPO_VERSION`・`REPO_LICENSE` を追加した。設定したものだけが、各ページ(404 を含む)の末尾に「GitHub repository · Version: v1.2.3 · License: MIT」の形で出る(日本語のページでは「GitHub リポジトリ · バージョン: … · ライセンス: …」。文言はページの言語、値は全言語で同じ)。3 つとも既定は今までと同じ(出さない)で、書かなければ出力は変わらない。
  - `REPO_LINK`: `true` にすると、GitHub のリポジトリへのリンクを出す。リンク先は GitHub Actions では環境変数から、手元のビルドでは git の origin の URL から求める(利用者は URL を書かない)。URL が分からないときは、警告を 1 回出してリンクだけ出さない。
  - `REPO_VERSION`・`REPO_LICENSE`: 表示する文字列(例: `v1.2.3`・`MIT`)。設定ファイルに書いたものがそのまま出る。**自動では更新されない**(リリースのたびに書き換える)。1 行で 64 文字まで。改行などの制御文字を含む値や長すぎる値は、警告を出して表示しない。
  - 表示は最終更新日・編集リンクとは別の段落(`<p class="tsuzuri-updated tsuzuri-repo-info">`)で、前後のページへのリンクの後ろに付く。`NAV_ENABLED=false` でも出る。
  - 既存の設定ファイルには、`init --update` で「設定ファイルに無い項目」として案内される。

## [1.32.0] - 2026-10-10

### Changed

- For links from Markdown to files other than Markdown, the files copied to the site are now limited to those whose extension is in a list. Previously every file with an extension was copied, so even `src/foo.js` and `package.json` were published. Now only files that are opened and used with an app or a browser are copied, and everything else becomes a link to the file on GitHub (so that files of unknown kinds are not published unintentionally). Extensions are case-insensitive (`A.PDF` is also copied; `.tar.gz` matches by `gz`).
  - Extensions that are copied: documents (`pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `odt`, `ods`, `odp`, `epub`, `html`, `htm`), archives (`zip`, `tar`, `gz`, `tgz`, `bz2`, `xz`, `7z`), video (`mp4`, `webm`, `mov`, `m4v`, `ogv`, `avi`, `mkv`), audio (`mp3`, `m4a`, `wav`, `ogg`, `oga`, `flac`, `aac`, `opus`, `weba`), and images (see the item below).
  - Not copied: files that are read as text, such as code, config files, `.txt` and `.csv`, and files whose extension is not in the list. If the file exists, the link becomes a link to the file on GitHub (the same as for files without an extension and files starting with a dot). If it does not exist, the result is "link target not found", and the build fails with `STRICT_LINKS=true` (before, it was the warning "the linked file was not found", which also failed with `STRICT_LINKS=true`; the failure is the same). In the `sitemap.json` produced with `SITEMAP_JSON=true`, paths that do not exist and have an extension not in the list move from `files` to `missing`.
  - `.html` and `.htm` are still copied as before. Their content is not changed, and other files that the HTML loads (CSS, JavaScript, images) are not copied together with it (the same as now).
  - There is no setting to return to the old behavior. When the repository URL is unknown (for example on a host other than GitHub) or the repository is private, the link to GitHub cannot be opened. The behavior of keeping the path inside the site and showing a warning is the same as before, but files that used to be copied and could be opened (such as `.js`) can no longer be opened.
- A warning is now shown when the extension of a file embedded as an image, video or audio (`![](…)`, `<img src>`, `srcset`, `<video src>`, `<audio src>`, `<source src>`) is not in the list of copied extensions. Before, such files were copied and displayed, but now they become links to files on GitHub, so they cannot be displayed or played. The warning reads "the embed target … is a kind of file that is not copied, so it cannot be displayed or played" (shown in Japanese), and the build fails with `STRICT_LINKS=true`. Links (`[x](y)`, `<a href>`) do not trigger the warning. **With `STRICT_LINKS=true`, updating alone may stop your build.** To fix it, change the file to a format in the list, or stop embedding it and use a link instead. Embeds inside `404.md` are not subject to the warning (a link in `404.md` to a file not in the list stays as a path inside the site).
- Added `avif`, `apng`, `tif`, `tiff`, `heic`, `heif` and `jxl` to the extensions treated as images. These images are copied like other images. The same applies inside folders starting with a dot (`.github/a.avif` → `_.github/a.avif` in the site) and for file names starting with a dot (`.a.avif`). Before, they were not treated as images, and in places starting with a dot they were links to files on GitHub, so more files are now published. The handling of existing image extensions such as `png` does not change. In the `sitemap.json` produced with `SITEMAP_JSON=true`, `.avif` and similar move from `files` to `images`.
- The video and audio copied inside folders starting with a dot (such as `.github/`) now include the added extensions (`ogv`, `avi`, `mkv`, `flac`, `aac`, `opus`, `weba`) (the list of copied video and audio and this list are now built from the same definition). Before, these were links to files on GitHub inside folders starting with a dot.
- Embedding a folder without a README as an image or similar (`![](src/)`) is also subject to the embed warning above ("it is a folder, so it cannot be displayed or played").

<!-- ja -->

### 変更

- Markdown から Markdown 以外のファイルへのリンクについて、サイトにコピーするファイルを、拡張子の一覧にあるものだけにした。今までは拡張子のあるファイルはすべてコピーしていたため、`src/foo.js` や `package.json` まで公開されていた。アプリやブラウザで開いて使うものだけをコピーし、それ以外は GitHub 上のファイルへのリンクにする(知らない種類のファイルを意図せず公開しないため)。拡張子は大文字小文字を区別しない(`A.PDF` もコピーする。`.tar.gz` は `gz` で当たる)。
  - コピーする拡張子: 文書(`pdf`・`doc`・`docx`・`xls`・`xlsx`・`ppt`・`pptx`・`odt`・`ods`・`odp`・`epub`・`html`・`htm`)、圧縮(`zip`・`tar`・`gz`・`tgz`・`bz2`・`xz`・`7z`)、動画(`mp4`・`webm`・`mov`・`m4v`・`ogv`・`avi`・`mkv`)、音声(`mp3`・`m4a`・`wav`・`ogg`・`oga`・`flac`・`aac`・`opus`・`weba`)、画像(下の項目)。
  - コピーしないもの: コード、設定ファイル、`.txt`、`.csv` などのテキストとして読むファイルと、一覧にない拡張子のファイル。実在すれば GitHub 上のファイルへのリンクになる(拡張子のないファイルやドットで始まるファイルと同じ)。実在しなければ「リンク先が見つかりません」になり、`STRICT_LINKS=true` ではビルドが失敗する(今までは「リンク先のファイルが見つかりません」の警告で、`STRICT_LINKS=true` で失敗していた。失敗は同じ)。`SITEMAP_JSON=true` の `sitemap.json` では、一覧にない拡張子の実在しないパスが `files` から `missing` に移る。
  - `.html`・`.htm` は今までどおりコピーされる。中身は変えず、その HTML が読み込む別のファイル(CSS・JavaScript・画像)は一緒にコピーされない(今と同じ)。
  - 元の動きに戻す設定はない。リポジトリの URL が分からないとき(GitHub 以外のホストなど)や、非公開リポジトリでは、GitHub へのリンクが開けない。サイト内のパスのままにして警告を出す動きは今までどおりだが、今までコピーされて開けたファイル(`.js` など)が開けなくなる。
- 画像・動画・音声として埋め込んだファイル(`![](…)`・`<img src>`・`srcset`・`<video src>`・`<audio src>`・`<source src>`)の拡張子が、コピーする一覧にないと、警告を出すようにした。今まではコピーされて表示されていたが、GitHub 上のファイルへのリンクになるため表示・再生できない。警告は「埋め込みの先 … はコピーしない種類のファイルのため、表示・再生できません」で、`STRICT_LINKS=true` ではビルドが失敗する。リンク(`[x](y)`・`<a href>`)では警告しない。**`STRICT_LINKS=true` の場合は、更新しただけでビルドが止まることがある。** 対処は、一覧にある形式のファイルに変えるか、埋め込みをやめてリンクにする。`404.md` の中の埋め込みは警告の対象外(`404.md` の中の一覧にないファイルへのリンクは、サイト内のパスのまま残る)。
- 画像として扱う拡張子に `avif`・`apng`・`tif`・`tiff`・`heic`・`heif`・`jxl` を足した。これらの画像は、ほかの画像と同じくコピーされる。ドットで始まるフォルダの中(`.github/a.avif` → サイトの `_.github/a.avif`)や、ドットで始まるファイル名(`.a.avif`)でも同じ。今までは画像として扱われず、ドットで始まる場所では GitHub 上のファイルへのリンクだったので、公開されるファイルが増える。`png` など今までの画像の拡張子の扱いは変わらない。`SITEMAP_JSON=true` の `sitemap.json` では、`.avif` などが `files` から `images` に移る。
- ドットで始まるフォルダ(`.github/` など)の中でコピーする動画・音声に、追加した拡張子(`ogv`・`avi`・`mkv`・`flac`・`aac`・`opus`・`weba`)を含めた(コピーする動画・音声の一覧と、この一覧を同じ定義から作るようにした)。今までは、これらはドットで始まるフォルダの中では GitHub 上のファイルへのリンクだった。
- README のないフォルダを画像などとして埋め込んだとき(`![](src/)`)も、上の埋め込みの警告の対象になる(「フォルダのため、表示・再生できません」)。

## [1.31.0] - 2026-10-10

### Added

- Emoji shortcodes (`:tada:` → 🎉, `:rocket:` → 🚀, `:+1:` → 👍, and so on) are now converted to emoji when displayed. As on GitHub, `:name:` written in the body of the README and other pages becomes an emoji on the site as well (the table of names is that of [gemoji](https://github.com/wooorm/gemoji) 8.1.0). The conversion applies in body text, emphasis, link text, tables, lists, quotes and footnotes. Writing a shortcode in a heading does not change the heading id (`# Demo :tada:` is displayed as `Demo 🎉` and its id is `demo-tada`; the id is the same as before, so a link to `#demo-tada` keeps working). The table of contents, the page title (`<title>`, `og:title`), the description, the search and the display names in the nav use the text with the emoji converted. `title` and `description` in frontmatter are not changed.
  - It also converts in the middle of a word (`a:tada:b` becomes `a🎉b`). If you do not want it converted, write `\:tada:` or put it in code (`` `:tada:` ``).
  - Places that are not converted: code spans and code blocks, the inside of inline `<code>`, `<kbd>`, `<pre>`, `<script>`, `<tt>`, `<samp>` and `<style>`, the inside of block-level HTML (such as `<summary>`), links written as a bare URL (both the display and the `href`), and the alt text of images. Names not in the table (including GitHub's own image emoji such as `:shipit:`), uppercase (`:TADA:`) and times (`10:30:45`) are also displayed as they are.
- Images written in `srcset` of raw HTML `<picture>`, `<source>` and `<img>` are now handled the same way as `src`. Images for switching in dark mode (`<picture><source media="(prefers-color-scheme: dark)" srcset="…">`) and images for each resolution (`srcset="a.png 1x, a@2x.png 2x"`) are copied to the site, and paths in the repository are rewritten to paths in the site. If an image does not exist, the warning "the linked file was not found" is shown, as with `src`, and the build fails with `STRICT_LINKS=true`. GitHub's own switching such as `#gh-dark-mode-only` is not handled. As with `src`, as a deliberate limitation, unquoted values (`srcset=a.png`) and forms with whitespace around `=` (`srcset = "a.png"`) are not covered.

<!-- ja -->

### 追加

- 絵文字のショートコード(`:tada:` → 🎉、`:rocket:` → 🚀、`:+1:` → 👍 など)を、絵文字に変えて表示するようにした。GitHub と同じく、README などの本文に書いた `:名前:` が、サイトでも絵文字になる(名前の表は [gemoji](https://github.com/wooorm/gemoji) 8.1.0 のもの)。本文・強調・リンクの文字・表・リスト・引用・脚注の中で変わる。見出しに書いても、見出しの id は変わらない(`# Demo :tada:` は表示が `Demo 🎉`、id が `demo-tada`。今までの id のままなので、`#demo-tada` へのリンクはそのまま動く)。目次・ページのタイトル(`<title>`・`og:title`)・説明文・検索・ナビの表示名は、絵文字に変えた文字になる。frontmatter の `title`・`description` は変えない。
  - 語の途中も変わる(`a:tada:b` は `a🎉b`)。変えたくないときは、`\:tada:` と書くか、コード(`` `:tada:` ``)にする。
  - 変わらない場所: コードスパン・コードブロック、インラインの `<code>`・`<kbd>`・`<pre>`・`<script>`・`<tt>`・`<samp>`・`<style>` の中、ブロックの HTML の中(`<summary>` など)、URL をそのまま書いたリンク(表示も `href` も)、画像の alt。表にない名前(`:shipit:` など GitHub 独自の画像の絵文字を含む)・大文字(`:TADA:`)・時刻(`10:30:45`)も、そのまま表示する。
- 生の HTML の `<picture>`・`<source>`・`<img>` の `srcset` に書いた画像を、`src` と同じように扱うようにした。ダークモード用の画像の出し分け(`<picture><source media="(prefers-color-scheme: dark)" srcset="…">`)や、解像度ごとの画像(`srcset="a.png 1x, a@2x.png 2x"`)の画像が、サイトにコピーされ、リポジトリ内のパスがサイト内のパスに書き換わる。画像が存在しないときは、`src` と同じく「リンク先のファイルが見つかりません」の警告になり、`STRICT_LINKS=true` ではビルドが失敗する。`#gh-dark-mode-only` のような GitHub 独自の出し分けは扱わない。また、`src` と同じ割り切りで、引用符のない値(`srcset=a.png`)や、`=` の前後に空白のある書き方(`srcset = "a.png"`)は対象にならない。

## [1.30.5] - 2026-10-08

### Changed

- When a table does not fit in the width of the body, only the table can now be scrolled horizontally. Before, the whole body scrolled horizontally. The width of a table now also fits its content (before, even a table with little content was stretched to the full width of the body; this is now the same as how GitHub shows it). The look of a table with a lot of content that wraps does not change. This applies to all 7 built-in themes. If you want tables stretched to the full width as before, write `main table { display: table; width: 100%; }` in your own CSS (in that case, a table that does not fit scrolls the whole body horizontally, as before). Because the shared CSS changed, the CSS file name (the hash at the end) changes.

<!-- ja -->

### 変更

- 表が本文の幅に入り切らないとき、表の中だけを横にスクロールできるようにした。今までは、本文全体が横にスクロールしていた。あわせて、表の幅を内容に合わせるようにした(今までは、内容の少ない表も本文の幅いっぱいに広げていた。GitHub での表示と同じになる)。内容が多く、折り返して表示されている表の見た目は変わらない。7 つの組み込みテーマすべてに反映される。今までどおり幅いっぱいに広げたい場合は、独自 CSS で `main table { display: table; width: 100%; }` と書く(この場合、入り切らない表は今までどおり本文ごと横にスクロールする)。共通の CSS を変えたため、CSS のファイル名(後ろのハッシュ)が変わる。

## [1.30.4] - 2026-10-07

### Changed

- The color of the "Copy" button of a code block now changes when the cursor is placed over it (only on devices with a cursor; on smartphones and similar, nothing changes). The background and the border become the accent color of the theme (`--accent`), and the text becomes the base color (`--bg`). This applies to all 7 built-in themes. When no theme is used and there is no custom CSS (`THEME=none`), the look stays the same as before. If you change the button color in your own CSS, also specify the color for when the cursor is over it (`.tsuzuri-copy:hover`). Because the shared CSS changed, the CSS file name (the hash at the end) changes.

<!-- ja -->

### 変更

- コードブロックの「コピー」ボタンにカーソルを当てると、ボタンの色が変わるようにした(カーソルのある端末だけ。スマートフォンなどでは今までと同じ)。背景と枠線がテーマのアクセント色(`--accent`)に、文字が地の色(`--bg`)になる。7 つの組み込みテーマすべてに反映される。テーマを使わず独自 CSS も無い場合(`THEME=none`)は、今までと同じ見た目のまま。独自 CSS でボタンの色を変えている場合は、カーソルを当てたときの色(`.tsuzuri-copy:hover`)も合わせて指定する。共通の CSS を変えたため、CSS のファイル名(後ろのハッシュ)が変わる。

## [1.30.3] - 2026-10-07

### Changed

- The "Copy" button of a code block is now always shown. Before, it was shown only when the cursor was over it or when it was selected with the keyboard (on screens without a cursor, such as smartphones, it was already always shown). The position and size of the button and the top margin of the code block do not change. Because the shared CSS changed, the CSS file name (the hash at the end) changes.

<!-- ja -->

### 変更

- コードブロックの「コピー」ボタンを、常に表示するようにした。今までは、カーソルを当てたとき・キーボードで選んだときだけ表示していた(スマートフォンなど、カーソルの無い画面では今までも常に表示していた)。ボタンの位置と大きさ、コードブロックの上の余白は変わらない。共通の CSS を変えたため、CSS のファイル名(後ろのハッシュ)が変わる。

## [1.30.2] - 2026-10-07

### Fixed

- Fixed a problem where the "Copy" button overlapped the text on the first line of a code block and made it unreadable. A code block with the button now has a larger top margin (40px), and the text starts below the button. The first line no longer overlaps, even on screens where the button is always shown, such as smartphones, even if the first line is long, and even when scrolling horizontally. The height of the button is now also the same in every theme. A code block with only one line becomes taller by that amount. The look is the same as before when JavaScript does not run and the button does not appear, and for mermaid diagrams. If you change the top margin of code blocks in your own CSS, write `.tsuzuri-code > pre { padding-top: … }` (a `main pre` rule no longer changes the top margin). Because the shared CSS changed, the CSS file name (the hash at the end) changes.

<!-- ja -->

### 修正

- コードブロックの 1 行目の文字に「コピー」ボタンが重なり、文字が読めなくなる問題を直した。ボタンが付いたコードブロックは上の余白を広げ(40px)、ボタンの下から文字が始まる。ボタンが常に表示されるスマートフォンなどの画面でも、1 行目が長くても、横にスクロールしても重ならない。あわせて、ボタンの高さがテーマによらず同じになるようにした。1 行だけのコードブロックは、その分だけ縦に長くなる。JavaScript が動かずボタンが出ない場合と、mermaid の図の見た目は、今までと同じ。独自 CSS でコードブロックの上の余白を変える場合は、`.tsuzuri-code > pre { padding-top: … }` と書く(`main pre` の指定では、上の余白は変わらなくなる)。共通の CSS を変えたため、CSS のファイル名(後ろのハッシュ)が変わる。

## [1.30.1] - 2026-10-05

### Fixed

- Fixed a problem where the workflow stopped with the error "TRIGGER_BRANCH is not defined in the config file." (shown in Japanese) when `TRIGGER_BRANCH` was missing from the config file or had an empty value. When it is omitted or empty, the site is published when you push to the default branch of the repository (usually `main`). The behavior when you write `TRIGGER_BRANCH` does not change. For repositories that have already run init, run `init --update` with this version to apply the fix.

<!-- ja -->

### 修正

- 設定ファイルに `TRIGGER_BRANCH` が無い、または値が空のときに、ワークフローが「設定ファイルに TRIGGER_BRANCH が定義されていません。」のエラーで止まっていた問題を直した。省略・空のときは、リポジトリの既定ブランチ(通常は `main`)に push したときに公開する。`TRIGGER_BRANCH` を書いている場合の動きは変わらない。init 済みのリポジトリでは、この版で `init --update` を実行すると反映される。

## [1.30.0] - 2026-10-04

### Added

- Added the `EDIT_LINK` setting. When set to `true`, a link "Edit this page on GitHub" (shown as "このページを GitHub で編集" on Japanese pages) is added at the end of each page, and it opens the Markdown file of that page in GitHub's edit screen. Readers can fix a typo or an outdated description on the spot and send the fix. The default is `false` (the same output as before). The branch of the link is the branch that was built on GitHub Actions, and the current branch in a local build. When the branch is unknown (a build from a tag, or when there is no git origin), a warning is shown and no link is added.

<!-- ja -->

### 追加

- 設定 `EDIT_LINK` を追加した。`true` にすると、各ページの末尾に「このページを GitHub で編集」(英語のページでは「Edit this page on GitHub」)のリンクが付き、そのページの Markdown ファイルを GitHub の編集画面で開ける。読んだ人が誤字や古い記述をその場で直して送れる。既定は `false`(今までと同じ出力)。リンク先のブランチは、GitHub Actions ではビルドしたブランチ、手元では今のブランチ。ブランチが分からないとき(タグのビルドや、git の origin が無いとき)は、警告を出してリンクを付けない。

## [1.29.0] - 2026-10-04

### Added

- On the 404 page of a multilingual site, only the guidance for the language of the URL that was opened is now shown. A site has only one 404 page (because of how GitHub Pages works), so if you write the guidance for each language in `404.md` with `<div lang="…">`, only that block is shown when the beginning of the URL (such as `/ja/`) is that language, and otherwise only the block of the base language is shown. The default content used when there is no `404.md` is displayed in the same way. The nav and the wording of the screen stay in the base language. In environments where JavaScript does not run, the guidance for all languages is shown.

<!-- ja -->

### 追加

- 多言語サイトの 404 ページで、開かれた URL の言語の案内だけを表示するようにした。404 ページはサイトに1枚だけなので(GitHub Pages の仕組み)、`404.md` の中に言語ごとの案内を `<div lang="…">` で書いておくと、URL の先頭(`/ja/` など)がその言語ならそのかたまりだけを、それ以外は基本言語のかたまりだけを見せる。`404.md` が無いときの既定の内容も同じように表示される。ナビや画面の文言は基本言語のまま。JavaScript が動かない環境では、すべての言語の案内が表示される。

## [1.28.0] - 2026-10-04

This release contains changes that alter the look of your site if your settings stay as they are (the Removed section and the first two items under Changed below).
Please change `.github/docs-pages.config` as follows.

- If you have written `LANG=…`, rewrite that line as `LANGUAGES=…` (for example `LANG=ja` → `LANGUAGES=ja`). If you leave the `LANG` line, a warning is shown at every build. If it was `LANG=en`, rewriting the line gives the same result as before.
- If you built a Japanese site without writing `LANG` (the default used to be Japanese), add `LANGUAGES=ja`.

### Removed

- Removed the `LANG` setting. If it is written in the config file, a warning is shown and the line is ignored (it is not automatically read as `LANGUAGES`). Write `LANGUAGES` instead and delete the `LANG` line (if you leave it, a warning is shown at every build. For example `LANG=ja` → `LANGUAGES=ja`).
- Removed the frontmatter key `lang` from the supported keys (it was not used for generated pages in the first place). The language of a page is determined by the file name (for example `cli.en.md`) and `LANGUAGES`.

### Changed

- The contents fetched locally by `npx github:akilasatolu/tsuzuri` are now only the files needed to run it (tests, saved data for tests, and development files are not included).
- Changed the default language from `ja` (Japanese) to `en` (English). If you have not written `LANGUAGES`, you get an English site (`<html lang="en">` and English wording on the screen).
- The OS environment variable `LANG` (such as `ja_JP.UTF-8`) is no longer read. The language of the site is determined only by `LANGUAGES`.
- A page whose file name ends with the same marker as the base language (the first language in `LANGUAGES`) is now output at the URL without the marker. Because the default base language is `en`, `notes.en.md` becomes `/notes.html` even if you do not make the site multilingual, and it takes priority over `notes.md` if that exists (the files that were not used are listed in the build log).
- A language that is not in the table of screen wording (for example `fr`) is shown with English wording, as before. If you add it to the table, it gets the wording of that language.
- Because rules for the language buttons were added to the shared CSS, the CSS file name (the hash at the end) changes.
- Changed the behavior in rare cases.
  - On a single-language site, when there are files that differ only in the case of the extension (such as `cli.md` and `cli.MD`), the one found first is used, and the other is not used and a warning is shown as a duplicate.
  - In environments that distinguish upper and lower case (such as Linux), when both `README.md` and `readme.md` are in the same folder, the one found first becomes `index.html`.
  - When checking the heading of a link to a folder (such as `guide/`), index-type entry points such as `index.md` are looked at first (to match the page actually shown at `/guide/`).
  - If any of the collected pages becomes `404.html` (such as `404.en.md`), the default 404 page is not created.
  - When both `404.md` and a 404 with the base-language marker (`404.en.md` for `LANGUAGES=en`) exist, the one with the marker is used.

### Fixed

- Fixed a problem where `npx github:akilasatolu/tsuzuri init` did not create `.github/tsuzuri/package.json` and `package-lock.json`, so installing the dependencies (`npm ci`) in the generated workflow failed (because npm removes `package-lock.json` from fetched packages). If you ran init with the previous version, run `init --update` with this version and the two files will be created.

### Added

- Made it possible to build multilingual sites. Write two or more languages separated by commas in `LANGUAGES` (for example `LANGUAGES=ja,en`; the first is the base language).
  - Put a translation by adding the language after the file name (the English version of `docs/cli.md` is `docs/cli.en.md`).
  - Pages in the base language have the same URLs as before, and other languages are placed under a language folder (such as `/en/docs/cli.html`).
  - The nav, the previous and next pages, and the search are separated by language, and only those of the same language as the page are shown.
  - Added a language switcher button to pages (a menu for three or more languages). On a page without a translation, it goes to the top page of that language.
  - If `SITE_ORIGIN` is set, `hreflang` tags that link translations to each other are output.
  - The default 404 page used when there is no `404.md` lists links back to the top page of each language.
- `init` now asks for the language of the site (the default is `en`). Also added the `--languages` option to specify it without interaction. If you give `--languages` a value that is not a valid language tag (such as `ja_JP`), it stops with an error.
- Made it possible to build a site even if the starting point is only `README.en.md` (when the base language is `en`; `README.<language>.md` matching the base language works in the same way).

<!-- ja -->

このリリースには、今までの設定のままだと見た目が変わる変更があります(下の「削除」と「変更」の最初の2つ)。
`.github/docs-pages.config` を次のように直してください。

- `LANG=…` を書いている場合は、その行を `LANGUAGES=…` に書き換える(例: `LANG=ja` → `LANGUAGES=ja`)。`LANG` の行は、残すとビルドのたびに警告が出る。`LANG=en` だった場合も、行を書き換えれば今までと同じになる。
- `LANG` を書かずに日本語のサイトを作っていた場合(今までの既定は日本語だった)は、`LANGUAGES=ja` を足す。

### 削除

- 設定 `LANG` を廃止した。設定ファイルに書かれていると、警告を出してその行を無視する(`LANGUAGES` への自動の読み替えはしない)。代わりに `LANGUAGES` に書き、`LANG` の行は消す(残すとビルドのたびに警告が出る。例: `LANG=ja` → `LANGUAGES=ja`)。
- frontmatter の `lang` キーをサポートするキーから外した(もともと生成されるページには使われていなかった)。ページの言語はファイル名(例 `cli.en.md`)と `LANGUAGES` で決まる。

### 変更

- `npx github:akilasatolu/tsuzuri` で手元に入る中身を、実行に要るファイルだけにした(テスト・テスト用の保存データ・開発用のファイルは入らない)。
- 既定の言語を `ja`(日本語)から `en`(英語)に変えた。`LANGUAGES` を書いていないと、英語のサイト(`<html lang="en">`・英語の画面の文言)になる。
- OS の環境変数 `LANG`(`ja_JP.UTF-8` など)を読まないようにした。サイトの言語は `LANGUAGES` だけで決まる。
- ファイル名の最後に基本言語(`LANGUAGES` の先頭の言語)と同じ印が付いたページは、印の無い URL で出すようにした。既定の基本言語は `en` なので、多言語にしない場合でも `notes.en.md` は `/notes.html` になり、`notes.md` があればそちらより優先される(使わなかったファイルはビルドのログに一覧で出る)。
- 画面の文言の表に無い言語(例: `fr`)は、今までどおり英語の文言で表示する。表に足せばその言語の文言になる。
- 共通の CSS に言語ボタンの決まりを足したため、CSS のファイル名(後ろのハッシュ)が変わる。
- まれな場合の動きを変えた。
  - 1つの言語のサイトで、拡張子の大文字・小文字だけが違うファイル(`cli.md` と `cli.MD` など)が両方あるときは、先に見つかった方を使い、もう一方は重複として警告して使わない。
  - 大文字・小文字を区別する環境(Linux など)で、同じフォルダに `README.md` と `readme.md` の両方があるときは、先に見つかった方を `index.html` にする。
  - フォルダへのリンク(`guide/` など)の見出しを確かめるときは、`index.md` などの index 型の入口を先に見る(実際に `/guide/` で表示されるページに合わせた)。
  - 集めたページの中に `404.html` になるもの(`404.en.md` など)があれば、既定の 404 ページは作らない。
  - `404.md` と、基本言語の印付きの 404(`LANGUAGES=en` なら `404.en.md`)の両方があるときは、印付きの方を使う。

### 修正

- `npx github:akilasatolu/tsuzuri init` で、`.github/tsuzuri/package.json`・`package-lock.json` が作られず、生成したワークフローの依存のインストール(`npm ci`)が失敗していた問題を直した(npm が取得物から `package-lock.json` を外すため)。前の版で init した人は、この版で `init --update` を実行すると2つのファイルが作られる。

### 追加

- 多言語のサイトを作れるようにした。`LANGUAGES` に言語をカンマ区切りで2つ以上書く(例: `LANGUAGES=ja,en`。先頭が基本言語)。
  - 翻訳は、ファイル名の後ろに言語を付けて置く(`docs/cli.md` の英語版は `docs/cli.en.md`)。
  - 基本言語のページは今までと同じ URL、ほかの言語は言語のフォルダの下(`/en/docs/cli.html` など)に出る。
  - ナビ・前後のページ・検索は言語ごとに分かれ、ページと同じ言語のものだけが出る。
  - ページに言語の切り替えボタンを付けた(3言語以上はメニュー)。翻訳が無いページでは、その言語のトップへ移る。
  - `SITE_ORIGIN` を設定していると、翻訳どうしを結ぶ `hreflang` のタグを出す。
  - `404.md` を置いていないときの既定の 404 ページは、それぞれの言語のトップへ戻るリンクを並べる。
- `init` で、サイトの言語を聞くようにした(既定は `en`)。対話なしで指定する `--languages` オプションも足した。`--languages` に言語タグとして正しくない値(`ja_JP` など)を指定すると、エラーで止まる。
- 起点を `README.en.md` だけにしても、サイトを作れるようにした(基本言語が `en` のとき。基本言語に合わせた `README.<言語>.md` も同じ)。

## [1.27.0] - 2026-10-03

### Removed

- Removed the built-in themes Terminal (`terminal`) and Notebook (`notebook`). If you had specified them, the default Material (`material`) is used.

<!-- ja -->

### 削除

- 組み込みテーマのターミナル(`terminal`)とノート(`notebook`)を削除した。指定していた場合は、既定のマテリアル(`material`)で表示される。

## [1.26.2] - 2026-10-01

### Fixed

- Fixed a problem in Terminal (`terminal`) where scrolling the sidebar made the title bar band at the top and the red, yellow and green dots drift out of place. The title bar of the sidebar is now stuck to the top as one band and does not move when scrolling.

<!-- ja -->

### 修正

- ターミナル(`terminal`)で、サイドバーをスクロールすると、上のタイトルバーの帯と赤・黄・緑の丸がずれる問題を直した。サイドバーのタイトルバーを一つの帯として上に貼り付け、スクロールしても動かないようにした。

## [1.26.1] - 2026-10-01

### Changed

- Redesigned Terminal (`terminal`).
  - The body and the nav now sit in a window with red, yellow and green dots and a title (`tsuzuri — zsh`).
  - Headings, bullet lists, quotes and inline code are now typeset so that the Markdown symbols (`##`, `-`, `>`, `` ` ``) are visible. A prompt (`❯`) comes before the h1, and a square cursor blinks after it.
  - Dropped the single fluorescent green and the scan lines, and used a calmer color scheme with green (prompt), blue (links), yellow (emphasis), purple (italics) and gray (symbols).

<!-- ja -->

### 変更

- ターミナル(`terminal`)のデザインを見直した。
  - 本文とナビを、赤・黄・緑の丸とタイトル(`tsuzuri — zsh`)の付いたウィンドウにのせるようにした。
  - 見出し・箇条書き・引用・インラインコードを、Markdown の記号(`##`・`-`・`>`・`` ` ``)が見える組み方にした。h1 の前にはプロンプト(`❯`)、後ろで四角いカーソルが点滅する。
  - 蛍光グリーン一色と走査線をやめ、緑(プロンプト)・青(リンク)・黄(強調)・紫(斜体)・グレー(記号)で色分けする落ち着いた配色にした。

## [1.26.0] - 2026-10-01

### Changed

- Made the background of Glass (`glass`) a moving aurora. Two layers of curtains of light sway and flow slowly with different periods (22 seconds and 31 seconds), and the colors drift through the transparent cards. The light mode is a pale dawn sky with a pastel aurora, and the dark mode is a starry sky with a green, teal and purple aurora. The motion is stopped for people who have set reduced motion.

<!-- ja -->

### 変更

- グラス(`glass`)の地を、動くオーロラにした。2層の光のカーテンが違う周期(22秒・31秒)でゆっくり揺れて流れ、透明なカード越しに色が移ろう。ライト表示は明け方の淡い空にパステルのオーロラ、ダーク表示は星空に緑・青緑・紫のオーロラ。動きを減らす設定の人には止める。

## [1.25.0] - 2026-10-01

### Added

- Added 5 built-in themes.
  - Editorial (`editorial`): a style that relies on typesetting and white space, like a magazine or a fine document. Large serif headings with chapter numbers, and a vermilion accent color.
  - Minimal (`minimal`): a calm look using only white, black and gray, like the documentation of Vercel or Linear. Only links are blue.
  - Terminal (`terminal`): like a command-line screen, with monospaced text on a black screen, headings with a prompt, and a blinking cursor. Always in dark mode.
  - Blueprint (`blueprint`): like a blueprint, with a white grid and thin lines on a blue background, and headings with dimension lines. Always displayed the same way.
  - Notebook (`notebook`): a ruled notebook page, with highlighter-style headings and quotes like sticky notes. A friendly look for learning sites.

<!-- ja -->

### 追加

- 組み込みテーマを5つ追加した。
  - エディトリアル(`editorial`): 雑誌や上質なドキュメントのような、文字組と余白で見せるスタイル。大きな明朝体の見出しと章の番号、朱色の差し色。
  - ミニマル(`minimal`): Vercel や Linear のドキュメントのような、白・黒・グレーだけの落ち着いた見た目。リンクだけ青。
  - ターミナル(`terminal`): コマンドラインの画面のような、黒い画面に等幅の文字、プロンプト付きの見出しと点滅するカーソル。常にダーク表示。
  - ブループリント(`blueprint`): 設計図(青焼き)のような、青い地に白い方眼と細線、寸法線付きの見出し。常に同じ表示。
  - ノート(`notebook`): 罫線ノートのページに、蛍光ペンの見出しと付箋のような引用。学習サイト向けのやさしい見た目。

## [1.24.1] - 2026-10-01

### Fixed

- Fixed a problem where the light/dark switch button was not shown in Glass (`glass`). In a theme whose background is only a gradient, the background color does not change, so it was judged that there was no difference between light and dark. The comparison now also covers the background image (the gradient) in addition to the background color. Also gave the Glass background a base color.

<!-- ja -->

### 修正

- グラス(`glass`)で、ライト/ダークの切り替えボタンが表示されなかった問題を直した。背景がグラデーションだけのテーマでは背景色が変わらないため、ライト/ダークの違いが無いと判定していた。背景色に加えて背景画像(グラデーション)も比べるようにした。あわせてグラスの地に下地の色を付けた。

## [1.24.0] - 2026-10-01

### Changed

- Changed the background of Glass (`glass`) from round colored shapes to a color gradient flowing diagonally (the light mode goes from pale purple to light blue, mint and pale yellow; the dark mode goes from deep purple to indigo, deep teal and deep reddish brown).
- Made the cards of Glass more transparent so that the colors show through as they are. Added a thin highlight on the edge of the cards, as if light were falling on them.

### Removed

- Removed the built-in theme Frosted (`frosted`). If you had specified it, the default Material (`material`) is used.

<!-- ja -->

### 変更

- グラス(`glass`)の地を、丸い色の形から、斜めに流れるカラーグラデーションに変えた(ライトは薄紫→水色→ミント→淡い黄、ダークは深い紫→藍→深い青緑→深い赤茶)。
- グラスのカードの透明度を上げ、色がそのまま透けるようにした。カードの縁には光が当たったような細いハイライトを付けた。

### 削除

- 組み込みテーマのフロスト(`frosted`)を削除した。指定していた場合は、既定のマテリアル(`material`)で表示される。

## [1.23.0] - 2026-10-01

### Changed

- Placed several round colored shapes in blue, purple and teal on the background of Glass (`glass`). The shapes show through the cards in a blurred way, which makes it easy to see that it is frosted glass. Also made the transparency and blur of the cards a little stronger.

### Removed

- Removed the built-in theme Clay (`clay`). If you had specified it, the default Material (`material`) is used.

<!-- ja -->

### 変更

- グラス(`glass`)の地に、青・紫・青緑の丸い色の形をいくつか置いた。形がカード越しにぼやけて透けて見えるので、すりガラスだとわかりやすい。あわせてカードの透け具合とぼかしを少し強めた。

### 削除

- 組み込みテーマのクレイ(`clay`)を削除した。指定していた場合は、既定のマテリアル(`material`)で表示される。

## [1.22.0] - 2026-10-01

### Changed

- Changed the accent color of Material (`material`) from purple to blue (the blue tone of Material 3). The header row of tables and the color of the current page also become bluish.
- Changed the color scheme of Clay (`clay`) from pastel purple and pink to a pale background that moves from mint to pink, with teal and coral accent colors.
- Changed the background of Glass (`glass`) from multicolored blurred lights to a calm, pale single color (a gentle gradient).

### Removed

- Removed the built-in theme Pixel (`pixel`). If you had specified it, the default Material (`material`) is used.

<!-- ja -->

### 変更

- マテリアル(`material`)の差し色を、紫から青(Material 3 の青のトーン)に変えた。表の見出し行や今いるページの色も青系になる。
- クレイ(`clay`)の配色を、パステルの紫と桃色から、ミントから桃色へ移る淡い地に青緑とコーラルの差し色に変えた。
- グラス(`glass`)の地を、色とりどりのにじんだ光から、落ち着いた淡い単色(ゆるいグラデーション)に変えた。

### 削除

- 組み込みテーマのピクセル(`pixel`)を削除した。指定していた場合は、既定のマテリアル(`material`)で表示される。

## [1.21.0] - 2026-10-01

### Changed

- Rebuilt the design of Pixel (`pixel`) like the UI of a pixel-art game.
  - The body, nav, code, quotes, tables, buttons and input fields now sit in a "window" with a thick border with one dot missing at each corner and a rim of light and shadow (a nine-slice pixel image stretched with `border-image`).
  - An HP gauge under the h1, a stage-name plate for h2, a menu ▶ cursor for h3 and the current page, and quotes as a dialogue window (with a ▼ blinking at the bottom right). The previous and next page links are game buttons that sink when pressed.
  - The light mode has bands of daytime sky colors, and the dark mode has a starry night sky and the black windows of an RPG. The blinking is stopped for people who have set reduced motion.

### Removed

- Removed the built-in themes Retrofuturism (`retro`) and Y2K (`y2k`). If you had specified them, the default Material (`material`) is used.

<!-- ja -->

### 変更

- ピクセル(`pixel`)のデザインを、ゲームのドット絵のUIのように作り直した。
  - 本文・ナビ・コード・引用・表・ボタン・入力欄を、角が1ドット欠けた太い枠と光・影のふちの「ウィンドウ」にのせる(ドット絵の9分割画像を `border-image` で伸ばす)。
  - h1 の下にHPゲージ、h2 はステージ名の札、h3 と今いるページはメニューの▶カーソル、引用はセリフのウィンドウ(右下で▼が点滅)。前後のページはゲームのボタンで、押すと沈む。
  - ライト表示は昼の空の色の段、ダーク表示は星の夜空とRPGの黒いウィンドウ。点滅は、動きを減らす設定の人には止める。

### 削除

- 組み込みテーマのレトロフューチャー(`retro`)と Y2K(`y2k`)を削除した。これらを指定していた場合は、既定のマテリアル(`material`)で表示される。

## [1.20.1] - 2026-09-30

### Changed

- Revised the design of Retrofuturism (`retro`), Y2K (`y2k`) and Pixel (`pixel`).
  - Retrofuturism: placed a striped sun setting on the horizon and a glowing grid with perspective flowing into the distance, and made the h1 chrome text (sky blue at the top, sunset colors at the bottom). The motion of the grid is stopped for people who have set reduced motion.
  - Y2K: made the edges of cards a rainbow-glowing hologram and floated soap bubbles on the background. The h1 is thick, round, rainbow-colored text, and the current page is a glossy aqua-style button.
  - Pixel: made h2 a plate like the stage name of a game, and added a blinking ▶ cursor to h3 and the current page. Made the shadows of headings sharp for readability, and made the dark mode the dialogue window of an RPG (a white border on a black background).

<!-- ja -->

### 変更

- レトロフューチャー(`retro`)・Y2K(`y2k`)・ピクセル(`pixel`)のデザインを見直した。
  - レトロフューチャー: 地平線に沈む縞模様の夕日と、奥へ流れる遠近のついた光るグリッドを置き、h1 をクロームの文字(上が空色、下が夕焼け色)にした。グリッドの動きは、動きを減らす設定の人には止める。
  - Y2K: カードの縁を虹色に光るホログラムにし、地にシャボン玉を浮かべた。h1 は丸くて太い虹色の文字、今いるページはアクア風のつやのあるボタンにした。
  - ピクセル: h2 をゲームのステージ名のような札に、h3 と今いるページに点滅する▶カーソルを付けた。見出しの影をぼかさず読みやすくし、ダーク表示はRPGの会話ウィンドウ(黒の地に白い枠)にした。

## [1.20.0] - 2026-09-30

### Changed

- Changed the default theme (the theme used when `THEME` is not specified or has an invalid value) from Wa (`wa`) to Material (`material`). It is also number 1 (recommended) in the number choice of `init`.

### Removed

- Removed the built-in themes Wa (`wa`), Sakura (`sakura`), Tsuki (`tsuki`), Akari (`akari`), Yuki (`yuki`), Grainy (`grainy`) and Liquid (`liquid`). If you had specified them, the default Material (`material`) is used.

<!-- ja -->

### 変更

- 既定のテーマ(`THEME` を指定しないときや、不正な値のときに使うテーマ)を和(`wa`)からマテリアル(`material`)に変えた。`init` の番号選択でも1番(推奨)になった。

### 削除

- 組み込みテーマの和(`wa`)・桜(`sakura`)・月(`tsuki`)・灯(`akari`)・雪(`yuki`)・グレイン(`grainy`)・リキッド(`liquid`)を削除した。これらを指定していた場合は、既定のマテリアル(`material`)で表示される。

## [1.19.0] - 2026-09-30

### Added

- Added 11 built-in themes with modern designs.
  - Clay (`clay`): Claymorphism. Plump, round, three-dimensional cards and parts like clay. Purple and pink on a pastel background.
  - Grainy (`grainy`): Grainy Gradient. A gradient where vivid colors melt together, with a film-like grain.
  - Glass (`glass`): Glassmorphism. Translucent cards like frosted glass on a background of multicolored light.
  - Neumorphism (`neumorphism`): Neumorphism. Parts in the same color as the background that appear raised or sunken with light and shadow.
  - Material (`material`): Material Design 3 style. A purplish color scheme, rounded cards and shadows, and toned selection in the nav.
  - Frosted (`frosted`): Frosted Glass. Thick, white, clouded frosted glass with fine frost grain, and ice blue.
  - Liquid (`liquid`): Liquid UI. Cards shaped like drops, wobbling marks, and a gradient flowing from light blue to purple.
  - Retrofuturism (`retro`): Retrofuturism. An 80s sunset sky and a glowing grid, with neon accent colors. Always in dark mode.
  - Y2K (`y2k`): Y2K UI. Pastel rainbow colors and sparkling stars, chrome headings and glossy buttons.
  - Pixel (`pixel`): Pixel art. Thick borders and a checkerboard pattern like an 8-bit game, and headings with pixel shadows.
  - 90s (`nineties`): 90s Nostalgia. A Windows 95-style teal desktop with gray windows and three-dimensional buttons. Light mode only.

<!-- ja -->

### 追加

- モダンなデザインの組み込みテーマを11個追加した。
  - クレイ(`clay`): Claymorphism。粘土のようにふっくら丸く立体的なカードと部品。パステルの地に紫と桃色。
  - グレイン(`grainy`): Grainy Gradient。鮮やかな色が溶け合うグラデーションに、フィルムのようなざらつき。
  - グラス(`glass`): Glassmorphism。色とりどりの光の地に、すりガラスのような半透明のカード。
  - ニューモーフィズム(`neumorphism`): Neumorphism。地と同じ色の部品が、光と影で浮き出したりへこんだりする。
  - マテリアル(`material`): Material Design 3 風。紫系の配色、角丸のカードと影、トーンのついたナビの選択。
  - フロスト(`frosted`): Frosted Glass。白く曇った厚いすりガラスと細かな霜のざらつき、氷の青。
  - リキッド(`liquid`): Liquid UI。しずくのような形のカード、揺れる印、水色から紫へ流れるグラデーション。
  - レトロフューチャー(`retro`): Retrofuturism。80年代の夕焼けの空と光るグリッド、ネオンの差し色。常にダーク表示。
  - Y2K(`y2k`): Y2K UI。パステルの虹色ときらめく星、クロームの見出し、つやのあるボタン。
  - ピクセル(`pixel`): Pixel art。8ビットゲームのような太い枠と市松模様、ドットの影の見出し。
  - 90年代(`nineties`): 90s Nostalgia。Windows 95 風の青緑のデスクトップと灰色のウィンドウ、立体のボタン。ライト表示のみ。

## [1.18.0] - 2026-09-30

### Changed

- Made Yuki (`yuki`) always dark (only the color scheme of a snowy night).

### Removed

- Removed the built-in themes Take (`take`), Momiji (`momiji`), Fuji (`fuji`) and Kin (`kin`).

<!-- ja -->

### 変更

- 雪(`yuki`)を、常にダーク表示にした(雪の夜の配色だけにした)。

### 削除

- 組み込みテーマ「竹(`take`)」「紅葉(`momiji`)」「藤(`fuji`)」「金(`kin`)」を削除した。

## [1.17.0] - 2026-09-30

### Added

- "Take" (`take`), a built-in theme on the theme of a bamboo grove. On a pale young-bamboo-green background, with deep green and young bamboo green as accent colors, it has a bamboo band with joints under the h1, a bamboo stalk with joints to the left of the h2, and the shadow of bamboo leaves at the top right of the page. The dark mode is a bamboo grove at night.
- "Momiji" (`momiji`), on the theme of an autumn garden. On an unbleached background with crimson, orange and gold, the mark of the h2 is a maple leaf, and maple leaves scatter at the top right of the page.
- "Fuji" (`fuji`), on the theme of a wisteria trellis. On a pale background with wisteria purple and Edo purple, clusters of wisteria hang from the top of the page, and the mark of the h2 is a wisteria cluster.
- "Yuki" (`yuki`), on the theme of the quiet of a snowy night. White, silver gray and pale indigo, the mark of the h2 is a snow ring, and snow flickers across the whole page.
- "Kin" (`kin`), on the theme of gold folding screens and gold leaf. Gold on a black lacquer background, gold leaf at the top right of the page, and a gold band with cloud shapes under the h1. Always in dark mode.

### Removed

- Removed the built-in theme "Umi" (`umi`).

<!-- ja -->

### 追加

- 竹林をテーマにした組み込みテーマ「竹(`take`)」。淡い若竹色がかった地に深緑と若竹色を差し色にし、h1 の下に節のある
  竹の帯、h2 の左に節のある竹の幹、ページの右上に竹の葉の影。ダーク表示は夜の竹林。
- 秋の庭園をテーマにした「紅葉(`momiji`)」。生成りの地に紅・橙・黄金、h2 の印は紅葉の葉、ページの右上に散る紅葉。
- 藤棚をテーマにした「藤(`fuji`)」。淡い地に藤色と江戸紫、ページの上から垂れ下がる藤の房、h2 の印は藤の房。
- 雪の夜の静けさをテーマにした「雪(`yuki`)」。白・銀鼠・淡い藍、h2 の印は雪輪、ページ全体にちらつく雪。
- 金屏風と金箔をテーマにした「金(`kin`)」。黒漆の地に金、ページの右上に金箔、h1 の下に雲取りの金の帯。常にダーク表示。

### 削除

- 組み込みテーマ「海(`umi`)」を削除した。

## [1.16.0] - 2026-09-30

### Changed

- Rebuilt the design of the default theme "Wa" (`wa`) as a simple design on the theme of ink painting and Edo. Basically only ink on a washi paper background, with Edo vermilion used sparingly as a seal for the accent color. There is a line of ink swept by a brush and a vermilion seal under the h1, a vertical brush stroke to the left of the h2, and a vermilion square seal on the h3. The dark mode is an ink night.
- Renamed the theme "Sora" (`sora`), on the theme of a full-moon night, to "Tsuki" (`tsuki`) (`THEME=tsuki`).
- Changed the color of Akari (`akari`) from a yellowish amber to the color of the flame of a lantern (from the pale yellow of the wick to orange and crimson). The lantern mark and the glow of the headings flicker faintly, like a wavering flame (not animated for people who have set reduced motion).
- Rebuilt the design of Umi (`umi`) in the image of the sea of Katsushika Hokusai's "The Great Wave off Kanagawa". Prussian blue plays the main role on a printed-paper background, with a great wave raising claw-like spray and a distant Mt. Fuji at the bottom right of the page, breaking wave crests under the headings, and a mark of a small wave crest on the h2.

<!-- ja -->

### 変更

- 既定のテーマ「和(`wa`)」のデザインを、墨絵と江戸をテーマにしたシンプルなデザインに作り直した。和紙の地に墨一色を
  基本にし、差し色は江戸の朱を落款として少しだけ使う。h1 の下に筆で払った墨の線と朱の落款、h2 の左に縦の筆跡、
  h3 に朱の角印。ダーク表示は墨の夜。
- 満月の夜をテーマにしたテーマ「宙(`sora`)」の名前を、「月(`tsuki`)」に変えた(`THEME=tsuki`)。
- 灯(`akari`)の色を、黄色寄りの琥珀色から、灯籠の炎のような色(芯の淡い黄から橙・紅へ)にした。灯籠の印と見出しの光は、
  炎が揺らぐようにかすかに明滅する(動きを減らす設定の人には動かさない)。
- 海(`umi`)のデザインを、葛飾北斎の「神奈川沖浪裏」の海のイメージに作り直した。刷り紙の地にベロ藍を主役にし、
  ページの右下に爪のようなしぶきを立てる大波と遠くの富士、見出しの下に砕ける波頭、h2 に小さな波頭の印。

## [1.15.0] - 2026-09-30

### Changed

- Rebuilt the design of Umi (`umi`) as an Edo-style sea. Using indigo-dyed blue, light blue-green (asagi) and the white of gofun, it has swirling wave crests like Hokusai's under the h1 and on the dividing lines, a mark of plovers on the h2, and a band of undulating waves at the bottom of the page. The dark mode is a sea at night.
- Rebuilt the design of Sora (`sora`) as a full-moon night. A full moon wearing a ring of light floats at the top right of the night sky, with stars sparsely placed. The accent colors are the gold of moonlight and moon white, and the mark of the h2 is a small full moon.

<!-- ja -->

### 変更

- 海(`umi`)のデザインを、江戸らしい海に作り直した。藍染めの藍と浅葱色、胡粉の白を使い、h1 の下と区切り線に
  北斎のような渦を巻く波頭、h2 に千鳥の印、ページの下にうねる波の帯。ダーク表示は夜の海。
- 宙(`sora`)のデザインを、満月の夜に作り直した。夜空の右上に光の輪をまとった満月を浮かべ、星をまばらに置く。
  差し色は月明かりの金色と月白、h2 の印は小さな満月。

## [1.14.0] - 2026-09-30

### Changed

- The directories in the nav are now shown fully open from the start (before, only the top level and the directory containing the current page were open, so links to some pages could not be seen while viewing other pages). They can still be folded by clicking, as before.

<!-- ja -->

### 変更

- ナビのディレクトリを、最初からすべて開いた状態で表示するようにした(これまでは、いちばん上の階層と今のページが
  あるディレクトリだけを開いていたため、ほかのページを見ているときに一部のページへのリンクが見えなかった)。
  クリックで折りたためるのはこれまでどおり。

## [1.13.0] - 2026-09-30

### Added

- "Sakura" (`sakura`), a built-in theme that combines Wa, Sakura and Sumi. Ink-colored text and serif headings on a washi paper background, with cherry-blossom pink as the accent color, and cherry petals faintly scattered on heading marks and in the corners of the page. The dark mode is cherry blossoms at night.

### Changed

- Rebuilt the design of the default theme "Wa" (`wa`) as an Edo-style design on the theme of ukiyo-e. On an unbleached printed-paper background with Prussian blue and Edo crimson as accent colors, it has a band of seigaiha (wave pattern) under the h1, and the h2 is in a frame like the title slip of a nishiki-e print. A band of haze is faintly drawn at the top of the page.
- Rebuilt the design of Akari (`akari`) in the image of a lantern lit in the darkness. Amber lantern light bleeds into a background of night darkness, and the mark of the headings is the shape of a small lantern.

### Removed

- Removed the built-in theme "Kabuki" (`kabuki`).

<!-- ja -->

### 追加

- 和・桜・墨を合わせた組み込みテーマ「桜(`sakura`)」。和紙の地に墨色の文字と明朝体の見出し、差し色は桜色で、
  見出しの印やページの隅に桜の花びらを淡く散らす。ダーク表示は夜桜。

### 変更

- 既定のテーマ「和(`wa`)」のデザインを、浮世絵をテーマにした江戸らしいデザインに作り直した。刷り紙の生成りの地に
  ベロ藍と江戸の紅を差し色にし、h1 の下に青海波の帯、h2 は錦絵の題箋のような枠。ページの上に霞の帯を淡く引く。
- 灯(`akari`)のデザインを、暗闇に灯る灯籠のイメージに作り直した。夜の闇の地に、灯籠の琥珀色の灯りをにじませ、
  見出しの印は小さな灯籠の形。

### 削除

- 組み込みテーマ「歌舞伎(`kabuki`)」を削除した。

## [1.12.0] - 2026-09-30

### Added

- "Umi" (`umi`), a built-in theme on the theme of the sea. The light mode is bright shallows, and the dark mode is the bottom of the deep sea. It draws wave lines under headings and on dividing lines, and the accent colors are sea blue and teal. Supports the light/dark display.

### Removed

- Removed the built-in theme "Ai" (`ai`).

### Fixed

- When the release workflow ran twice for a push of the same tag, the second run failed with "the Release has already been created". It now skips the creation if it has already been created.

<!-- ja -->

### 追加

- 海をテーマにした組み込みテーマ「海(`umi`)」。ライト表示は明るい浅瀬、ダーク表示は深い海の底。見出しの下・区切り線に
  波の線を引き、差し色は海の青と青緑。ライト/ダーク表示に対応。

### 削除

- 組み込みテーマ「藍(`ai`)」を削除した。

### 修正

- 同じタグの push でリリースのワークフローが2回動いたとき、2回目が「Release は作成済み」で失敗していた。
  作成済みなら作成をスキップするようにした。

## [1.11.0] - 2026-09-30

### Added

- "Kabuki" (`kabuki`), a built-in theme on the theme of kabuki. The black, persimmon and moegi green of the joshiki-maku curtain and the crimson of kumadori makeup are the accent colors, and thick serif headings get a three-color band and vertical stripes. Supports the light/dark display.

### Removed

- Removed the built-in theme "Shu" (`shu`).

<!-- ja -->

### 追加

- 歌舞伎をテーマにした組み込みテーマ「歌舞伎(`kabuki`)」。定式幕の黒・柿色・萌葱色と隈取の紅を差し色にし、
  明朝体の太い見出しに三色の帯・縦縞を付ける。ライト/ダーク表示に対応。

### 削除

- 組み込みテーマ「朱(`shu`)」を削除した。

## [1.10.0] - 2026-09-30

### Added

- "Akari" (`akari`), a built-in theme on the theme of a neon district. Pink, light blue and yellow neon lights on the dark background of a city at night. Headings, links and the nav entry for the current page glow like neon tubes. Always in dark mode.

### Removed

- Removed the built-in theme "Sumi" (`sumi`).

<!-- ja -->

### 追加

- ネオン街をテーマにした組み込みテーマ「灯(`akari`)」。夜の街の暗い地に、桃色・水色・黄色のネオンの灯り。
  見出し・リンク・今いるページのナビがネオン管のように光る。常にダーク表示。

### 削除

- 組み込みテーマ「墨(`sumi`)」を削除した。

## [1.9.0] - 2026-09-30

### Added

- "Sora" (`sora`), a built-in theme on the theme of outer space. The accent colors are starlight (light blue) and a nebula (purple) on a background of a night sky studded with stars. Always in dark mode.

### Removed

- Removed the built-in theme "Muji" (`muji`).

<!-- ja -->

### 追加

- 宇宙をテーマにした組み込みテーマ「宙(`sora`)」。星をちりばめた夜空の地に、星の光(水色)と星雲(紫)の差し色。
  常にダーク表示。

### 削除

- 組み込みテーマ「無地(`muji`)」を削除した。

## [1.8.0] - 2026-09-29

### Changed

- Rebuilt the design of the 5 built-in themes (Wa, Muji, Sumi, Ai, Shu), making them more practical while strengthening the character of each.
  - Common: improved the Japanese font and line spacing, how easily heading levels can be told apart, the look of tables (header row and row coloring), quotes, code and `<kbd>`, the display of the current page in the nav, and the table of contents and the links to the previous and next pages.
  - Wa: as its description says, now ink-colored text and vermilion links on an unbleached background (before, it was blue links on a white background). Headings are serif.
  - Muji: the body is in an easy-to-read sans-serif, and only headings, the nav and code are in a monospaced font. No colors are used.
  - Sumi: warm white text and a pale blue accent color on an ink-colored background. The colors of code and notices were also adjusted to the dark background.
  - Ai: made pages with a lot of information easier to read with indigo headings (underline and a band on the left) and an indigo-white table header row and row coloring.
  - Shu: made the pages impressive with headings with a thick vermilion underline or band, and tables with a vermilion header row.

<!-- ja -->

### 変更

- 組み込みの5つのテーマ(和・無地・墨・藍・朱)のデザインを、それぞれの特徴を強めつつ実用的に作り直した。
  - 共通: 日本語のフォントと行間、見出しの階層の見分けやすさ、表(見出し行・行の色分け)・引用・コード・`<kbd>`の
    見た目、ナビで今いるページの表示、目次・前後のページのリンクを整えた。
  - 和: 説明どおり、生成り地に墨色の文字・朱色のリンクにした(これまでは白地に青いリンクだった)。見出しは明朝体。
  - 無地: 本文は読みやすいゴシック体にし、見出し・ナビ・コードだけを等幅フォントにした。色は使わない。
  - 墨: 墨色の地に温かみのある白い文字と淡い青の差し色。コード・注意書きの色も暗い地に合わせた。
  - 藍: 藍色の見出し(下線・左の帯)と、藍白の表の見出し行・行の色分けで、情報の多いページを読みやすくした。
  - 朱: 朱の太い下線・帯の見出しと、朱の見出し行の表で、印象の強いページにした。

## [1.7.0] - 2026-09-28

### Added

- Added a light/dark switch button to the nav (the chosen display is saved in the browser; it is not shown if the theme has no difference between light and dark).
- Directories in the nav can now be folded (`<details>`; only the upper levels and the directory containing the current page are left open).
- Search results on the site can now be selected with the keyboard (move with ↓↑, open with Enter, go back with Esc).
- `preview --open` (opens the site in the browser once started).
- `init` now also asks for the nav (`NAV_ENABLED`) and the site name (`SITE_NAME`) (they can be specified without interaction with `--no-nav` and `--site-name`).
- Animations are no longer applied for people who have set reduced motion in the OS (`prefers-reduced-motion`).

### Changed

- Stopped embedding the CSS in every page, and now load a shared file for each content (`tsuzuri-<hash>.css`) (from the second page on, the browser cache takes effect).
- The config file newly created by `init` now shows the nav (`NAV_ENABLED=true`).

### Security

- mermaid is now loaded after verifying its hash (SRI). If its content has been replaced on the CDN, it is not loaded.
- The generated workflow now installs the build dependencies with `npm ci` exactly as in `.github/tsuzuri/package-lock.json` (it stops if the hash of the downloaded content differs), and also verifies the signatures with `npm audit signatures`.

### Security

- Updates of development dependencies (Dependabot) are now limited to stable versions that have been out for 30 days (`cooldown`).
- Dependency install scripts are no longer run (`.npmrc` and `npm ci --ignore-scripts` in CI), and CI now verifies signatures with `npm audit signatures`.

<!-- ja -->

### 追加

- ナビにライト/ダーク表示の切り替えボタンを付けた(選んだ表示はブラウザに保存する。テーマにライト/ダークの違いが
  無い場合は表示しない)。
- ナビのディレクトリを折りたためるようにした(`<details>`。上の階層と、今のページがあるディレクトリだけを開いておく)。
- サイト内検索の結果を、キーボード(↓↑で移動・Enterで開く・Escで戻る)で選べるようにした。
- `preview --open`(起動したらブラウザでサイトを開く)。
- `init`で、ナビ(`NAV_ENABLED`)とサイト名(`SITE_NAME`)も聞くようにした(`--no-nav`・`--site-name`で対話なしに指定できる)。
- OSで動きを減らす設定にしている人には、アニメーションを付けないようにした(`prefers-reduced-motion`)。

### 変更

- CSSを各ページに埋め込むのをやめ、内容ごとの共通ファイル(`tsuzuri-<ハッシュ>.css`)を読み込むようにした
  (2ページ目以降はブラウザのキャッシュが効く)。
- `init`で新しく作る設定ファイルは、ナビを表示する(`NAV_ENABLED=true`)ようにした。

### セキュリティ

- mermaidを、ハッシュを確かめて(SRI)読み込むようにした。CDNで中身が差し替えられていたら読み込まない。
- 生成するワークフローは、ビルド用の依存を`.github/tsuzuri/package-lock.json`のとおりに`npm ci`でインストールし
  (ダウンロードした中身のハッシュが違えば止まる)、`npm audit signatures`で署名も確認するようにした。

### セキュリティ

- 開発用の依存の更新(Dependabot)を、公開から30日たった安定版だけにした(`cooldown`)。
- 依存のインストールスクリプトを実行しないようにし(`.npmrc`・CIの`npm ci --ignore-scripts`)、
  CIで`npm audit signatures`による署名の確認を行うようにした。

## [1.6.0] - 2026-09-28

### Added

- Frontmatter `nav: false` (do not put that page in the nav or in the links to the previous and next pages) and `order` (the order in the nav; pages with a smaller value come first; for a directory, the `order` of the README.md / index.md inside it is used).
- A "Copy" button is now added at the top right of code blocks (only pages that have a code block load `tsuzuri-copy.js`).
- For a page without `description` in its frontmatter, the description (meta description and og:description) is now created from the first paragraph of the body.
- In `preview`, the site is now rebuilt automatically when you save a file, and the open page is reloaded (it can be turned off with `--no-watch`).
- The version of mermaid is now monitored by Dependabot (`deps/mermaid/package.json`).

<!-- ja -->

### 追加

- frontmatterの`nav: false`(そのページをナビ・前後のページのリンクに載せない)と`order`(ナビでの並び順。
  書いたページが小さい順に先に並ぶ。ディレクトリはその中の README.md / index.md の`order`)。
- コードブロックの右上に「コピー」ボタンを付けるようにした(コードブロックがあるページだけが`tsuzuri-copy.js`を読み込む)。
- frontmatterに`description`が無いページは、本文の最初の段落から説明文(meta description・og:description)を作るようにした。
- `preview`で、ファイルを保存すると自動でビルドし直し、開いているページを再読み込みするようにした(`--no-watch`で止められる)。
- mermaidのバージョンをDependabotで監視するようにした(`deps/mermaid/package.json`)。

## [1.5.0] - 2026-09-28

### Added

- The `preview` subcommand (`npx github:akilasatolu/tsuzuri#v1 preview`). It builds the site locally with the same settings as for publishing and shows it at `http://localhost:4000/` (if the build dependencies are missing, it installs the same versions as the workflow; the port can be changed with `--port`).
- Frontmatter `styleFile`. That page alone uses the specified custom CSS instead of the site-wide `STYLE_FILE` (if you specify an empty file, no custom CSS is applied to that page).
- A warning is now shown when the heading of a link to a heading (`page.md#heading`, `#heading`) does not exist, and the build fails with `STRICT_LINKS=true`.
- Markdown images now get `width` and `height` read from the image file (so that the layout does not shift while loading; PNG, GIF, JPEG, WebP, and SVG with a size written in it).
- CI now checks the workflows (including the generated workflow) with actionlint.

### Changed

- The directory that Tsuzuri output last time (the one with the `.tsuzuri-build` marker) is now emptied before building (so that deleted or renamed pages do not remain). A directory without the marker is not deleted.
- Video, audio and PDF in directories starting with `.`, such as `.github/`, are now also copied to the site if they are linked (they are output to a path such as `_.github/`).

<!-- ja -->

### 追加

- `preview`サブコマンド(`npx github:akilasatolu/tsuzuri#v1 preview`)。公開時と同じ設定でサイトを手元に
  ビルドし、`http://localhost:4000/`で表示する(ビルド用の依存が無ければワークフローと同じ版を入れる。
  `--port`でポートを変更できる)。
- frontmatterの`styleFile`。そのページだけ、サイト全体の`STYLE_FILE`の代わりに指定した独自CSSを使う
  (中身が空のファイルを指定すれば、そのページには独自CSSを当てない)。
- 見出しへのリンク(`page.md#見出し`・`#見出し`)の見出しが無いときに警告し、`STRICT_LINKS=true`では
  ビルドを失敗させるようにした。
- Markdownの画像に、画像ファイルから読み取った`width`・`height`を付けるようにした(読み込み中にレイアウトが
  ずれないように。PNG・GIF・JPEG・WebP、大きさが書かれたSVG)。
- CIで、ワークフロー(生成するワークフローを含む)をactionlintで確認するようにした。

### 変更

- 前回Tsuzuriが出力したディレクトリ(目印の`.tsuzuri-build`がある)は、ビルドの前に空にするようにした
  (削除・改名したページが残らないように)。目印の無いディレクトリは消さない。
- `.github/`など`.`で始まるディレクトリにある動画・音声・PDFも、リンクされていればサイトにコピーするようにした
  (`_.github/`のようなパスに出力する)。

## [1.4.0] - 2026-09-27

### Added

- When building locally (outside GitHub Actions), the values of `.github/docs-pages.config` are now used. For keys specified as environment variables, the environment variable takes priority, and the OS `LANG` (such as `ja_JP.UTF-8`) is ignored. If `STYLE_DIR` is omitted, `.github/tsuzuri/styles` copied by `init` is used if it exists.
- Files from raw HTML `<video src>`, `<audio src>` and `<source src>` are now also copied to the site.

### Fixed

- Pages and images placed in directories starting with `.`, such as `.github/`, were not included in the published site (because they are excluded from the artifact uploaded to Pages). They are now output to a path with `_` at the beginning, such as `_.github/`.
- Links to pages and images whose file names contain `#`, `%`, spaces and so on (in the body, the nav and the previous/next page links) were broken.
- Linked files (for example a hand-written `index.html`) were overwriting generated pages and files created by the build. Overlapping files are now not copied and a warning is shown, and the build fails with `STRICT_LINKS=true`.
- Omitting `OUT_DIR` in the config file or leaving it empty caused the upload to Pages to fail.
- The trigger branch of `init --yes` was the branch being worked on when there was no origin. Without interaction, it is now the default branch of the repository (`main` if unknown).
- Aligned the wording of the warning shown when the URL on GitHub is unknown in a local build with the actual behavior.

<!-- ja -->

### 追加

- 手元でビルドするとき(GitHub Actionsの外)は、`.github/docs-pages.config`の値を使うようにした。
  環境変数で指定したキーは環境変数が優先で、OSの`LANG`(`ja_JP.UTF-8`など)は無視する。
  `STYLE_DIR`を省略すると、`init`でコピーした`.github/tsuzuri/styles`があればそれを使う。
- 生のHTMLの`<video src>`・`<audio src>`・`<source src>`のファイルもサイトにコピーするようにした。

### 修正

- `.github/`など`.`で始まるディレクトリに置いたページ・画像が、公開サイトに載らなかった
  (Pagesへ上げる成果物から除外されるため)。`_.github/`のように先頭に`_`を付けたパスに出力する。
- ファイル名に`#`・`%`・空白などを含むページ・画像へのリンク(本文・ナビ・前後のページ)が壊れていた。
- リンクしたファイル(例: 手書きの`index.html`)が、生成したページやビルドが作るファイルを
  上書きしていた。重なるものはコピーせずに警告し、`STRICT_LINKS=true`ではビルドを失敗させる。
- 設定ファイルで`OUT_DIR`を省略・空にすると、Pagesへのアップロードで失敗していた。
- `init --yes`のトリガーブランチが、origin が無いと作業中のブランチになっていた。対話なしでは
  リポジトリの既定ブランチ(分からなければ`main`)にする。
- 手元のビルドでGitHub上のURLが分からないときの警告文を、実際の挙動に合わせた。

## [1.3.0] - 2026-09-27

### Added

- `init` now also generates `.github/tsuzuri/.gitignore` (`node_modules/`) (so that the dependencies for local previews are not committed).
- `init` now shows a warning when run somewhere other than the top of the repository or when there is no starting Markdown file (in interactive mode, it asks whether to continue). The default trigger branch is guessed from the default branch of the repository.
- With `LAST_UPDATED=true`, `<lastmod>` is now output in `sitemap.xml`.
- Added a "skip to the body" link to pages with a nav (it jumps to `#tsuzuri-main`). Search results are now read aloud via `aria-live` and can be closed with `Esc`.

### Changed

- The display names in the nav and the previous/next page links are now the first h1 of the body when there is no `title` in the frontmatter (order of priority: `title` > h1 > site name (starting page) > file name; the same idea as `<title>`).
- When a Japanese sentence is broken across lines, no extra whitespace is inserted in the display any more (a line break between full-width characters is removed; this also covers the long vowel mark "ー", the middle dot "・", and line breaks right after `**emphasis**` and links. The inside of code blocks is not changed).
- The order of priority of `<title>` and og:title is now aligned with the display name in the nav (`title` > h1 > site name (starting page) > file path). A heading in raw HTML, such as `<h1 align="center">…</h1>` at the beginning of a README, is also treated as the h1.
- Links to paths without an extension are now handled according to what actually exists. A directory with `README.md` or `index.md` (`[guide](guide)`) goes to a page of the site, and files and directories that are not put on the site (`LICENSE`, `.env.example`, `src/` without a README) become links to the file or listing on GitHub. Those that do not exist are treated as broken links (subject to `STRICT_LINKS`). The URL on GitHub is built from environment variables set automatically on GitHub Actions, and in a local build from the git `origin` (only for GitHub) and the current branch name; if it is unknown, only a warning is shown.
- The default value of `STYLE_FILE` when omitted is now `.github/tsuzuri/styles/custom.css`, the same as the config generated by `init`, and no warning is shown when the file does not exist.
- The `aria-label` of the nav and the wording of "skip to the body" are now also available in English, according to `LANG`.

### Fixed

- Fixed a bug where links were rewritten even in examples of HTML written inside code blocks and inline code (`<a href="page.md">`). Links in HTML tags written in uppercase (`<A HREF>`) are now also rewritten and followed.
- Fixed a bug where images used in `404.md` at the top of the repository were not copied to the site.
- The URLs in `sitemap.xml`, canonical and `og:url` are now percent-encoded even for file names containing spaces or Japanese.

<!-- ja -->

### 追加

- `init`が`.github/tsuzuri/.gitignore`(`node_modules/`)も生成するようにした(手元でプレビューするときの依存をコミットしないため)。
- `init`をリポジトリの直下以外で実行したとき・起点のMarkdownが無いときに警告するようにした
  (対話形式では続けるかを確認する)。トリガーブランチの既定値は、リポジトリの既定ブランチから推測する。
- `LAST_UPDATED=true`のとき、`sitemap.xml`に`<lastmod>`を出力するようにした。
- ナビがあるページに「本文へスキップ」リンクを付けた(飛び先は`#tsuzuri-main`)。検索結果を`aria-live`で読み上げ、`Esc`で閉じられるようにした。

### 変更

- ナビ・前後のページの表示名を、frontmatterの`title`が無ければ本文の最初のh1にした
  (優先順: `title` > h1 > サイト名(起点のページ) > ファイル名。`<title>`と同じ考え方)。
- 日本語の文を途中で改行したとき、表示に余計な空白が入らないようにした(前後が全角文字の改行を取り除く。
  長音「ー」・中黒「・」や、`**強調**`・リンクの直後の改行も対象。コードブロックの中は変えない)。
- `<title>`・og:titleの優先順をナビの表示名とそろえた(`title` > h1 > サイト名(起点のページ) > ファイルパス)。
  README先頭の`<h1 align="center">…</h1>`のような生のHTMLの見出しもh1として扱う。
- 拡張子の無いパスへのリンクを、実在するものに合わせて扱うようにした。
  `README.md`・`index.md`のあるディレクトリ(`[guide](guide)`)はサイトのページへ、サイトに出さない
  ファイル・ディレクトリ(`LICENSE`・`.env.example`・READMEの無い`src/`)はGitHub上のファイル・一覧へのリンクにする。
  存在しないものはリンク切れとして扱う(`STRICT_LINKS`の対象)。GitHub上のURLは、GitHub Actionsでは
  自動で設定される環境変数から、手元のビルドではgitの`origin`(GitHubの場合のみ)と今のブランチ名から作り、
  分からなければ警告だけ出す。
- `STYLE_FILE`を省略したときの既定値を、`init`が生成する設定と同じ`.github/tsuzuri/styles/custom.css`にし、
  ファイルが無いときに警告を出さないようにした。
- ナビの`aria-label`・「本文へスキップ」の文言を`LANG`に合わせて英語にもするようにした。

### 修正

- コードブロック・インラインコードの中に書いたHTMLの例(`<a href="page.md">`)まで、リンクが書き換えられていた不具合を修正。
  大文字で書いたHTMLのタグ(`<A HREF>`)のリンクも書き換え・たどるようにした。
- リポジトリ直下の`404.md`で使っている画像が、サイトにコピーされていなかった不具合を修正。
- `sitemap.xml`・canonical・`og:url`のURLを、空白や日本語を含むファイル名でもパーセントエンコードするようにした。

## [1.2.0] - 2026-09-27

### Added

- GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) are now displayed in a frame for each kind (the headings are in Japanese or English according to `LANG`).
- Added support for footnotes (`text[^1]` and `[^1]: content`).
- ```` ```mermaid ```` code blocks are now displayed as diagrams (only pages with a diagram load mermaid from a CDN when viewed).
- Headings of h2 and below now get a link to that heading (`#`), shown when the cursor is over it.
- With `NAV_ENABLED=true`, a table of contents is now shown on pages with three or more headings (h2 and h3) (it can be turned off with `toc: false` in the frontmatter).
- Added the `LAST_UPDATED` setting. When set to `true`, the last updated date, found from the git history, is shown on each page.

### Changed

- Images now get `loading="lazy"` so they are not loaded until they come into view.
- The generated workflow now also installs `marked-footnote`, used for footnotes.
- When running `init` interactively and files already exist, the workflow and the whole set of build scripts are now decided with a single confirmation on whether to overwrite them together (to prevent overwriting only some of them and getting mismatched versions; the config file and the custom CSS are confirmed individually).
- Rewrote the comments of the generated config file as an explanation for users with a pointer to the public documentation.
- The update instructions (the completion message and the comment of the generated workflow) now use a command with `#v1` instead of the unreleased `main`.
- A link to a directory (`[Guide](guide/)`) now follows the `README.md` inside (or `index.md` if there is none). **A link to a directory that has neither is treated as a broken link**, so with `STRICT_LINKS=true` your build may fail after updating (for example `[src](src/)` written to show a list of source code). Rewrite such a link with a GitHub URL (`https://github.com/<owner>/<repo>/tree/main/src`).
- The `concurrency` of the generated workflow is now a group per branch (`docs-pages-<ref>`). Pushes to the same branch are processed in order, and a push to another branch no longer cancels a waiting publish.
- Removed functions that were no longer used (`renderTitle`, `extractMarkdownSyntaxLinks`, `stripCodeSpans`).
- At the end of `init --update`, new setting items that are missing from the config file (those that work with default values) are now reported.

### Fixed

- Fixed a bug where reference links (`[x][ref]`), links wrapped around images (badges), titles in single quotes, angle brackets (`<a b.md>`), paths containing parentheses, and links to directories (`guide/`) were not followed and resulted in a 404 on the published site. Links are now collected from the same marked parse result as rendering, and a link to a directory follows the `README.md` or `index.md` inside.
- Fixed a bug where the generated workflow ran `npm install` at the top of the repository, so the dependencies in the user's `package.json` were also installed, which sometimes failed (it is now installed separated in `.github/tsuzuri/`).
- Fixed a bug where runs other than publishing (deploy) were also in the same `concurrency` group, so a push to another branch sometimes cancelled a waiting publish (`concurrency` is now attached only to the publish job).
- Fixed a bug where wrapping a frontmatter value in quotes (`title: "My Site: Home"`) output it with the quotes.
- Fixed a bug where writing `ROOT_MD=./README.md` made the starting page be handled twice.
- Fixed a bug where, on a page without an h1, a `# comment` inside a code block was used as the title, and a bug where symbols such as `**` in the h1 remained in the title (the display text of the first rendered h1 is now used).
- Fixed a bug where `"` or `&` in the URL of a link or image broke the HTML attribute (they are now escaped).

<!-- ja -->

### 追加

- GitHubの注意書き(`> [!NOTE]`・`[!TIP]`・`[!IMPORTANT]`・`[!WARNING]`・`[!CAUTION]`)を、
  種類ごとの枠で表示するようにした(見出しは`LANG`に応じて日本語/英語)。
- 脚注(`本文[^1]`と`[^1]: 内容`)に対応した。
- ```` ```mermaid ```` のコードブロックを図として表示するようにした(図のあるページだけ、閲覧時に
  CDNからmermaidを読み込む)。
- h2以下の見出しに、その見出しへのリンク(`#`)を付けるようにした(カーソルを当てると表示)。
- `NAV_ENABLED=true`のとき、見出し(h2・h3)が3つ以上あるページに目次を表示するようにした
  (frontmatterの`toc: false`で消せる)。
- `LAST_UPDATED`設定を追加。`true`にすると、gitの履歴から求めた最終更新日を各ページに表示する。

### 変更

- 画像に`loading="lazy"`を付け、画面に入るまで読み込まないようにした。
- 生成するワークフローで、脚注用の`marked-footnote`もインストールするようにした。
- 対話形式の`init`で既存ファイルがあるとき、ワークフローとビルドスクリプト一式は1回の確認でまとめて
  上書きするかを決めるようにした(一部だけ上書きしてバージョンがずれるのを防ぐ。設定ファイル・独自CSSは個別に確認)。
- 生成する設定ファイルのコメントを、利用者向けの説明と公開ドキュメントへの案内に書き直した。
- 更新の案内(完了メッセージ・生成ワークフローのコメント)を、未リリースの`main`ではなく`#v1`付きのコマンドにした。
- ディレクトリへのリンク(`[ガイド](guide/)`)は、中の`README.md`(無ければ`index.md`)をたどるようにした。
  **どちらも無いディレクトリへのリンクは、リンク切れとして扱われる**ため、`STRICT_LINKS=true`の場合は
  更新後にビルドが失敗することがある(例: ソースコードの一覧を見せるための`[src](src/)`)。
  そのようなリンクは、GitHubのURL(`https://github.com/<owner>/<repo>/tree/main/src`)で書き換える。
- 生成するワークフローの`concurrency`を、ブランチごとのグループ(`docs-pages-<ref>`)にした。同じブランチへの
  pushは順番に処理され、ほかのブランチへのpushが待機中の公開を取り消すことはない。
- 使われなくなった関数(`renderTitle`・`extractMarkdownSyntaxLinks`・`stripCodeSpans`)を削除した。
- `init --update`の最後に、設定ファイルに無い新しい設定項目(既定値で動くもの)を案内するようにした。

### 修正

- 参照リンク(`[x][ref]`)・画像を囲んだリンク(バッジ)・単一引用符のタイトル・山括弧(`<a b.md>`)・
  括弧を含むパス・ディレクトリへのリンク(`guide/`)をたどらず、公開サイトで404になっていた不具合を修正。
  リンクは描画と同じmarkedの解析結果から集めるようにし、ディレクトリへのリンクは中の`README.md`・`index.md`をたどる。
- 生成ワークフローがリポジトリの直下で`npm install`していたため、利用者の`package.json`の依存まで
  インストールされ、失敗することがあった不具合を修正(`.github/tsuzuri/`に切り離してインストールする)。
- 公開(deploy)以外の実行も同じ`concurrency`グループに入っていたため、ほかのブランチへのpushで、
  待機中の公開が取り消されることがあった不具合を修正(`concurrency`を公開ジョブだけに付ける)。
- frontmatterの値を引用符で囲む(`title: "My Site: Home"`)と、引用符ごと出力されていた不具合を修正。
- `ROOT_MD=./README.md`のように書くと、起点のページが二重に扱われていた不具合を修正。
- h1が無いページで、コードブロック内の`# コメント`をタイトルにしていた不具合、h1の`**`等の記号が
  タイトルに残っていた不具合を修正(描画した最初のh1の表示テキストを使う)。
- リンク・画像のURLに`"`や`&`が含まれると、HTMLの属性が壊れていた不具合を修正(エスケープする)。

## [1.1.0] - 2026-09-27

### Added

- When the CLI runs, it now first shows the running version (`tsuzuri vX.Y.Z`). Also added `--version` (`-v`) and `--help` (`-h`). The version at the time of generation is also written in the first comment of the generated workflow.
- Added options to run `init` without interaction (`--yes`, `--branch`, `--root`, `--theme`, `--style`). Without interaction, existing files are skipped, and they are overwritten only when `--force` is given.
- Code blocks with a language name are now syntax-highlighted at build time with highlight.js (no JavaScript is needed when viewing). The colors follow the theme, and can be changed by specifying `--hl-*` variables in your own CSS.
- With `NAV_ENABLED=true`, a search within the site is now shown at the top of the nav.
- Added the `SITEMAP_JSON` setting. Only when it is `true`, a `sitemap.json` for debugging is output.

### Changed

- The `sitemap.json` for debugging is no longer output by default (because the paths of broken links and rejected links would be visible from the published site). Problems with links are still shown in the workflow log as before.
- When the starting page (`ROOT_MD`) has no `title` in its frontmatter, the site name (`SITE_NAME`) is now used as its display name in the nav.
- Stated the supported Node.js versions (20 or later) in `engines` of `package.json`, and CI now tries Node.js 20/22/24.
- An unknown option or subcommand now causes an error.

<!-- ja -->

### 追加

- CLIの実行時に、最初に実行中のバージョン(`tsuzuri vX.Y.Z`)を表示するようにした。
  `--version`(`-v`)・`--help`(`-h`)も追加。生成するワークフローの先頭コメントにも生成時のバージョンを記載する。
- `init`を対話なしで実行できるオプションを追加(`--yes`・`--branch`・`--root`・`--theme`・`--style`)。
  対話なしのときは既存ファイルをスキップし、`--force`を付けたときだけ上書きする。
- 言語名付きのコードブロックを、ビルド時にhighlight.jsで色分けするようにした(閲覧時のJavaScriptは不要)。
  色はテーマに合わせて決まり、独自CSSで`--hl-*`変数を指定すれば変えられる。
- `NAV_ENABLED=true`のとき、ナビの上部にサイト内検索を表示するようにした。
- `SITEMAP_JSON`設定を追加。`true`のときだけデバッグ用の`sitemap.json`を出力する。

### 変更

- デバッグ用の`sitemap.json`を既定では出力しないようにした(リンク切れや拒否したリンクのパスが
  公開サイトから見えてしまうため)。リンクの問題はこれまでどおりワークフローのログに表示される。
- 起点のページ(`ROOT_MD`)にfrontmatterの`title`が無い場合、ナビの表示名にサイト名(`SITE_NAME`)を使うようにした。
- 対応するNode.jsのバージョン(20以上)を`package.json`の`engines`に明記し、CIでNode.js 20/22/24を試すようにした。
- 不明なオプション・サブコマンドを指定したときはエラーにするようにした。

## [1.0.0] - 2026-09-27

First release.

### Added

**Setup**
- `npx github:akilasatolu/tsuzuri init` interactively generates the workflow, the config file and the set of build scripts. After generation, building and publishing are completed within the user's repository, without referring to Tsuzuri itself.
- `init --update` brings the workflow and build scripts up to date while keeping the config file and the custom CSS.
- The version can be specified with the tags `#v1` (the latest v1) and `#v1.0.0` (pinned).

**Site generation**
- Starting from `README.md` (`ROOT_MD`), it follows links and turns only the Markdown, images and other files (PDF and so on) that can be reached into the site. Links to Markdown are rewritten to `.html`.
- A directory's `README.md` is also output as `index.html`. `404.html` is also generated.
- Headings get an `id` by the same rules as GitHub, so links such as `page.md#heading` work.
- Outputs `sitemap.xml` and `robots.txt` for search engines, and canonical and OGP (`og:image` is an absolute URL).
- With `STRICT_LINKS=true`, the build fails when there are broken links, so publishing can be stopped.

**Look**
- You can choose from 5 themes (Wa, Muji, Sumi, Ai, Shu) and no decoration. It can also be switched per page (`theme` in frontmatter).
- Colors can be adjusted with CSS variables, in three layers: base CSS → theme → your own CSS.
- With `NAV_ENABLED=true`, it shows a nav of the directory hierarchy (a sidebar on wide screens, a "Menu" button on narrow screens) and links to the previous and next pages.

**Settings**
- In `.github/docs-pages.config` (`KEY=VALUE` format), you set the trigger branch, theme, language, favicon, site name, custom domain, OGP image and so on. All are optional.
- In frontmatter, you can specify `title`, `description`, `ogImage`, `ogType`, `noindex` and `theme` for each page.

**Safety**
- Paths pointing outside the repository (`../`, absolute paths, symbolic links) are neither read nor written.
- The generated workflow reads only known keys from the config file, and write permission to Pages is given only to the publish job.

<!-- ja -->

初回リリース。

### 追加

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

[Unreleased]: https://github.com/akilasatolu/tsuzuri/compare/v1.19.0...HEAD
[1.19.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.18.0...v1.19.0
[1.18.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.17.0...v1.18.0
[1.17.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.16.0...v1.17.0
[1.16.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.15.0...v1.16.0
[1.15.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/akilasatolu/tsuzuri/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/akilasatolu/tsuzuri/releases/tag/v1.0.0
