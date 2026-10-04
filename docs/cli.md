---
title: CLI reference
---

# CLI reference

This page explains how to use the setup command ([`bin/cli.mjs`](https://github.com/akilasatolu/tsuzuri/blob/main/bin/cli.mjs)).
With one command and a few questions, it copies into your repository the workflow and
settings file needed to deploy to GitHub Pages automatically, plus the whole build script
(under `.github/tsuzuri/`). After that, builds and deployments run entirely inside your
repository, without fetching the Tsuzuri repository (`akilasatolu/tsuzuri`) each time.

## Running it

Run the following command at the root of your repository (no `npm install` needed
beforehand).

```
npx github:akilasatolu/tsuzuri#v1 init
```

`npx` comes with Node.js and lets you fetch and run a package temporarily without installing
it (Node.js 20 or later is required). There are two subcommands: `init` for setup (can be
omitted) and [`preview`](#previewing-locally-preview) to check the site locally.

When it runs, it first prints the version actually running, like `tsuzuri v1.0.0`. Check that
it's the version you intended (`npx` can run an old version from its cache).

## Options

| Option | Description |
|---|---|
| (none) | Generate the files by answering questions (see "Question flow" below) |
| `--update` | Update to the latest version without questions ([see below](#updating-to-the-latest-version---update)) |
| `-y`, `--yes` | Generate the files with all defaults, without questions |
| `--branch <name>` | The trigger branch (`TRIGGER_BRANCH`). Default: the repository's default branch (the default branch of `origin`, or `main` if unknown; up to v1.3.0 it could be the current branch) |
| `--root <path>` | The starting Markdown file (`ROOT_MD`). Default: `README.md` |
| `--theme <name>` | The theme (`THEME`). `material` / `glass` / `neumorphism` / `editorial` / `minimal` / `blueprint` / `nineties` / `none`. Default: `material` |
| `--languages <list>` | The site languages (`LANGUAGES`), comma-separated, with the base language first (e.g. `en`, `en,ja`). Default: `en` (v1.28.0 or later) |
| `--site-name <name>` | The site name (`SITE_NAME`). Default: empty (the repository name is used at build time) |
| `--no-nav` | Don't show the navigation, site search and table of contents (`NAV_ENABLED=false`). Default: shown |
| `--style` | Also create an empty custom CSS template (`.github/tsuzuri/styles/custom.css`) |
| `--force` | Without questions, overwrite existing files too |
| `--port <number>` | The port used by `preview`. Default: `4000` |
| `--no-watch` | In `preview`, don't watch files for changes (don't rebuild automatically) |
| `--open` | In `preview`, open the site in the browser on startup |
| `-v`, `--version` | Show the version |
| `-h`, `--help` | Show the usage |

With any of `--yes`, `--branch`, `--root`, `--theme`, `--languages`, `--site-name`, `--no-nav`
or `--style`, the files are generated without questions (useful from scripts or CI). In that
case, existing files are skipped rather than overwritten. Add `--force` to overwrite them.

```
npx github:akilasatolu/tsuzuri#v1 init --yes --branch docs --theme nineties --languages ja
```

An unknown option is an error, and nothing is generated. A value for `--languages` that isn't
a valid language tag, such as `ja_JP`, is also an error, and nothing is generated.

## Previewing locally (`preview`)

Before pushing, you can build the site locally with the same settings as when it's published
and check it in the browser (v1.5.0 or later). Run it at the root of a repository where you've
already run `init`.

```
npx github:akilasatolu/tsuzuri#v1 preview
```

1. If the build dependencies aren't in `.github/tsuzuri/node_modules/`, it installs them
   exactly as listed in `.github/tsuzuri/package-lock.json`, the same as the workflow (the
   `.github/tsuzuri/.gitignore` created by `init` keeps them out of commits).
2. It builds with the build script in `.github/tsuzuri/`, using the settings in
   `.github/docs-pages.config` (warnings such as broken links are shown here too).
3. It serves the output folder (`OUT_DIR`, `_site/` by default) at `http://localhost:4000/`.
4. When you save a file, it rebuilds automatically and reloads the open page (v1.6.0 or later;
   with v1.5.0, stop it with `Ctrl+C` and run it again).

With `--open`, the site opens in the browser on startup. If the port is in use, choose another
one, like `--port 4001`. If you don't want automatic rebuilds, add `--no-watch`. Press
`Ctrl+C` to quit.

The build uses the build script already copied into your repository (so the result matches
the published site). If the copied version differs from the version run by `npx`, it tells you
so. Run `init --update` to update.

## Where to run it

`init` generates the workflow in `.github/workflows/`. GitHub only runs workflows in
`.github/workflows/` at the root of the repository, so running it anywhere other than the
repository root (a subfolder, for example) or outside a git repository shows a warning. In
interactive mode it asks whether to continue. If the starting Markdown file (`ROOT_MD`) doesn't
exist yet, it also shows a warning asking you to create it.

## Question flow

When it runs, answer the following questions in order (you can pick every default just by
pressing Enter).

1. **Trigger branch (`TRIGGER_BRANCH`)** `[main]`
   - The branch that triggers deployment. Press Enter with the field empty to use the default
     in brackets. The default is the repository's default branch (`HEAD` of `origin`), or the
     current branch if that's unknown, or `main` if that's unknown too.
2. **Starting Markdown file (`ROOT_MD`)** `[README.md]`
   - The path of the Markdown file that is the entrance to the site. If left empty, it's
     `README.md`.
3. **Theme (`THEME`)**
   - The eight choices `material` (recommended) / `glass` / `neumorphism` / `editorial` /
     `minimal` / `blueprint` / `nineties` / `none` (no decoration) are shown with numbers
     (1–8); type a number. If left empty, it's `1` (`material`).
   - See [Theming](./theming.md) for what each theme looks like.
4. **Show the navigation? (`NAV_ENABLED`) (Y/n)** (v1.7.0 or later)
   - Whether to show the sidebar, site search, the in-page table of contents and the links to
     the previous and next pages. If left empty (or `y`), they're shown.
5. **Site languages (`LANGUAGES`)** `[en]` (v1.28.0 or later)
   - Enter the site languages, comma-separated. Put the language of your README (the base
     language) first. If your README is in Japanese, enter `ja`; for an English and Japanese
     site with an English README, enter `en,ja`. The value is written to the settings file in
     the order you typed it. If left empty, it's `en` (English).
   - A value that isn't a valid language tag (e.g. `ja_JP`) is ignored with a warning (if no
     valid value remains, it's `en`).
   - See [Multilingual sites](./i18n.md) for how to build a multilingual site.
6. **Site name (`SITE_NAME`)** (v1.7.0 or later)
   - The site name used in the navigation header and when the page is shared on social media.
     If left empty, the repository name is used at build time. The site name is shared by all
     languages.
7. **Create a custom CSS template? (y/N)**
   - Whether to create `.github/tsuzuri/styles/custom.css`, an empty CSS file containing only
     comments. It sits in the same folder as the built-in theme CSS, so you can write it while
     looking at the existing themes. If left empty (or `n`), it isn't created.

## Generated files

Based on your answers, the following files are generated.

| File | Always generated? | Contents |
|---|---|---|
| `.github/workflows/docs-pages.yml` | Always | A self-contained workflow that holds the build and deploy steps itself (it no longer calls `build.yml` with `uses:` as it used to) |
| `.github/docs-pages.config` | Always | The settings file. `TRIGGER_BRANCH` / `ROOT_MD` / `THEME` / `NAV_ENABLED` / `LANGUAGES` / `SITE_NAME` reflect your answers; the other keys are written with their defaults |
| `.github/tsuzuri/build-docs.mjs` | Always | The build script itself (identical to `.github/scripts/build-docs.mjs` in the Tsuzuri repository) |
| `.github/tsuzuri/lib/*.mjs` | Always | The modules the build script depends on (config, crawler, frontmatter, html-renderer, i18n, link-extractor, path-utils, site-tree, slugger, search, sitemap and so on) |
| `.github/tsuzuri/styles/*.css` | Always | The CSS of the built-in themes (`base.css` plus `material` / `glass` / `neumorphism` / `editorial` / `minimal` / `blueprint` / `nineties`). All themes are always copied, in case a page uses a theme other than the selected one through the frontmatter `theme` key ([see here](./frontmatter.md#theme)) |
| `.github/tsuzuri/package.json`, `package-lock.json` | Always (v1.7.0 or later) | The versions of the build dependencies (marked and others) and the hashes used to verify the downloaded contents. The workflow and `preview` install them exactly as listed, with `npm ci` |
| `.github/tsuzuri/.gitignore` | Always | Keeps the dependencies installed for local previews (`node_modules/`) out of commits |
| `.github/tsuzuri/styles/custom.css` | Only if you answered "y" to the last question | An empty custom CSS template containing only comments, placed in the same folder as the built-in theme CSS |

The files under `.github/tsuzuri/` *are* the build script that `build-docs.mjs` loads when it
runs. You don't need to edit them, but deleting or changing them makes the build fail. To
update the script to the latest version, see "Updating to the latest version (`--update`)"
below.

In the generated settings file, the site language is written like this (when you answered
`en`).

```
# サイトの言語。カンマ区切りで、先頭が基本言語(起点の README の言語)です。例: ja / en / ja,en
# 1つなら1言語のサイト(ページの言語 <html lang="..."> と画面の文言がその言語になります)。
# 2つ以上なら多言語のサイトになります(ページの置き方: https://akilasatolu.github.io/tsuzuri/docs/i18n.html)。空なら en です。
LANGUAGES=en
```

For the list and meaning of the generated keys, see the
[configuration reference](./configuration.md).

## Adding Tsuzuri to an existing project

So that it's safe to run in a repository where these files already exist, it asks whether to
overwrite any existing file it finds.

- **The workflow and the build script** (`docs-pages.yml` and everything under
  `.github/tsuzuri/`) only work when they're the same version, so it asks once for all of them
  at the start.

  ```
  ワークフローとビルドスクリプト一式(.github/tsuzuri/ 配下)は既に存在します。最新版で上書きしますか? (y/N):
  ```

  (The workflow and the build script (under `.github/tsuzuri/`) already exist. Overwrite them
  with the latest version?)

- **The settings file and custom CSS** (`.github/docs-pages.config` and `custom.css`) are asked
  about one file at a time.

  ```
  .github/docs-pages.config は既に存在します。上書きしますか? (y/N):
  ```

  (`.github/docs-pages.config` already exists. Overwrite it?)

Files you answer "n" for (or leave empty) are skipped and keep their contents. To update only
the workflow and the script to the latest version, use `--update` below, which does it without
asking.

## Updating to the latest version (`--update`)

To update Tsuzuri in a repository where you've already run `init`, run it with `--update`.

```
npx github:akilasatolu/tsuzuri#v1 init --update
```

It asks nothing and works as follows.

| File | With `--update` |
|---|---|
| `.github/workflows/docs-pages.yml` | Overwritten with the latest version |
| Build script and built-in theme CSS under `.github/tsuzuri/` | Overwritten with the latest version (new files are added; scripts under `lib/` no longer used by the latest version are deleted) |
| `.github/docs-pages.config` | **Not changed** (a `LANG` in a settings file created up to v1.27.0 is not rewritten to `LANGUAGES` either) |
| Custom CSS (`.github/tsuzuri/styles/custom.css`) | **Not changed** |

If you run `--update` with a settings file created up to v1.27.0 (one with `LANG` but no
`LANGUAGES`), it points out `LANGUAGES` as "a key missing from the settings file". Without a
language the site becomes English, so for a Japanese site add `LANGUAGES=ja` and delete the
`LANG` line (see the [configuration reference](./configuration.md#languages)).

After it runs, check the changes with `git diff` before committing and pushing. Running it in a
repository without `.github/docs-pages.config` (where you haven't run `init` yet) writes
nothing and exits with an error. Run it without `--update` the first time.

## Pinning the ref

If you leave out the `ref` (a version, branch or tag), as in `npx github:akilasatolu/tsuzuri init`,
the latest state of the default branch (`main`) runs, which may include unreleased changes.
Normally, run it with `#v1`. Depending on your local cache or `npx` itself, an old version may
run, so to pin a released version, specify a tag such as `#v1` explicitly, like this.

```
npx github:akilasatolu/tsuzuri#v1 init
```

`v1` is a tag that is kept up to date without breaking compatibility (a `v2` is created only
for breaking changes). If "the behavior changes every time I run it" or "the latest changes
don't show up", try `#v1` first.
