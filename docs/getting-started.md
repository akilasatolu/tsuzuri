---
title: Getting Started
order: 1
---

# Getting Started

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

It asks five questions: the trigger branch, the starting Markdown file, whether
to show the navigation, the site language, and the site name. You can accept every default just
by pressing Enter (the repository's default branch, `README.md`, navigation shown,
English (`en`), and the repository name). The look is not asked about: the settings file starts
with `THEME=default.css`, the default custom style included in the package. If your README is written in another language, answer the site
language question with that language (for example `ja`). See the [CLI reference](./cli.md)
for the full question flow.

Besides the workflow and the settings file, this command adds the whole build script to your
repository.

- `.github/workflows/tsuzuri-pages.yml`
- `.github/tsuzuri/` (the settings file `config`, which you edit, and the build script itself: `build-docs.mjs`, `lib/*.mjs`, `styles/base.css` and `styles/default.css`,
  plus `package.json` and `package-lock.json`, which pin the build dependencies, and `.gitignore`)

Under `.github/tsuzuri/`, you edit only the settings file `config` and your own custom styles in
`styles/`. Do not edit `base.css`, `default.css` or the scripts. To use another look, download a
custom style from the [gallery](./gallery.md), put it in `styles/`, and set `THEME` (see [Theming](./theming.md)).

Because the build script is copied into your repository too, the generated workflow builds
and deploys entirely inside your repository, without fetching the Tsuzuri repository each
time. See [Deployment](./deployment.md) for details.

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
[Deployment](./deployment.md).

## First deployment

Commit all the generated files and push to the `TRIGGER_BRANCH` in `.github/tsuzuri/config`
(the repository's default branch, usually `main`, if left out). Once the push completes, the GitHub Actions workflow starts
automatically.

Open the repository's `Actions` tab and you'll see a run named `Tsuzuri: Deploy to GitHub Pages`.
A green check mark means it succeeded. You can open the generated site from the URL shown on
the `Settings > Pages` page (it can take a few minutes to appear).

## Checking locally before you push (optional)

Instead of pushing and waiting for GitHub Actions, you can run the same build locally to check
the look and broken links (Node.js 20 or later is required). The easiest way is to run this at
the root of your repository (v1.5.0 or later).

```sh
npx github:akilasatolu/tsuzuri#v1 preview
```

When the build finishes, open the site at `http://localhost:4000/` (see the
[CLI reference](cli.md#previewing-locally-preview) for details).

To do the same thing by hand without `preview`, run the following steps in order.

1. Install the build dependencies into `.github/tsuzuri/`. They are installed exactly as listed
   in `.github/tsuzuri/package-lock.json`, so you get the same versions as the workflow
   (v1.7.0 or later).

   ```sh
   npm ci --prefix .github/tsuzuri --ignore-scripts
   ```

   In a repository without `.github/tsuzuri/package-lock.json` (one set up with an old
   version), first update with `npx github:akilasatolu/tsuzuri#v1 init --update`.

   The install location, `.github/tsuzuri/node_modules/`, is excluded from commits by the
   `.github/tsuzuri/.gitignore` that `init` generates.

2. Build. The settings in `.github/tsuzuri/config` are used as is, so you see the same look
   as the published site.

   ```sh
   node .github/tsuzuri/build-docs.mjs
   ```

   To try a different setting, pass it as an environment variable, like
   `THEME=glass.css node .github/tsuzuri/build-docs.mjs`. Only that key overrides the settings
   file.

   > [!NOTE]
   > The settings file is read automatically from v1.4.0. With older versions, pass the values
   > from the settings file as environment variables (for example
   > `STYLE_DIR=.github/tsuzuri/styles NAV_ENABLED=true node .github/tsuzuri/build-docs.mjs`).
   > You can see which version is copied into your repository in the comment at the top of
   > `.github/workflows/tsuzuri-pages.yml` (`# tsuzuri v1.37.0 generated this …`; up to v1.36.0,
   > `# tsuzuri v1.4.0 の …`). If it's old, update it with
   > `init --update` (see the [CLI reference](cli.md)).

3. Serve the resulting `_site/` with a simple server (opening the files directly breaks the
   links).

   ```sh
   npx serve _site
   ```

   Check it at `http://localhost:3000/` or similar. You can delete `_site/` when you're done.
   From v1.5.0, the previous output is removed automatically before each build (with older
   versions, delete `_site/` and rebuild after deleting or renaming pages). To avoid
   committing `_site/` by mistake, add this line to your repository's `.gitignore`.

   ```
   _site/
   ```

## Next steps

- To learn how the site is put together, see [Concepts](./concepts.md)
- For the list of settings, see the [configuration reference](./configuration.md)
- To change the look (colors and decoration), see [Theming](./theming.md)
- To get help from an AI agent with the setup, see [Reference for AI agents](./ai-reference.md)
