---
title: CLI reference
description: The options of init and preview, the questions init asks, and the files it generates
order: 30
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
| `--update` | Update to the latest version without questions ([see below](../guides/update.md#updating-to-the-latest-version---update)) |
| `-y`, `--yes` | Generate the files with all defaults, without questions |
| `--branch <name>` | The trigger branch (`TRIGGER_BRANCH`). Default: the repository's default branch (the default branch of `origin`, or `main` if unknown; up to v1.3.0 it could be the current branch) |
| `--root <path>` | The starting Markdown file (`ROOT_MD`). Default: `README.md` |
| `--lang <en\|ja>` | The language of the messages, and of the comments in the generated settings file (v1.37.0 or later). Default: `en`. It does not skip the questions |
| `--force` | Without questions, overwrite existing files too |
| `--port <number>` | The port used by `preview`. Default: `4000` |
| `--no-watch` | In `preview`, don't watch files for changes (don't rebuild automatically) |
| `--open` | In `preview`, open the site in the browser on startup |
| `-v`, `--version` | Show the version |
| `-h`, `--help` | Show the usage |

With any of `--yes`, `--branch` or `--root`, the files are generated without questions (useful from scripts or CI). In that
case, existing files are skipped rather than overwritten. Add `--force` to overwrite them. This includes the settings file `.github/tsuzuri/config` (your settings are replaced by the generated ones). The custom styles you put in `.github/tsuzuri/styles/` yourself are never overwritten, since `init` doesn't create them.

```
npx github:akilasatolu/tsuzuri#v1 init --yes --branch docs
```

An unknown option (including `--theme`, which was removed together with the theme question) is an error, and nothing is generated.

The messages of `init` and `preview` are in English (v1.37.0 or later; up to v1.36.0 they were in
Japanese). Add `--lang ja` to the command to get Japanese messages, and Japanese comments in the
settings file that `init` creates, like `npx github:akilasatolu/tsuzuri#v1 init --lang ja`.
Only `en` and `ja` (in lowercase) are accepted. `--lang` applies only to the command it is given
to, and it is not the language of the site (that is `LANGUAGES`; see the
[configuration reference](./configuration.md#languages)). The workflow and the `.gitignore` that
`init` generates are always in English.

## Previewing locally (`preview`)

Before pushing, you can build the site locally with the same settings as when it's published
and check it in the browser (v1.5.0 or later). Run it at the root of a repository where you've
already run `init`.

```
npx github:akilasatolu/tsuzuri#v1 preview
```

1. If the build dependencies aren't in `.github/tsuzuri/node_modules/`, it installs them
   exactly as listed in `.github/tsuzuri/package-lock.json`, the same as the workflow (the
   `.github/tsuzuri/.gitignore` created by `init` keeps them out of commits). In a repository
   without `.github/tsuzuri/package-lock.json` (one set up with an old version), it doesn't go
   on to the build even if the dependencies are installed; it tells you to run `init --update`
   and exits.
2. It builds with the build script in `.github/tsuzuri/`, using the settings in
   `.github/tsuzuri/config` (warnings such as broken links are shown here too).
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

Those are the only two questions. There is no question about the navigation, the languages, the site name or the look.
`init` writes `NAV_ENABLED=true`, `LANGUAGES=en` and `SITE_NAME=` (empty; the repository name is used at build time) to the
settings file, and it starts with `THEME=default.css` (the default custom style, included in the package). To change them, edit
`.github/tsuzuri/config` after `init`: write `LANGUAGES=ja` if your README is in Japanese (see [Multilingual sites](../guides/multilingual.md)),
set `SITE_NAME`, or write `NAV_ENABLED=false`. To use another custom style, download it from the
[gallery](../../gallery/README.md) and put its file name in `THEME` (see [Change the look](../guides/style.md)).

## Generated files

Based on your answers, the following files are generated.

| File | Always generated? | Contents |
|---|---|---|
| `.github/workflows/tsuzuri-pages.yml` | Always | A self-contained workflow that holds the build and deploy steps itself (it no longer calls `build.yml` with `uses:` as it used to) |
| `.github/tsuzuri/config` | Always | The settings file. `TRIGGER_BRANCH` / `ROOT_MD` reflect your answers; the other keys, including `THEME=default.css`, are written with their defaults. You edit this file |
| `.github/tsuzuri/build-docs.mjs` | Always | The build script itself (identical to `.github/scripts/build-docs.mjs` in the Tsuzuri repository) |
| `.github/tsuzuri/lib/*.mjs` | Always | The modules the build script depends on (config, copy-button, crawler, emoji, emoji-data, frontmatter, html-renderer, i18n, image-size, link-extractor, llms-txt, path-utils, search, site-tree, sitemap, slugger, theme-toggle; 17 files) |
| `.github/tsuzuri/styles/base.css`, `default.css` | Always | The base CSS (`base.css`) and the default custom style (`default.css`). Only these two are placed; the other custom styles are not distributed, and you download them from the [gallery](../../gallery/README.md) |
| `.github/tsuzuri/package.json`, `package-lock.json` | Always (v1.7.0 or later) | The versions of the build dependencies (marked and others) and the hashes used to verify the downloaded contents. The workflow and `preview` install them exactly as listed, with `npm ci` |
| `.github/tsuzuri/.gitignore` | Always | Keeps the dependencies installed for local previews (`node_modules/`) out of commits |

Under `.github/tsuzuri/`, you edit only the settings file `config` and your own custom styles in
`styles/`. Do not edit `base.css`, `default.css` or the scripts; deleting
or changing them can make the build fail, because they *are* the build script that
`build-docs.mjs` loads when it runs. To update the script to the latest version, see "Updating
to the latest version (`--update`)" below.

In the generated settings file, the site language is always written like this (`init` does not
ask about it; for a Japanese README, change it to `LANGUAGES=ja` afterwards).

```
# Site languages, comma-separated; the first is the base language (the language of the starting README). Examples: ja / en / ja,en
# With one language you get a single-language site (<html lang="..."> and the interface text use that language).
# With two or more you get a multilingual site (how to place pages: https://akilasatolu.github.io/tsuzuri/docs/guides/multilingual.html). If empty, it is en.
LANGUAGES=en
```

(The comments in the generated settings file are in English. With `--lang ja` they are in Japanese. Up to
v1.36.0 they were always in Japanese.)

For the list and meaning of the generated keys, see the
[configuration reference](./configuration.md).

## Adding Tsuzuri to an existing project

So that it's safe to run in a repository where these files already exist, it asks whether to
overwrite any existing file it finds.

- **The workflow and the build script** (`tsuzuri-pages.yml` and everything under
  `.github/tsuzuri/` except `config`) only work when they're the same version,
  so it asks once for all of them at the start.

  ```
  The workflow and the build scripts (under .github/tsuzuri/, except config) already exist. Overwrite them with the latest version? (y/N):
  ```

  (Up to v1.36.0, and with `--lang ja`, the question is in Japanese:
  `ワークフローとビルドスクリプト一式(.github/tsuzuri/ 配下。config を除く)は既に存在します。最新版で上書きしますか? (y/N):`)

- **The settings file** (`.github/tsuzuri/config`) is asked about separately.

  ```
  .github/tsuzuri/config already exists. Overwrite it? (y/N):
  ```

  (Up to v1.36.0, and with `--lang ja`: `.github/tsuzuri/config は既に存在します。上書きしますか? (y/N):`)

Files you answer "n" for (or leave empty) are skipped and keep their contents. To update only
the workflow and the script to the latest version, use `--update` below, which does it without
asking.

## Updating and pinning the version

For updating to the latest version (`--update`) and pinning a version (`#v1`, `#v1.2.0`), see [Update](../guides/update.md).
