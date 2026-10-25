// CLI(bin/cli.mjs・bin/preview.mjs)の表示の文言カタログ。
//
//   - 言語は en(既定)と ja。--lang ja のときだけ日本語になる(OS のロケールや環境変数は見ない)。
//   - キーは "領域.名前" のフラットな文字列。en と ja で同じキー・同じ {変数} を持つ(test/messages.test.mjs が確かめる)。
//   - {name} の置き換えは、ビルドの画面文言(lib/i18n.mjs の UI_STRINGS)と同じ formatUi を使う。
//   - このファイルは利用者のリポジトリにはコピーされない(bin/ は配布対象外)。
//
// 文言を足すときは、en と ja の両方に同じキーを足す。
// `init --update` で上書きされるファイル(ワークフロー、.gitignore、package.json の description)は
// 言語に依存しない英語固定にするので、ここには入れない。

import { formatUi } from "../.github/scripts/lib/i18n.mjs";

export const CLI_LANGS = ["en", "ja"];
export const DEFAULT_CLI_LANG = "en";

export const MESSAGES = {
  en: {
    // --- writeGeneratedFiles のログ ---
    "log.skipped": "⏭ {path} skipped (existing file kept)",
    "log.created": "✔ {path} created",
    "log.overwritten": "✔ {path} overwritten",

    // --- 質問 ---
    "prompt.continue": "Continue anyway? (y/N): ",
    "prompt.triggerBranch": "? Trigger branch (TRIGGER_BRANCH) [{default}]: ",
    "prompt.rootMd": "? Root Markdown file (ROOT_MD) [{default}]: ",
    "prompt.nav": "? Show the sidebar navigation, site search and in-page table of contents? (NAV_ENABLED) (Y/n): ",
    "prompt.languages":
      "? Site languages (LANGUAGES; comma-separated, the first is the language of your README; e.g. ja / en / ja,en) [{default}]: ",
    "prompt.siteName": "? Site name (SITE_NAME; the repository name if empty) []: ",
    "prompt.overwriteBundle":
      "The workflow and the build scripts (under {vendorDir}/, except config) already exist. Overwrite them with the latest version? (y/N): ",
    "prompt.overwriteFile": "{path} already exists. Overwrite it? (y/N): ",

    // --- init の流れ ---
    "init.heading": "README → GitHub Pages auto-deploy setup\n",
    "init.cancelled": "Cancelled. Run it again at the root of the repository.",
    "init.listHeader": "\n--- The following files will be generated ---",
    "init.listItem": "  {path}  (target)",

    // --- init --update ---
    "update.intro":
      "Updating to the latest version (the settings file is not changed; the custom styles you put in styles/ are not changed either)\n",
    "update.done": "\nUpdate complete. You can review the changes with 'git diff'.",
    "update.missingKeys":
      "ℹ Keys missing from the settings file (defaults are used): {keys}\n  Add them to {config} if you want to use them. See: {docs}docs/configuration.html",
    "update.deleted": "✖ {path} deleted (no longer used by the latest version)",
    "update.noConfig": "{config} not found. Run init without --update the first time",

    // --- 場所・起点の警告(表示の ⚠ はコード側で付ける) ---
    "warn.notGit": "This does not look like a git repository. Run this at the root of the repository you want to publish.",
    "warn.notRoot":
      "This is not the root of the repository (root: {root}). The workflow does not work on GitHub unless it is placed in .github/workflows at the repository root.",
    "warn.missingRoot": "The root file {rootMd} does not exist yet. Create it before you push (the build fails without it).",

    // --- エラー ---
    "error.args": "Invalid arguments: {message} (use --help to see the usage)",
    "error.subcommand": "Unknown subcommand: {name} (use --help to see the usage)",
    "error.port": "--port needs a number from 1 to 65535 (given: {value})",
    "error.emptyValue": "--{name} cannot be empty",
    "error.languages":
      "--languages needs language tags separated by commas (e.g. ja / en / ja,en) (given: {value})",
    "error.lang": "--lang must be en or ja (given: {value})",
    "error.lockfilesMissing":
      "{dir}/package.json and package-lock.json were not found. The downloaded Tsuzuri package may be broken.",
    "error.fatal": "Error: setup failed. ({message})",

    // --- 完了メッセージ ---
    "complete.message": [
      "",
      "Setup complete. You can publish to GitHub Pages with these steps.",
      "",
      "  1. Make sure {rootMd} is in the repository (it is the entry point of the site)",
      '  2. In GitHub Settings > Pages, set Source to "GitHub Actions" (first time only)',
      "  3. If {triggerBranch} is not the default branch of the repository, add {triggerBranch} under Settings > Environments >",
      '     github-pages > "Deployment branches and tags" (first time only)',
      "  4. Commit the generated files and push to the {triggerBranch} branch",
      "",
      "After you push, the workflow runs in the Actions tab; when it finishes, the public URL is shown in Settings > Pages.",
      "The build scripts (under {vendorDir}/) are also copied into this repository,",
      "so nothing is fetched from an external repository at run time.",
      "(In {vendorDir}/, you may edit only the settings file config and your own custom styles in styles/. Do not edit base.css, default.css and the scripts.)",
      "",
      "To update to the latest version, run npx github:{repo}#{tag} init --update",
      "(the settings file and your own custom styles are kept, and the workflow, the scripts, base.css and default.css are updated).",
    ].join("\n"),

    // --- --help ---
    "help.text": [
      "Usage: npx github:{repo}[#v1] init [options]",
      "       npx github:{repo}[#v1] preview [--port <number>] [--no-watch] [--open]",
      "",
      "init: Run without options to generate the files, asking for the settings interactively.",
      "preview: Build the site locally with the same settings as when it is published, and serve it so you",
      "         can check it in a browser (run it at the root of a repository where init has already run).",
      "         It rebuilds automatically when you save a file.",
      "",
      "  --update           Update to the latest version without questions (overwrites the workflow and the build",
      "                     scripts, base.css and default.css, and does not change the settings file or the custom",
      "                     styles you put in styles/)",
      "  -y, --yes          Generate everything without questions, using the defaults (or the values given with the options below)",
      "      --branch <name> Trigger branch (TRIGGER_BRANCH). Default: the default branch of the repository",
      "                     (origin/HEAD; main if unknown)",
      "      --root <path>   Starting Markdown file (ROOT_MD). Default: README.md",
      "      --languages <list>",
      "                     Site languages (LANGUAGES; the first is the base language). Default: en",
      "      --site-name <name>",
      "                     Site name (SITE_NAME). Default: empty (the repository name is used at build time)",
      "      --no-nav       Do not show the navigation, site search and table of contents (NAV_ENABLED=false). Default: shown",
      "      --lang <en|ja> Language of the messages and of the comments in the generated settings file. Default: en",
      "      --force        When running without questions, overwrite existing files too (by default they are skipped)",
      "      --port <number> Port number used by preview. Default: 4000",
      "      --no-watch     In preview, do not watch for file changes (do not rebuild automatically)",
      "      --open         In preview, open the site in the browser on startup",
      "  -v, --version      Show the version",
      "  -h, --help         Show this help",
      "",
      "Giving any of --branch / --root / --languages / --site-name / --no-nav also runs without questions.",
    ].join("\n"),

    // --- 設定ファイルのコメント(init が .github/tsuzuri/config に書く。各ブロックの先頭は "# ") ---
    "config.header": [
      "# Tsuzuri settings file",
      "#",
      "# Write one item per line as KEY=VALUE. Lines starting with # and blank lines are ignored.",
      "# You can change the behavior here without editing the workflow (.github/workflows/tsuzuri-pages.yml).",
      "# Details of each item: {docs}docs/configuration.html",
    ].join("\n"),
    "config.triggerBranch": [
      "# The branch to deploy. The site is updated only when you push to this branch.",
      "# If omitted or empty, the repository's default branch is used.",
      "# If it is not the default branch (usually main), add it in GitHub under",
      "# Settings > Environments > github-pages > Deployment branches and tags.",
    ].join("\n"),
    "config.rootMd": "# The Markdown file that is the entry point of the site (path from the repository root)",
    "config.outDir": "# Where the built site is written (a folder in the repository)",
    "config.theme": [
      "# The custom style of the whole site: the file name of a CSS file in {vendorDir}/styles/ (write only the file name, not the folder).",
      "# The default, default.css, is included in the package. To use another one, download it from the gallery",
      "# ({docs}docs/gallery.html), put it in {vendorDir}/styles/ and write its file name here.",
    ].join("\n"),
    "config.languages": [
      "# Site languages, comma-separated; the first is the base language (the language of the starting README). Examples: ja / en / ja,en",
      '# With one language you get a single-language site (<html lang="..."> and the interface text use that language).',
      "# With two or more you get a multilingual site (how to place pages: {docs}docs/i18n.html). If empty, it is en.",
    ].join("\n"),
    "config.navEnabled":
      "# Whether to show the sidebar navigation, site search, in-page table of contents and links to the previous/next page (true/false)",
    "config.favicon":
      "# Image for the site's favicon (path from the repository root, e.g. assets/favicon.svg). Not used if empty.",
    "config.siteName":
      "# Site name (used in the navigation heading and og:site_name). If empty, the repository name is used.",
    "config.customDomain":
      "# Domain name when publishing on your own domain (e.g. docs.example.com). If empty, the site is published on github.io.",
    "config.ogp": [
      "# Default image shown when the site is shared on social media (OGP image): a path from the repository root, or a URL starting with https://.",
      "# To change it per page, write ogImage in that page's frontmatter.",
    ].join("\n"),
    "config.strictLinks":
      "# Whether to fail the build when there are broken links (true/false). With true, a site with broken links is not published.",
    "config.lastUpdated":
      "# Whether to show the last updated date (date of the last git commit) at the end of each page (true/false)",
    "config.editLink": '# Whether to add an "Edit this page on GitHub" link at the end of each page (true/false)',
    "config.repoLink":
      "# Whether to add a link to the GitHub repository at the end of each page (true/false). The repository URL is detected automatically.",
    "config.repoVersion":
      "# Version shown at the end of each page (e.g. v1.2.3). The string is shown as written (it is not updated automatically). Not shown if empty.",
    "config.repoLicense":
      "# License shown at the end of each page (e.g. MIT). The string is shown as written. Not shown if empty.",
    "config.llmsTxt": [
      "# Whether to create llms.txt, a table of contents for AI (LLMs), at the site root (true/false). It is true even if you don't write it.",
      "# It is created only when the site URL (SITE_ORIGIN) is known (builds on GitHub Actions). Set false if you don't want it.",
      "# If llms.txt exists at the repository root, it is not generated; that file is published as it is.",
    ].join("\n"),
    "config.sitemapJson":
      "# Whether to output sitemap.json for troubleshooting (true/false). It is included in the public site, so keep it false normally.",

    // --- preview ---
    "preview.noScript": "{vendorDir}/build-docs.mjs not found. Run init first (at the root of the repository).",
    "preview.versionMismatch":
      "⚠ The build scripts in this repository are v{vendored} (this command is v{version}). Building with v{vendored}, the same as the published site. Run init --update to get the latest.",
    "preview.noLock":
      "{vendorDir}/package-lock.json not found. The build scripts in this repository are old. Run init --update, then run preview again.",
    "preview.installing": "Installing the build dependencies (as listed in {vendorDir}/package-lock.json)",
    "preview.installFailed": "Failed to install the dependencies.",
    "preview.buildFailed": "The build failed (see the messages above).",
    "preview.portInUse": "Port {port} is in use. Choose another number with --port (e.g. --port 4001)",
    "preview.url": "\nPreview: {url}",
    "preview.changed": "\nChange detected, rebuilding...",
    "preview.rebuilt": "Rebuilt (reloading the open pages).",
    "preview.rebuildFailed": "The build failed. Fix it and save again to rebuild.",
    "preview.watching": "Rebuilds and reloads the page automatically when you save a file. Press Ctrl+C to quit.",
    "preview.watchFailed": "Could not watch for file changes ({message}). Run preview again after you change files.",
    "preview.noWatch": "After you change Markdown, run preview again. Press Ctrl+C to quit.",
    "preview.openFailed": "Could not open the browser. Open {url} yourself.",
  },

  ja: {
    "log.skipped": "⏭ {path} をスキップしました(既存ファイルを保持)",
    "log.created": "✔ {path} を作成しました",
    "log.overwritten": "✔ {path} を上書きしました",

    "prompt.continue": "このまま続けますか? (y/N): ",
    "prompt.triggerBranch": "? トリガーブランチ (TRIGGER_BRANCH) [{default}]: ",
    "prompt.rootMd": "? ルートとなるMarkdownファイル (ROOT_MD) [{default}]: ",
    "prompt.nav": "? サイドバーのナビ・サイト内検索・ページ内の目次を表示しますか? (NAV_ENABLED) (Y/n): ",
    "prompt.languages":
      "? サイトの言語 (LANGUAGES。カンマ区切りで、先頭は README の言語。例: ja / en / ja,en) [{default}]: ",
    "prompt.siteName": "? サイト名 (SITE_NAME。空ならリポジトリ名) []: ",
    "prompt.overwriteBundle":
      "ワークフローとビルドスクリプト一式({vendorDir}/ 配下。config を除く)は既に存在します。最新版で上書きしますか? (y/N): ",
    "prompt.overwriteFile": "{path} は既に存在します。上書きしますか? (y/N): ",


    "init.heading": "README → GitHub Pages 自動デプロイパッケージ セットアップ\n",
    "init.cancelled": "中止しました。リポジトリの直下で実行し直してください。",
    "init.listHeader": "\n--- 以下のファイルを生成します ---",
    "init.listItem": "  {path}  (対象)",

    "update.intro": "最新版に更新します(設定ファイルは変更しません。styles/ に置いたカスタムスタイルも変更しません)\n",
    "update.done": "\n更新が完了しました。変更内容は 'git diff' で確認できます。",
    "update.missingKeys":
      "ℹ 設定ファイルに無い項目があります(既定値で動きます): {keys}\n  使う場合は {config} に追記してください。説明: {docs}docs/configuration.html",
    "update.deleted": "✖ {path} を削除しました(最新版では使われていないため)",
    "update.noConfig": "{config} が見つかりません。初回は --update を付けずに init を実行してください",

    "warn.notGit": "git リポジトリの中ではないようです。公開したいリポジトリの直下で実行してください。",
    "warn.notRoot":
      "リポジトリの直下ではありません(直下: {root})。ワークフローはリポジトリ直下の .github/workflows に置かないと GitHub で動きません。",
    "warn.missingRoot": "起点の {rootMd} がまだありません。push する前に作成してください(無いとビルドが失敗します)。",

    "error.args": "引数が正しくありません: {message}(--help で使い方を表示します)",
    "error.subcommand": "不明なサブコマンドです: {name}(--help で使い方を表示します)",
    "error.port": "--port には 1〜65535 の番号を指定してください(指定: {value})",
    "error.emptyValue": "--{name} に空の値は指定できません",
    "error.languages":
      "--languages には言語タグをカンマ区切りで指定してください(例: ja / en / ja,en)(指定: {value})",
    "error.lang": "--lang には en / ja のどちらかを指定してください(指定: {value})",
    "error.lockfilesMissing":
      "{dir}/package.json・package-lock.json が見つかりません。Tsuzuri の取得物が壊れている可能性があります。",
    "error.fatal": "エラー: セットアップに失敗しました。 ({message})",

    "complete.message": [
      "",
      "セットアップが完了しました。次の手順で GitHub Pages に公開できます。",
      "",
      "  1. {rootMd} がリポジトリにあることを確認する(サイトの起点になります)",
      "  2. GitHub の Settings > Pages で、Source を「GitHub Actions」にする(初回のみ)",
      "  3. {triggerBranch} がリポジトリの既定ブランチでない場合は、Settings > Environments >",
      "     github-pages の「Deployment branches and tags」に {triggerBranch} を追加する(初回のみ)",
      "  4. 生成されたファイルをコミットし、{triggerBranch} ブランチへ push する",
      "",
      "push すると Actions タブでワークフローが動き、完了すると Settings > Pages に公開URLが表示されます。",
      "ビルドスクリプト本体({vendorDir}/ 配下)もこのリポジトリにコピー済みのため、",
      "実行時に外部リポジトリを参照することはありません。",
      "({vendorDir}/ 配下で編集してよいのは、設定ファイル config と、styles/ に置く自分のカスタムスタイルだけです。base.css・default.css・スクリプトは編集しないでください)",
      "",
      "最新版に更新するときは npx github:{repo}#{tag} init --update を実行してください",
      "(設定ファイルと、自分のカスタムスタイルはそのままに、ワークフロー・スクリプト・base.css・default.css が更新されます)。",
    ].join("\n"),

    "help.text": [
      "使い方: npx github:{repo}[#v1] init [オプション]",
      "        npx github:{repo}[#v1] preview [--port <番号>] [--no-watch] [--open]",
      "",
      "init: オプションを付けずに実行すると、対話形式で設定を聞きながらファイルを生成します。",
      "preview: 公開時と同じ設定でサイトを手元にビルドし、ブラウザで確認できるように配信します",
      "         (init 済みのリポジトリの直下で実行します)。ファイルを保存すると自動でビルドし直します。",
      "",
      "  --update           対話なしで最新版に更新する(ワークフローとビルドスクリプトを上書きし、",
      "                     設定ファイルと、styles/ に置いたカスタムスタイルは変更しない。base.css と default.css は上書きする)",
      "  -y, --yes          対話なしで、すべて既定値(または下のオプションで指定した値)で生成する",
      "      --branch <名前> トリガーブランチ(TRIGGER_BRANCH)。既定: リポジトリの既定ブランチ",
      "                     (origin/HEAD。分からなければ main)",
      "      --root <パス>   起点となるMarkdownファイル(ROOT_MD)。既定: README.md",
      "      --languages <一覧>",
      "                     サイトの言語(LANGUAGES。先頭が基本言語)。既定: en",
      "      --site-name <名前>",
      "                     サイト名(SITE_NAME)。既定: 空(ビルド時にリポジトリ名になる)",
      "      --no-nav       ナビ・サイト内検索・目次を表示しない(NAV_ENABLED=false)。既定: 表示する",
      "      --lang <en|ja> 表示するメッセージと、生成する設定ファイルのコメントの言語。既定: en",
      "      --force        対話なしのとき、既存ファイルも上書きする(既定では既存ファイルはスキップ)",
      "      --port <番号>   preview で使うポート番号。既定: 4000",
      "      --no-watch     preview で、ファイルの変更を見張らない(自動でビルドし直さない)",
      "      --open         preview で、起動したらブラウザでサイトを開く",
      "  -v, --version      バージョンを表示する",
      "  -h, --help         この説明を表示する",
      "",
      "--branch / --root / --languages / --site-name / --no-nav のいずれかを指定した場合も、対話なしで実行します。",
    ].join("\n"),

    "config.header": [
      "# Tsuzuri の設定ファイル",
      "#",
      "# 「KEY=VALUE」の形で1行に1項目を書きます。# で始まる行と空行は無視されます。",
      "# ワークフロー(.github/workflows/tsuzuri-pages.yml)を編集しなくても、ここを変えるだけで動作を変えられます。",
      "# 各項目の詳しい説明: {docs}docs/configuration.html",
    ].join("\n"),
    "config.triggerBranch": [
      "# 公開(デプロイ)するブランチ。このブランチに push したときだけサイトが更新されます。",
      "# 省略するか空にすると、リポジトリの既定ブランチになります。",
      "# リポジトリの既定ブランチ(通常は main)以外にする場合は、GitHub の",
      "# Settings > Environments > github-pages > Deployment branches and tags にこのブランチを追加してください。",
    ].join("\n"),
    "config.rootMd": "# サイトの入り口になる Markdown ファイル(リポジトリの直下からのパス)",
    "config.outDir": "# ビルドしたサイトの出力先(リポジトリ内のフォルダ)",
    "config.theme": [
      "# サイト全体のカスタムスタイル。{vendorDir}/styles/ の中のCSSファイルのファイル名(フォルダは書かず、ファイル名だけを書きます)。",
      "# 既定の default.css はパッケージに入っています。ほかのものは、ギャラリー({docs}docs/gallery.html)で",
      "# ダウンロードして {vendorDir}/styles/ に置き、ここにそのファイル名を書きます。",
    ].join("\n"),
    "config.languages": [
      "# サイトの言語。カンマ区切りで、先頭が基本言語(起点の README の言語)です。例: ja / en / ja,en",
      '# 1つなら1言語のサイト(ページの言語 <html lang="..."> と画面の文言がその言語になります)。',
      "# 2つ以上なら多言語のサイトになります(ページの置き方: {docs}docs/i18n.html)。空なら en です。",
    ].join("\n"),
    "config.navEnabled":
      "# サイドバーのナビゲーション・サイト内検索・ページ内の目次・前後のページへのリンクを表示するか(true/false)",
    "config.favicon": "# サイトの favicon にする画像(リポジトリの直下からのパス。例: assets/favicon.svg)。空なら使いません。",
    "config.siteName": "# サイト名(ナビの見出しと og:site_name に使います)。空ならリポジトリ名になります。",
    "config.customDomain": "# 独自ドメインで公開する場合のドメイン名(例: docs.example.com)。空なら github.io で公開します。",
    "config.ogp": [
      "# SNSでシェアされたときの画像(OGP画像)の既定値。リポジトリの直下からのパスか、https:// から始まるURL。",
      "# ページごとに変えたい場合は、そのページの frontmatter に ogImage を書きます。",
    ].join("\n"),
    "config.strictLinks":
      "# リンク切れがあるときにビルドを失敗させるか(true/false)。true にするとリンク切れのまま公開されません。",
    "config.lastUpdated": "# 各ページの末尾に最終更新日(git の最終コミット日)を表示するか(true/false)",
    "config.editLink": "# 各ページの末尾に「このページを GitHub で編集」のリンクを付けるか(true/false)",
    "config.repoLink":
      "# 各ページの末尾に GitHub のリポジトリへのリンクを付けるか(true/false)。リンク先はリポジトリの URL が自動で使われます。",
    "config.repoVersion":
      "# 各ページの末尾に表示するバージョン(例: v1.2.3)。ここに書いた文字列がそのまま表示されます(自動では更新されません)。空なら表示しません。",
    "config.repoLicense":
      "# 各ページの末尾に表示するライセンス(例: MIT)。ここに書いた文字列がそのまま表示されます。空なら表示しません。",
    "config.llmsTxt": [
      "# AI(LLM)向けにサイトの目次を書いた llms.txt を、サイトの直下に作るか(true/false)。書かなくても true です。",
      "# サイトの URL(SITE_ORIGIN)が決まっているとき(GitHub Actions でのビルド)だけ作られます。作りたくない場合は false にしてください。",
      "# リポジトリの直下に llms.txt を置くと、自動では作らず、それをそのままサイトに載せます。",
    ].join("\n"),
    "config.sitemapJson":
      "# 原因調査用の sitemap.json を出力するか(true/false)。公開サイトにも含まれるため、普段は false にしてください。",


    "preview.noScript": "{vendorDir}/build-docs.mjs がありません。先に init を実行してください(リポジトリの直下で実行します)。",
    "preview.versionMismatch":
      "⚠ このリポジトリのビルドスクリプトは v{vendored} です(このコマンドは v{version})。公開時と同じ v{vendored} でビルドします。最新にするには init --update を実行してください。",
    "preview.noLock":
      "{vendorDir}/package-lock.json がありません。このリポジトリのビルドスクリプトは古い版です。init --update で更新してから、もう一度 preview を実行してください。",
    "preview.installing": "ビルド用の依存をインストールします({vendorDir}/package-lock.json のとおり)",
    "preview.installFailed": "依存のインストールに失敗しました。",
    "preview.buildFailed": "ビルドに失敗しました(上のメッセージを確認してください)。",
    "preview.portInUse": "ポート {port} は使用中です。--port で別の番号を指定してください(例: --port 4001)",
    "preview.url": "\nプレビュー: {url}",
    "preview.changed": "\n変更を検知したので、ビルドし直します…",
    "preview.rebuilt": "ビルドし直しました(開いているページを再読み込みします)。",
    "preview.rebuildFailed": "ビルドに失敗しました。直してから保存すると、もう一度ビルドします。",
    "preview.watching": "ファイルを保存すると、自動でビルドし直してページを再読み込みします。終了するには Ctrl+C を押します。",
    "preview.watchFailed": "ファイルの変更を見張れませんでした({message})。変更したら preview を実行し直してください。",
    "preview.noWatch": "Markdown を変更したら、もう一度 preview を実行してください。終了するには Ctrl+C を押します。",
    "preview.openFailed": "ブラウザを開けませんでした。{url} を開いてください。",
  },
};

