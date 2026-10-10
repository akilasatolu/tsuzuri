---
title: Reference for AI agents
order: 2
---

# Reference for AI agents

The box on this page holds a single text that gathers the facts about Tsuzuri,
from installation to publishing on GitHub Pages. The "Copy" button at its top
right copies the whole text, which can then be pasted into the AI agent of
your choice.

The content reflects Tsuzuri v1.31.0. The step-by-step guide written for
people is [Getting Started](getting-started.md).

````markdown
# Tsuzuri reference

- Covers: Tsuzuri v1.31.0 (v1 series)
- Last verified: 2026-10-10
- Official documentation: https://akilasatolu.github.io/tsuzuri/
- Source code: https://github.com/akilasatolu/tsuzuri

This document describes how Tsuzuri is installed, configured, used to write
pages, and published to GitHub Pages. Its content is based on the source code
and the official documentation of the version above.

## 1. Overview of Tsuzuri

Tsuzuri is a tool that starts from a repository's `README.md`, follows the
Markdown links, and turns the connected Markdown files and images into a
GitHub Pages site. The license is MIT.

Tsuzuri consists of the following four parts.

- The setup command: it has two subcommands, `init` (installation and
  updating) and `preview` (checking the site locally). It is fetched with
  `npx` from the GitHub repository, not from the npm registry.
- The build script: `init` copies it into `.github/tsuzuri/` of the user's
  repository. It converts Markdown into HTML.
- The workflow: `.github/workflows/docs-pages.yml`. It builds the site and
  deploys it to GitHub Pages on GitHub Actions.
- The settings file: `.github/docs-pages.config`.

After `init`, the workflow runs only on files inside the user's repository.
It does not fetch the Tsuzuri repository on each run.

## 2. Prerequisites

- The target is a GitHub repository. The site is published with GitHub Pages.
  The conditions for using GitHub Pages are defined by GitHub.
- The commands run through `npx` (`init` and `preview`) work on Node.js 20 or
  later. The local Node.js is used only while these commands run.
- Building and deploying happen on GitHub Actions. The workflow uses
  Node.js 24.
- The permissions used by the workflow are declared inside the workflow file.
  The workflow as a whole has `contents: read`, and only the deploy job has
  `pages: write` and `id-token: write`. There are no secrets for the user to
  register.
- The settings the user makes on the GitHub side are the two in chapter 8.

## 3. Installation (init)

### 3.1 Command

The user runs the following command at the root of the repository that is to
be published.

```
npx github:akilasatolu/tsuzuri#v1 init
```

- `#v1` is a tag that points to the latest release of the v1 series. A full
  version such as `#v1.31.0` pins that release. Without the part from `#`
  onward, the content of the `main` branch runs, which can include changes
  that are not released yet.
- The command prints the running version on its first line, in the form
  `tsuzuri v1.31.0`.
- The screen output of `init` and `preview` is in Japanese. The comments in
  the generated settings file and workflow are in Japanese too.
- `init` can be omitted. Without a subcommand, the command behaves as `init`.

### 3.2 Where the command runs

GitHub runs only the workflows placed in `.github/workflows/` at the root of
a repository. When `init` runs outside a git repository, or somewhere other
than the root of the repository, `init` prints a warning. In interactive
mode, it then shows the following question.

`このまま続けますか? (y/N): ` (continue anyway?)

With an empty answer or `n`, `init` exits without generating anything.

### 3.3 Interactive questions

Without options, `init` shows the following seven questions in order. An
empty answer (Enter alone) results in the default in brackets.

1. `? トリガーブランチ (TRIGGER_BRANCH) [main]: ` (trigger branch)
   The branch to deploy. The default is the default branch of `origin`, or
   the current branch when that is unknown, or `main` when that is unknown
   too.
2. `? ルートとなるMarkdownファイル (ROOT_MD) [README.md]: ` (the root Markdown file)
   The Markdown file that is the entry point of the site. The default is
   `README.md`.
