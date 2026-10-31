---
title: Preview locally
description: Check the look and the broken links on your own computer before you push
order: 20
---

# Preview locally

You can check the look and the broken links on your own computer with one command, before you push.

Instead of pushing and waiting for GitHub Actions, you can run the same build locally to check
the look and broken links (Node.js 20 or later is required). The easiest way is to run this at
the root of your repository (v1.5.0 or later).

```sh
npx github:akilasatolu/tsuzuri#v1 preview
```

When the build finishes, open the site at `http://localhost:4000/` (see the
[CLI reference](reference/cli.md#previewing-locally-preview) for details).

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
   > `init --update` (see the [CLI reference](reference/cli.md)).

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

## Read next

- [Publish settings](./guides/publish.md): choose the branch that publishes the site.
- [Change the look](./guides/style.md): pick a style in the gallery.