let currentLang = DEFAULT_CLI_LANG;

/** 値が CLI の言語(en / ja。小文字の完全一致)か */
export function isCliLang(value) {
  return typeof value === "string" && CLI_LANGS.includes(value);
}

/** 現在の言語を決める。en / ja 以外はプログラムの誤りとして RangeError */
export function setCliLang(lang) {
  if (!isCliLang(lang)) throw new RangeError(`Unsupported CLI language: ${String(lang)}`);
  currentLang = lang;
}

export function getCliLang() {
  return currentLang;
}

/**
 * argv から --lang の値を先読みして、使う言語を返す(parseArgs の前にエラー文の言語を決めるため)。
 * parseArgs と同じく、最後に現れた --lang X / --lang=X を見る。値が en / ja でなければ(値がない、
 * 次が - で始まる、fr など)en。"--" より後ろは見ない。
 * @param {string[]} argv
 * @returns {"en" | "ja"}
 */
export function detectLangFromArgv(argv = []) {
  let value;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") break;
    if (arg === "--lang") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        value = undefined;
      } else {
        value = next;
        i++;
      }
    } else if (arg.startsWith("--lang=")) {
      value = arg.slice("--lang=".length);
    }
  }
  return isCliLang(value) ? value : DEFAULT_CLI_LANG;
}

/**
 * キーの文言を、現在の言語(または lang)で返す。{name} は vars の値に置き換える。
 * その言語に無いキーは英語にする。英語にも無ければプログラムの誤りとして Error。
 * @param {string} key
 * @param {Record<string, unknown>} [vars]
 * @param {"en" | "ja"} [lang]
 * @returns {string}
 */
export function t(key, vars = {}, lang = currentLang) {
  const template = MESSAGES[lang]?.[key] ?? MESSAGES.en[key];
  if (template === undefined) throw new Error(`Unknown message key: ${key}`);
  return formatUi(template, vars);
}
