---
title: Preview locally
description: Check the look and the broken links on your own computer before you push
order: 20
---

# Preview locally

You can check the look and the broken links on your own computer with one command, before you push.

Instead of pushing and waiting for GitHub Actions, you can run the same build locally to check
the look and broken links (Node.js 20 or later is required). The easiest way is to run this at
the root of your repository.

```sh
npx github:akilasatolu/tsuzuri#v1 preview
```

When the build finishes, open the site at `http://localhost:4000/` (see the
[CLI reference](reference/cli.md#previewing-locally-preview) for details).

To do the same thing by hand without `preview`, run the following steps in order.

1. Install the build dependencies into `.github/tsuzuri/`. They are installed exactly as listed
   in `.github/tsuzuri/package-lock.json`, so you get the same versions as the workflow.

   ```sh
   npm ci --prefix .github/tsuzuri --ignore-scripts
   ```

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

3. Serve the resulting `_site/` with a simple server (opening the files directly breaks the
   links).

   ```sh
   npx serve _site
   ```

   Check it at `http://localhost:3000/` or similar. You can delete `_site/` when you're done.
   The previous output is removed automatically before each build. To avoid
   committing `_site/` by mistake, add this line to your repository's `.gitignore`.

   ```
   _site/
   ```

## Read next

- [Publish settings](./guides/publish.md): choose the branch that publishes the site.
- [Change the look](./guides/style.md): pick a style in the gallery.
