---
title: Get started
description: Publish your README as a GitHub Pages site in three steps: run init, turn on Pages, and push
order: 10
---

# Get started

You can publish your README as a site in three steps: run `init`, set GitHub Pages to GitHub Actions (once), and push. [This site](../README.md) was published exactly this way.

## Prerequisites

- Your project must be a GitHub repository (Tsuzuri uses GitHub Pages).
- You generally don't need Node.js, git or similar tools permanently installed. Running the
  setup command (`npx ...`) needs Node.js 20 or later (npx), but it only runs temporarily and
  installs nothing permanently into your project.
- The build and deployment run on GitHub Actions, so you can deploy without Node.js on your
  machine (Node.js is only needed when you run the setup command).

## Installation

Run the following command at the root of your repository.

```
npx github:akilasatolu/tsuzuri#v1 init
```

It asks two questions: the trigger branch and the starting Markdown file. You can accept every
default just by pressing Enter (the repository's default branch and `README.md`). The navigation,
the site language and the site name are not asked about: `init` writes `NAV_ENABLED=true`, `LANGUAGES=en`
and an empty `SITE_NAME` (the repository name is used), and the settings file starts with
`THEME=default.css`, the default custom style included in the package. If your README is written in
another language, change `LANGUAGES` in `.github/tsuzuri/config` afterwards (for example `LANGUAGES=ja`).
See the [CLI reference](./reference/cli.md) for the full question flow.

Besides the workflow and the settings file, this command adds the whole build script to your
repository.

- `.github/workflows/tsuzuri-pages.yml`
- `.github/tsuzuri/` (the settings file `config`, which you edit, and the build script itself: `build-docs.mjs`, `lib/*.mjs`, `styles/base.css` and `styles/default.css`,
  plus `package.json` and `package-lock.json`, which pin the build dependencies, and `.gitignore`)

Under `.github/tsuzuri/`, you edit only the settings file `config` and your own custom styles in
`styles/`. Do not edit `base.css`, `default.css` or the scripts. To use another look, download a
custom style from the [gallery](../gallery/README.md), put it in `styles/`, and set `THEME` (see [Change the look](./guides/style.md)).

Because the build script is copied into your repository too, the generated workflow builds
and deploys entirely inside your repository, without fetching the Tsuzuri repository each
time. See [Publish settings](./guides/publish.md) for details.

## Setting up GitHub Pages

Before or after committing the generated files, you need to switch the GitHub Pages source in
your repository settings (first time only).

1. Open the repository's `Settings` tab
2. Choose `Pages` in the left menu
3. Under `Build and deployment`, change `Source` to `GitHub Actions`

Without this setting, the workflow itself runs fine but nothing is actually published to
Pages.

If you set `TRIGGER_BRANCH` to a branch other than the default branch (usually `main`), you
also need to allow deployments from that branch under `Settings > Environments > github-pages`.
See "Using a branch other than the default branch as the trigger branch" in
[Publish settings](./guides/publish.md).

## First deployment

Commit all the generated files and push to the `TRIGGER_BRANCH` in `.github/tsuzuri/config`
(the repository's default branch, usually `main`, if left out). Once the push completes, the GitHub Actions workflow starts
automatically.

Open the repository's `Actions` tab and you'll see a run named `Tsuzuri: Deploy to GitHub Pages`.
A green check mark means it succeeded. You can open the generated site from the URL shown on
the `Settings > Pages` page (it can take a few minutes to appear).

Before you push, you can check the site on your own computer: see [Preview locally](./preview.md).

## Next steps

- Choose a look in the [gallery](../gallery/README.md), then set `THEME` (see [Change the look](./guides/style.md)).
- Add more pages by linking them from your README (see [Write pages](./guides/write-pages.md)).
- Let an AI agent do it for you: paste [Reference for AI agents](./ai-reference.md).
