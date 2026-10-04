---
title: Deployment
---

# Deployment

## A self-contained workflow

Running `npx github:akilasatolu/tsuzuri#v1 init` generates the following files in your
repository.

```
Your repository
.github/workflows/docs-pages.yml   … all the build and deploy steps (self-contained)
.github/docs-pages.config          … the settings file that customizes the behavior
.github/tsuzuri/build-docs.mjs     … the build script itself (copied)
.github/tsuzuri/lib/*.mjs          … the modules the build script depends on (copied)
.github/tsuzuri/styles/*.css       … the CSS of the built-in themes (copied)
.github/tsuzuri/package.json       … the versions of the build dependencies (marked and others)
.github/tsuzuri/package-lock.json  … the same (with the hashes used to verify the downloaded contents)
.github/tsuzuri/.gitignore         … keeps locally installed dependencies (node_modules/) out of commits
```

In earlier versions, your `docs-pages.yml` was a thin wrapper that just called the reusable
workflow (`build.yml`) of the Tsuzuri repository with `uses:`, and the actual build script was
fetched from the Tsuzuri repository on every run. Now `init` copies (vendors) the build script
itself under `.github/tsuzuri/`, so **the generated workflow doesn't depend on the Tsuzuri
repository at all, and builds and deploys entirely inside your repository**. Nothing fetches the
Tsuzuri repository over the network (no second `checkout` or the like).

- **`docs-pages.yml`**: everything is written in this file itself: reading the settings file,
  comparing with `TRIGGER_BRANCH`, computing `BASE_PATH` and `SITE_ORIGIN`, the actual build
  (running `.github/tsuzuri/build-docs.mjs`) and the deployment to GitHub Pages. You don't edit
  this file directly; you customize the behavior by changing values in
  `.github/docs-pages.config`.
- **Under `.github/tsuzuri/`**: the build script itself. You don't need to edit it. Deleting or
  changing it makes the build fail.

## Changing the trigger branch

To change the branch that deploys, you only need to edit the `TRIGGER_BRANCH` key in
`.github/docs-pages.config`, not the workflow file.

```
TRIGGER_BRANCH=release
```

After editing it like this and pushing to that branch, only pushes to that branch trigger
deployment from then on (pushes to other branches still start the workflow, but it decides
`should_deploy=false`, and the build (including the broken-link check) and the deploy job are
skipped; see "Deployment doesn't run" in the
[FAQ](./faq.md)).

### Using a branch other than the default branch as the trigger branch (extra setup required)

If you set `TRIGGER_BRANCH` to a branch **other than the repository's default branch (usually
`main`)**, editing `TRIGGER_BRANCH` alone isn't enough. The `github-pages` environment, where
GitHub Pages publishes, only allows deployments from the default branch by default. If you push
as is, the deploy job fails with an error like this.

```
Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.
```

Allow deployments from the trigger branch with the following steps (first time only).

1. Open the repository's `Settings` tab
2. Choose `Environments` in the left menu and open `github-pages`
3. In the `Deployment branches and tags` list, press `Add deployment branch or tag rule`
4. Leave `Ref type` as `Branch`, enter the trigger branch name (e.g. `docs`) in `Name pattern`
   and add it

The `github-pages` environment is created automatically when you set `Source` to
`GitHub Actions` under `Settings > Pages`. If it isn't in the list, finish the Pages setup
first.

Also note the following.

- **Put the workflow file on the trigger branch too**: GitHub Actions runs the workflow files on
  the branch that was pushed. Commit `.github/workflows/docs-pages.yml`,
  `.github/docs-pages.config` and `.github/tsuzuri/` to the trigger branch.
- **The manual run button isn't shown**: the "Run workflow" button in the Actions tab only
  appears when the workflow file is on the default branch. If it's only on the trigger branch,
  deploy by pushing to that branch.

## Setting up a custom domain

To publish the site on your own domain, set the domain name (without a scheme, e.g.
`docs.example.com`) in `CUSTOM_DOMAIN` of `.github/docs-pages.config`.

```
CUSTOM_DOMAIN=docs.example.com
```

With this set, a `CNAME` file is generated automatically right under the output folder at build
time. The internal `SITE_ORIGIN` (the base URL of the site, used for OGP absolute URLs and the
like) is computed differently too: `BASE_PATH` is empty (the site is placed right under the
domain) and `SITE_ORIGIN` is `https://<CUSTOM_DOMAIN>`. You still need to set up DNS (register a
CNAME record and so on) after setting the custom domain; follow GitHub Pages' standard steps for
that.

## Manual runs (workflow_dispatch)

You can also run the `Deploy Docs to GitHub Pages` workflow manually from the repository's
Actions tab, with the "Run workflow" button (the `workflow_dispatch` trigger). For manual runs,
the check of whether the current branch matches `TRIGGER_BRANCH` is skipped entirely, and it
always deploys. Use it to redeploy the trigger branch's contents without changing any settings.

It runs on the branch you choose in "Run workflow". If you choose a branch other than the
trigger branch, the deployment fails if the branch isn't allowed in the `github-pages`
environment, and if it is allowed, the published site is overwritten with that branch's
contents, so be careful.

## Pinning and updating the version

The build script is copied under `.github/tsuzuri/` when you run `init`, so **once generated,
the version never changes automatically unless you do something** (unlike the old
`uses: ...@v1`, it's no longer updated to the latest on every workflow run).

To update to the latest Tsuzuri, run the setup command with `--update`. Only the workflow and
the build script are overwritten with the latest version; `.github/docs-pages.config` and your
custom CSS (`STYLE_FILE`) are left as they are (see "Updating to the latest version
(`--update`)" in the [CLI reference](./cli.md)).

```sh
npx github:akilasatolu/tsuzuri#v1 init --update
```

The build dependencies (marked and others) are also pinned to the versions and hashes written in
`.github/tsuzuri/package-lock.json` (v1.7.0 or later). They don't change until you run
`--update`.

To pin a specific version, specify a tag. `#v1` is the latest v1 release (updated without
breaking compatibility); a full version such as `#v1.2.0` pins that release.

```sh
npx github:akilasatolu/tsuzuri#v1.2.0 init --update
```