3. The third question shows the themes (`THEME`) as a list numbered 1 to 8
   and accepts a number. The numbers map to themes as follows.

   - 1: `material`
   - 2: `glass`
   - 3: `neumorphism`
   - 4: `editorial`
   - 5: `minimal`
   - 6: `blueprint`
   - 7: `nineties`
   - 8: `none`

   An empty answer, a number outside 1 to 8, or a non-numeric answer results
   in `material`.
4. `? サイドバーのナビ・サイト内検索・ページ内の目次を表示しますか? (NAV_ENABLED) (Y/n): ` (show the sidebar navigation, the site search and the in-page table of contents?)
   The default is "show".
5. `? サイトの言語 (LANGUAGES。カンマ区切りで、先頭は README の言語。例: ja / en / ja,en) [en]: ` (site languages, comma-separated, the README's language first)
   The default is `en`. A value that is not a valid language tag (for
   example `ja_JP`) is ignored with a warning. When no valid value is left,
   the result is `en`.
6. `? サイト名 (SITE_NAME。空ならリポジトリ名) []: ` (site name; the repository name when empty)
   The default is empty. When it is empty, the repository name becomes the
   site name in builds on GitHub Actions.
7. `? 独自CSS用の空ひな形ファイル(.github/tsuzuri/styles/custom.css)を作成しますか? (y/N): ` (create an empty template file for custom CSS?)
   The default is "not created".

### 3.4 Non-interactive runs

With any of the following options, `init` generates the files without asking
questions.

- `-y`, `--yes`: `init` generates everything with the defaults.
- `--branch <name>`: the value of `TRIGGER_BRANCH`.
- `--root <path>`: the value of `ROOT_MD`.
- `--theme <name>`: the value of `THEME`.
- `--languages <list>`: the value of `LANGUAGES` (for example `ja`, `ja,en`).
- `--site-name <name>`: the value of `SITE_NAME`.
- `--no-nav`: results in `NAV_ENABLED=false`.
- `--style`: `init` also generates the empty custom CSS template.

Example:

```
npx github:akilasatolu/tsuzuri#v1 init --yes --branch main --languages ja
```

- In a non-interactive run, the default trigger branch is the default branch
  of `origin`, or `main` when that is unknown. The current branch is not
  used.
- In a non-interactive run, files that already exist are left as they are.
  With `--force`, they are overwritten.
- An unknown option, a `--theme` other than the eight theme names, a
  `--languages` that is not a valid language tag, and an empty `--branch`,
  `--root` or `--languages` each result in an error. In that case `init`
  generates nothing.

The other options are as follows.

- `--update`: `init` performs the update in chapter 10.
- `-v`, `--version`: the command prints the version.
- `-h`, `--help`: the command prints the usage.

### 3.5 Generated files

- `.github/workflows/docs-pages.yml`: the workflow
- `.github/docs-pages.config`: the settings file
- `.github/tsuzuri/build-docs.mjs`: the build script
- `.github/tsuzuri/lib/*.mjs`: the modules the build script uses (14 files)
- `.github/tsuzuri/styles/*.css`: the base CSS (`base.css`) and the CSS of
  the 7 themes
- `.github/tsuzuri/package.json`, `.github/tsuzuri/package-lock.json`:
  the versions and hashes of the build dependencies (marked, highlight.js,
  marked-footnote)
- `.github/tsuzuri/.gitignore`: excludes `node_modules/` from git
- `.github/tsuzuri/styles/custom.css`: the empty custom CSS template (only
  when the seventh question is answered with `y`, or with `--style`)

The build script and the theme CSS inside `.github/tsuzuri/` are not files
for the user to edit. Editing or deleting them can make the build fail. They
are also overwritten by the update in chapter 10.

### 3.6 What init does not do

- `init` does not commit or push.
- `init` does not change the Pages and Environments settings on GitHub.
- `init` does not create the root Markdown file (the file named by
  `ROOT_MD`). When the file is missing, `init` prints a warning.
- `init` does not change the `.gitignore` at the root of the repository. In
  a repository whose `.gitignore` has no `_site/`, the output of a local
  build shows up as untracked files in git.

### 3.7 Existing repositories and new repositories

The command and the steps are the same for both. The differences are as
follows.

- In a repository without the root Markdown file (a freshly created
  repository, for example), the build ends with an error until that file
  exists.
- In a repository without `origin`, the default trigger branch is the
  current branch in interactive mode, and `main` in a non-interactive run.
- When a file with the same name already exists at the destination,
  interactive `init` asks whether to overwrite it. For the workflow and the
  whole of `.github/tsuzuri/`, it asks once for all of them.

  `ワークフローとビルドスクリプト一式(.github/tsuzuri/ 配下)は既に存在します。最新版で上書きしますか? (y/N): ` (the workflow and the build script already exist; overwrite them with the latest version?)

  For the settings file and `custom.css`, it asks file by file.

  `.github/docs-pages.config は既に存在します。上書きしますか? (y/N): ` (the file already exists; overwrite it?)

  With an empty answer or `n`, that file is left unchanged.

## 4. Settings file

### 4.1 Location and format

- The location is `.github/docs-pages.config`.
- Each setting is one line in the form `KEY=VALUE`.
- Lines starting with `#` and empty lines are ignored.
- Whitespace around a value is removed.
- Text after a `#` that follows a value is not a comment. It becomes part of
  the value.
- Quotation marks become part of the value. Multi-line values and nested
  structures are not supported.
- Keys that are not in the list are ignored. The workflow on GitHub Actions
  prints a warning for them. Local builds and `preview` print no warning.
- `LANG` is a retired key. When it is present, it is ignored with a warning.
- Keys that take `true` or `false` are case-insensitive. Any other value
  becomes `false` with a warning.

### 4.2 Settings keys

There are 15 keys, and every one of them can be omitted. "When omitted"
covers both a missing key and an empty value. "Value from init" is the value
written in the settings file that `init` generates.

- `TRIGGER_BRANCH`: the branch to deploy. A push to this branch updates the
  site.
  When omitted: the default branch of the repository (the default branch in
  the GitHub settings, usually `main`).
  Value from init: the answer to question 1.
- `ROOT_MD`: the Markdown file that is the entry point of the site. The
  value is a path from the root of the repository. When the file is missing,
  or the path points outside the repository, the build ends with an error.
  When omitted: `README.md`
  Value from init: the answer to question 2.
- `OUT_DIR`: where the build output goes. The value is a subdirectory inside
  the repository. A path outside the repository and the root of the
  repository (`.`) result in an error. When the output directory contains a
  file named `.tsuzuri-build`, the build deletes everything in the output
  directory before writing. The build places this file automatically.
  When omitted: `_site`
  Value from init: `_site`
- `STYLE_FILE`: the custom CSS file. When the file exists, it is loaded
  after the theme. When the file is missing, it is not used.
  When omitted: `.github/tsuzuri/styles/custom.css`
  Value from init: `.github/tsuzuri/styles/custom.css`
- `THEME`: the theme. The values are the eight names `material`, `glass`,
  `neumorphism`, `editorial`, `minimal`, `blueprint`, `nineties` and `none`.
  Any other value becomes `material` with a warning.
  When omitted: `material`
  Value from init: the answer to question 3.
- `LANGUAGES`: the site languages. The value is a comma-separated list of
  language tags such as `ja`, `en` and `pt-BR`. The first one is the base
  language, which is the language of the root Markdown file. One language
  makes a single-language site, and two or more make a multilingual site.
  Invalid tags and duplicated tags are ignored with a warning.
  When omitted: `en`
  Value from init: the answer to question 5.
- `NAV_ENABLED`: whether the sidebar navigation, the site search, the
  in-page table of contents, the links to the previous and next pages, and
  the light/dark toggle button are shown.
  When omitted: `false`
  Value from init: the answer to question 4 (the default is `true`).
- `FAVICON_FILE`: the image used as the favicon. The value is a path from
  the root of the repository.
  When omitted: there is no favicon.
  Value from init: empty
- `SITE_NAME`: the site name. It is used for the navigation title and
  `og:site_name`.
  When omitted: the repository name in builds on GitHub Actions. It is empty
  in local builds.
  Value from init: the answer to question 6.
- `CUSTOM_DOMAIN`: the custom domain (for example `docs.example.com`). A
  value that contains `https://` or a path is ignored with a warning. When
  it is set, a `CNAME` file is generated in the output directory.
  When omitted: no custom domain is used.
  Value from init: empty
- `OGP_DEFAULT_IMAGE`: the OGP image for pages whose frontmatter has no
  `ogImage`. The value is a path from the root of the repository, or a URL
  starting with `https://`.
  When omitted: `og:image` is not output.
  Value from init: empty
- `STRICT_LINKS`: with `true`, the build fails when there is a link problem,
  and the site is not updated. The problems covered are broken links, links
  pointing outside the repository, missing images and files, overlapping
  output paths, links to a heading that the target page does not have, and
  duplicated versions of one page in one language.
  When omitted: `false` (problems are shown as warnings, and the site is
  published as it is)
  Value from init: `false`
- `LAST_UPDATED`: with `true`, each page shows, at its end, the date of its
  last git commit.
  When omitted: `false`
  Value from init: `false`
- `EDIT_LINK`: with `true`, each page gets, at its end, a link to the edit
  screen on GitHub. When the branch is unknown (a tag was built, or there is
  no `origin` locally, for example), the link is not added.
  When omitted: `false`
  Value from init: `false`
- `SITEMAP_JSON`: with `true`, a `sitemap.json` for investigation is written
  to the output directory. It is included in the published site as well.
  When omitted: `false`
  Value from init: `false`

### 4.3 Values decided automatically

The path at the start of the site URL (`BASE_PATH`) is not a settings key.
The workflow decides it as follows.

- With `CUSTOM_DOMAIN`: no path is added. The site is
  `https://<CUSTOM_DOMAIN>/`.
- When the repository name has the form `<owner>.github.io`: no path is
  added. The site is `https://<owner>.github.io/`.
- Otherwise: `/<repo>` is added. The site is
  `https://<owner>.github.io/<repo>/`.

## 5. Writing and editing pages

### 5.1 Pages included in the site

- The build starts from the root Markdown file and collects pages by
  following Markdown links one after another.
- Only the Markdown files reachable by links from the root are included in
  the site. A Markdown file that nothing links to is not included, even when
  it sits in the same folder.
- Adding a page takes two things: placing the Markdown file, and linking to
  it from a page that is already in the site.
- Links starting with `http://`, `https://`, `mailto:` and the like, and
  links that are only `#`, are not followed.
- Links written inside code blocks and inline code are not followed, not
  rewritten, and not checked for broken links.

### 5.2 Output files and URLs

- `docs/faq.md` becomes `docs/faq.html`. Links to `.md` inside Markdown are
  rewritten to `.html` links automatically.
- The root Markdown file also becomes the top of the site (`index.html`).
- A `README.md` in a subdirectory also becomes the `index.html` of that
  directory (`guide/README.md` opens at `guide/`). When the same directory
  has an `index.md`, the `index.md` becomes the `index.html`.
- A link to a directory (`guide/`) becomes a link to the page of the
  `README.md` or `index.md` inside it.
- Images (png, jpg, jpeg, gif, svg, webp, bmp, ico) are copied only when
  they are linked.
- Other files with an extension (PDF, zip and so on) are also copied only
  when they are linked.
- Files whose name starts with `.` are not copied. Inside directories whose
  name starts with `.`, only Markdown, images, PDF, video and audio are
  output to the site. Their output path gets a leading `_`
  (`.github/logo.png` becomes `_.github/logo.png`).
- Links to files without an extension (such as `LICENSE`) and to directories
  that have neither `README.md` nor `index.md` become links to the file or
  the listing on GitHub.
- When the target of a link does not exist, the link appears in the build
  log as a broken link.

### 5.3 Page titles and navigation

- The page title is decided in this order: `title` in the frontmatter, the
  first h1 heading in the body, the site name (for the root page), the file
  path.
- The navigation is a hierarchy that follows the directory structure of the
  repository. The order is the order in which pages are found by following
  links from the root. The order of the links written in the root Markdown
  file becomes the order as it is.
- There is no navigation definition file.

### 5.4 Frontmatter

Frontmatter is a set of `key: value` lines placed at the top of a Markdown
file, enclosed in `---`.

```markdown
---
title: Getting Started
description: How to set up the site
order: 1
---

# Getting Started
```

- Only the single-line `key: value` form is supported. Arrays, nesting and
  multi-line values are not supported.
- Quotation marks that enclose a whole value are removed.
- When the closing `---` is missing, a warning is shown and the whole block
  is treated as body text.
- The language of a page is not decided by frontmatter (chapter 6).

The keys are the following 10.

- `title`: the page title. It is also used as the name in the navigation.
- `description`: the description. When it is missing, a description of up to
  120 characters is made from the first paragraph of the body.
- `ogImage`: the OGP image. The value is one of: a path relative to the
  file, a path from the root of the repository starting with `/`, or a URL
  starting with `https://`.
- `ogType`: the value of `og:type`. When it is missing, the value is
  `website`.
- `noindex`: with `true`, the `noindex` tag for search engines is output,
  and the page is left out of `sitemap.xml`.
- `theme`: the theme for that page alone. The value is one of the eight
  theme names, or the path of a CSS file from the root of the repository.
- `styleFile`: the CSS file used for that page alone in place of
  `STYLE_FILE`. The value is a path from the root of the repository.
- `nav`: with `false`, the page is left out of the navigation and of the
  links to the previous and next pages. The page itself is output.
- `order`: a number for the position in the navigation. Within one
  directory, pages with `order` come first, smallest first. The position of
  a directory is decided by the `order` of the `README.md` or `index.md`
  inside it.
- `toc`: with `false`, the page shows no table of contents.

### 5.5 Supported syntax and features

- GitHub Flavored Markdown (tables, strikethrough, task lists and so on) is
  supported.
- A blockquote whose first line is `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`,
  `[!WARNING]` or `[!CAUTION]` is shown as a box colored by its kind.
- Footnotes (`[^1]`) are supported.
- Emoji shortcodes such as `:tada:` are converted to emoji characters, using
  the names of gemoji (the shortcodes without an emoji character, such as
  `:shipit:`, are not converted). Conversion applies in body text, emphasis,
  link text, tables, lists, quotes, footnotes and headings. Conversion does
  not apply in code spans, code blocks, inline `<code>`, `<kbd>`, `<pre>`,
  `<script>`, `<tt>`, `<samp>` and `<style>`, block-level HTML, links written
  as a bare URL, image alt text, or after a backslash (`\:tada:`). A shortcode
  inside a word is converted too (`root:x:0` becomes `root❌0`). The id of a
  heading is made from the shortcode as written (`# Demo :tada:` has the id
  `demo-tada`).
- The images in the `srcset` of `<img>` and `<source>` (inside `<picture>`
  too) written as HTML are copied to the site and their paths are rewritten,
  like `src`. Values without quotes and attributes with spaces around the `=`
  are not recognized. `media="(prefers-color-scheme: dark)"` follows the
  setting of the OS, not the light/dark toggle button of the site.
  `#gh-dark-mode-only` is not handled.
- Code blocks with a language name are highlighted at build time. Each code
  block gets a button for copying.
- A code block whose language name is `mermaid` is shown as a diagram. The
  browser loads mermaid from a CDN (jsDelivr) at view time and draws the
  diagram.
- Headings get ids by the same rule as GitHub. Links of the form
  `page.md#heading` work.
- With `NAV_ENABLED=true`, a table of contents is shown on pages that have
  three or more h2 and h3 headings in total.
- HTML written inside Markdown (`<div>`, `<script>` and so on) is output as
  it is, without sanitizing.

### 5.6 The 404 page

When there is a `404.md` at the root of the repository, its content becomes
`404.html`. When there is none, a `404.html` with default content is
generated.

## 6. Multilingual sites (key points)

- Two or more languages in `LANGUAGES` make a multilingual site
  (for example `LANGUAGES=ja,en`).
- A translated page sits in the same place as the original page. Its file
  name has the form `<name>.<lang>.md` (the English version of `docs/cli.md`
  is `docs/cli.en.md`).
- Files without a language in their name are pages in the base language.
- The URLs of base-language pages are the same as in a single-language site.
  Pages in other languages are output under `/<lang>/` (`docs/cli.en.md`
  becomes `/en/docs/cli.html`). The language in the URL is lowercase.
- The top page of another language is the file named after the root file
  with the language added (`README.en.md` for `README.md`).
- Files that are other-language versions of collected pages are collected
  and published automatically, even without a link.
- A link to a file points to the file as written. A link from an English
  page to an English page has the form `cli.en.md`.
- The navigation, the links to the previous and next pages, and the site
  search are built per language.
- The fixed interface text (the menu label, the button labels and so on) is
  available in English and Japanese. Pages in other languages show the
  English text.
- Each page gets a button for switching languages.

## 7. Appearance (key points)

- The CSS of a page is layered in this order: the base CSS, the theme
  (`THEME`), the custom CSS (`STYLE_FILE`). Later layers take priority.
- With `THEME=none`, the theme layer is not used.
- The custom CSS can override CSS variables such as `--fg`, `--bg`,
  `--border`, `--accent`, `--code-bg`, `--font` and `--content-width`.
- `theme` and `styleFile` in the frontmatter change the appearance per page.
- `nineties` has a light display only, and `blueprint` has one display for
  both. The five themes `material`, `glass`, `neumorphism`, `editorial` and
  `minimal` switch between light and dark following the OS setting.

## 8. Publishing

### 8.1 Settings on the GitHub side

The user makes the following two settings on the GitHub screen. Each is made
once, the first time.

1. The user opens Settings > Pages and sets Source under Build and
   deployment to "GitHub Actions". Without this setting, the site is not
   published even when the workflow succeeds.
2. Only when `TRIGGER_BRANCH` is not the default branch of the repository,
   the user opens Settings > Environments > github-pages and adds that
   branch to Deployment branches and tags (Ref type is Branch, and Name
   pattern is the branch name).

The environment named `github-pages` is created automatically when setting 1
is made. For that reason, setting 2 becomes possible after setting 1.

### 8.2 The flow up to publishing

1. The user runs `init` (chapter 3).
2. The user prepares the root Markdown file in the repository.
3. The user makes the settings in 8.1.
4. The user commits the generated files and pushes to the `TRIGGER_BRANCH`
   branch.
5. A run of the workflow named `Deploy Docs to GitHub Pages` appears in the
   Actions tab. When it succeeds, the URL of the site is shown in
   Settings > Pages.

When `TRIGGER_BRANCH` is not the default branch, the workflow, the settings
file and `.github/tsuzuri/` work from the state committed on that branch.

### 8.3 How the workflow behaves

- The workflow starts on a push to any branch and on a manual run
  (`workflow_dispatch`). It does not start on pull requests.
- The build and the deployment happen only when the pushed branch is the
  same as `TRIGGER_BRANCH`.
- When the pushed branch differs from `TRIGGER_BRANCH`, only three things run:
  the checkout, the loading of the settings file, and the branch check.
  Installing dependencies, building, checking links and deploying are not
  performed. In this case the log of the Check trigger branch step shows the
  following line.

  `TRIGGER_BRANCH=main ではない push (feature/foo) のためスキップします` (skipped because the push is not to the trigger branch)

- When the settings file has no `TRIGGER_BRANCH`, or its value is empty, the
  workflow uses the default branch of the repository. In this case the log
  of the same step shows the following line.

  `設定ファイルに TRIGGER_BRANCH が無い(または空の)ため、リポジトリの既定ブランチ main を使います` (the default branch of the repository is used because the settings file has no trigger branch)

- In a manual run, the branch check is not performed, and the content of the
  selected branch is deployed. In this case the log shows the following
  line.

  `手動実行のためブランチ判定をスキップします` (the branch check is skipped because of the manual run)

  The "Run workflow" button in the Actions tab is shown when the workflow
  file is on the default branch.
- Before the build, the workflow installs the dependencies exactly as
  `.github/tsuzuri/package-lock.json` says.
- With `LAST_UPDATED=true`, the workflow fetches the full git history before
  the build.
- Runs for the same branch proceed one at a time, in the order of the
  pushes.

### 8.4 Custom domain

With a domain name in `CUSTOM_DOMAIN`, a `CNAME` file is generated in the
output directory, and the site URL sits directly under the domain. The DNS
settings are made separately by the user, following the GitHub Pages
procedure.

### 8.5 Output for search engines

Builds on GitHub Actions output `sitemap.xml`. When the site sits directly
under a domain, `robots.txt` is output as well.

## 9. Checking locally

### 9.1 preview

At the root of a repository where `init` has been run, the user can run the
following command.

```
npx github:akilasatolu/tsuzuri#v1 preview
```

- When `.github/tsuzuri/node_modules/` has no dependencies, `preview`
  installs them exactly as `.github/tsuzuri/package-lock.json` says.
- `preview` builds with the build script and the settings file copied in the
  repository, and serves the output directory at `http://localhost:4000/`.
- When a file is saved, `preview` rebuilds automatically and reloads the open
  pages.
- `--port <number>` sets the port number, `--no-watch` turns off the
  automatic rebuild, and `--open` launches the browser.
- Ctrl+C ends it.

### 9.2 Manual build

Without `preview`, the flow is as follows.

```
npm ci --prefix .github/tsuzuri --ignore-scripts
node .github/tsuzuri/build-docs.mjs
```

- The first line installs the dependencies, and the second line builds.
- A local build reads `.github/docs-pages.config` automatically.
- A key passed as an environment variable takes priority over the settings
  file (for example `THEME=nineties node .github/tsuzuri/build-docs.mjs`).
- Opening the output files directly as files breaks the links. Serving them
  with a simple server makes them open correctly (for example
  `npx serve _site`).

### 9.3 Files that get created

- The output directory (`_site/` by default) is created. A marker file named
  `.tsuzuri-build` is placed in it, and everything in the output directory
  is deleted before the next build.
- `.github/tsuzuri/node_modules/` is created. `.github/tsuzuri/.gitignore`
  keeps it out of git.
- Because `init` does not change the `.gitignore` at the root of the
  repository, the output directory shows up as untracked files in git in a
  repository whose `.gitignore` has no `_site/`.

### 9.4 Differences from the published site

- A local build does not add the path at the start of the URL (`/<repo>`).
- A local build does not output `sitemap.xml`, `robots.txt`, or the
  canonical URL tag.
- In a local build, the site name is empty when `SITE_NAME` is omitted.

## 10. Updating

In a repository where `init` has been run, the user can update Tsuzuri with
the following command.

```
npx github:akilasatolu/tsuzuri#v1 init --update
```

- There are no questions and no overwrite confirmations.
- `.github/workflows/docs-pages.yml`, and the build script, the theme CSS,
  `package.json`, `package-lock.json` and `.gitignore` inside
  `.github/tsuzuri/`, are overwritten with the content of the version that
  ran.
- Inside `.github/tsuzuri/lib/`, `.mjs` files that the version that ran does
  not have are deleted.
- `.github/docs-pages.config` and `.github/tsuzuri/styles/custom.css` are
  not changed.
- When the settings file lacks some keys, `init` prints the names of those
  keys.
- In a repository without `.github/docs-pages.config`, `init` ends with an
  error without writing anything.
- After the update, committing the changed files and pushing them brings
  the change to the site.

The version copied into the repository is written in the comment at the top
of `.github/workflows/docs-pages.yml`, in the form `tsuzuri v1.31.0`. The
version inside the repository stays the same until an update.

## 11. Common pitfalls

- Symptom: the workflow succeeds, but the site is not published.
  Cause: Source in Settings > Pages is not "GitHub Actions".
  The symptom does not occur when: Source is "GitHub Actions".
- Symptom: the deploy job fails with the following error.
  `Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.`
  Cause: `TRIGGER_BRANCH` is not the default branch, and the `github-pages`
  environment does not allow deployments from that branch.
  The symptom does not occur when: the branch is listed under
  Settings > Environments > github-pages > Deployment branches and tags.
- Symptom: the site is not updated after a push.
  Cause: the pushed branch differs from `TRIGGER_BRANCH`. In this case
  neither the build nor the deployment is performed (8.3).
  The symptom does not occur when: the pushed branch is the same as
  `TRIGGER_BRANCH`.
- Symptom: the build ends with the following error.
  `起点となる README.md(または README.en.md)が見つかりません。処理を中止します。` (the root file is not found; the build stops)
  Cause: the file named by `ROOT_MD` is not in the repository.
  The symptom does not occur when: the file named by `ROOT_MD` is committed
  on that branch.
- Symptom: the README is in Japanese, but interface text such as "Menu" is
  in English.
  Cause: `LANGUAGES` is omitted, or its first value is `en`.
  The symptom does not occur when: the first value of `LANGUAGES` is `ja`.
- Symptom: the navigation, the search and the table of contents are not
  shown.
  Cause: `NAV_ENABLED` is omitted, or it is `false`.
  The symptom does not occur when: the setting is `NAV_ENABLED=true`.
- Symptom: a value written in the settings file has no effect.
  Cause: `# comment` is written after the value and is read as part of the
  value.
  The symptom does not occur when: the comment is on a line of its own.
- Symptom: a newly written Markdown file is not in the site.
  Cause: the file is not reachable by links from the root.
  The symptom does not occur when: a page that is in the site has a link to
  the file.
- Symptom: a translation file that was not meant to be public is published.
  Cause: in a multilingual site, other-language versions of collected pages
  are collected automatically, even without a link.
  The symptom does not occur when: the file is not in the repository.
- Symptom: a site with broken links is published.
  Cause: `STRICT_LINKS` is `false`. In this case broken links are only
  warnings.
  The symptom does not occur when: the setting is `STRICT_LINKS=true`. In
  this case the build fails with the following line, and the site keeps its
  previous content.
  `STRICT_LINKS=true のため、リンクの問題 3 件でビルドを失敗させます。` (the build fails because of 3 link problems)
- Symptom: changes made to files inside `.github/tsuzuri/` disappear after
  an update.
  Cause: `init --update` overwrites the build script and the theme CSS.
  The symptom does not occur when: the appearance changes are written in the
  custom CSS of `STYLE_FILE`.
- Symptom: a version with unreleased behavior runs.
  Cause: the command has no `#v1`, and the content of the `main` branch
  runs.
  The symptom does not occur when: the command has `#v1` or a full version
  tag.
- Symptom: `preview` ends with an error that contains the following text.
  `ポート 4000 は使用中です。` (port 4000 is in use)
  Cause: another program is using the same port.
  The symptom does not occur when: a free port number is given with the
  `--port` option.

## 12. Where the details are

The detailed description of each topic is at the following URLs.

- Installation steps: https://akilasatolu.github.io/tsuzuri/docs/getting-started.html
- Concepts: https://akilasatolu.github.io/tsuzuri/docs/concepts.html
- Settings keys: https://akilasatolu.github.io/tsuzuri/docs/configuration.html
- Themes and custom CSS: https://akilasatolu.github.io/tsuzuri/docs/theming.html
- Theme samples: https://akilasatolu.github.io/tsuzuri/docs/gallery.html
- Frontmatter: https://akilasatolu.github.io/tsuzuri/docs/frontmatter.html
- Multilingual sites: https://akilasatolu.github.io/tsuzuri/docs/i18n.html
- Commands: https://akilasatolu.github.io/tsuzuri/docs/cli.html
- Deployment: https://akilasatolu.github.io/tsuzuri/docs/deployment.html
- Examples: https://akilasatolu.github.io/tsuzuri/docs/examples.html
- Frequently asked questions: https://akilasatolu.github.io/tsuzuri/docs/faq.html
- List of releases: https://github.com/akilasatolu/tsuzuri/releases
````
