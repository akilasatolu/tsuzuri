---
title: FAQ
description: Answers to the common problems when you set up or run Tsuzuri
order: 60
---

# FAQ

## Deployment doesn't run

First, check that the name of the branch you pushed matches `TRIGGER_BRANCH` in
`.github/tsuzuri/config`. The workflow starts for a push to any branch, but if the branch name
doesn't match, a value `should_deploy=false` is recorded internally, and the build (including
installing the dependencies and checking for broken links) and the following deploy job
(the step that actually publishes to GitHub Pages) are skipped entirely. Open the workflow run in
the repository's Actions tab, and if the log of the "Check trigger branch" step shows a message
like

```
Skipping because this push (feature/foo) is not to TRIGGER_BRANCH=main
```

this is the cause. Merge
or push to the target branch, or change the value of `TRIGGER_BRANCH` itself (for manual runs
(`workflow_dispatch`) this check isn't done and it always deploys; see
[Publish settings](./guides/publish.md)).

If the deploy job did start but fails with the following error, the cause is different.

```
Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.
```

This happens when you set a branch other than the default branch as `TRIGGER_BRANCH` and the
`github-pages` environment doesn't allow deployments from that branch. Allow it with the steps in
"Using a branch other than the default branch as the trigger branch" in
[Publish settings](./guides/publish.md).

## I get broken link warnings

If a file linked from Markdown doesn't actually exist, the build doesn't fail; it records the link
as "a link that wasn't found" and continues. Which links these are is shown in the Build step of
the workflow log in the Actions tab, as "Files that links point to were not found: N" and "Links ignored
for security reasons: N", along with the file that contains them. To dig deeper, you can temporarily
set `SITEMAP_JSON=true` to output the debugging `sitemap.json` (see [How it works](./reference/how-it-works.md)). If
you don't want to publish with broken links, set `STRICT_LINKS=true` to make the build fail (see
the [configuration reference](./reference/configuration.md#strict_links)).

A link to a file whose extension isn't in the list of copied files (such as `src/foo.js`) is
checked the same way: if the file exists it becomes a link to GitHub, and if it doesn't exist it
is reported as a link whose target wasn't found. See "Which files are copied" in
[How it works](./reference/how-it-works.md).

## Links to GitHub don't open (private repositories)

Links to files that aren't copied to the site (source code, settings files, `LICENSE` and so
on) point to the file on GitHub. Even when the site is published, a visitor who can't view the
repository, as in a private repository, can't open those links. For files you want such visitors
to see, use a format that is copied to the site (for example PDF), or write the contents on the
page itself. If the build can't tell the URL of the repository (a host other than GitHub, for
example), a warning is shown and the link keeps the path within the site, which doesn't open
either.

## How do I make a changelog page?

Link `CHANGELOG.md` from the README or another page, such as `[Changelog](CHANGELOG.md)`. Like
any other Markdown file, it becomes a page of the site, and it appears in the navigation and the
search too.

## My styles aren't applied

If the look isn't what you expect, check the following in order.

1. A typo in `THEME`. A value that isn't the file name of a CSS file (`none`, a path with folders such as `.github/tsuzuri/styles/glass.css`, or a name
   that doesn't end with `.css`) falls back to `default.css` automatically, with a warning (see the
   [configuration reference](./reference/configuration.md)).
2. Whether a file with the name set in `THEME` actually exists in `.github/tsuzuri/styles/`.
   If it doesn't, a warning is shown (`THEME ("…") was not found`), and the site is built with the base
   CSS only. Custom styles other than `default.css` are not included in the package: download
   them from the [gallery](../gallery/README.md).
3. The priority of the two layers (base CSS → custom style). The custom style is loaded after the
   base CSS, so check whether the CSS rules you wrote there override as expected,
   including in terms of specificity (the strength of the selector). A `theme` in a page's
   frontmatter replaces the site-wide custom style for that page. See
   [Change the look](./guides/style.md) for details.

## The preview looks different from the published site

`preview` builds with the build script copied into your repository (`.github/tsuzuri/`) and the
settings in `.github/tsuzuri/config`, so it generally looks the same as the published site. If
it doesn't, check the following.

1. **Changes not pushed yet**: local changes show up in `preview`, but not on the published site
   until you push.
2. **Browser cache**: the published site may be showing an old version. Reload it.
3. **Different site URL**: the published site has a path, like `https://<owner>.github.io/<repo>/`,
   while `preview` opens at `http://localhost:4000/`. Links are adjusted automatically, so this is
   usually fine, but if you wrote a full URL of the published site in Markdown, like
   `https://<owner>.github.io/<repo>/...`, it goes to the published site.

## preview says "Port 4000 is in use"

(With `--lang ja`, the message is in Japanese: `ポート 4000 は使用中です`.)
Another app (or another `preview`) is using the same port. Choose another number, like
`--port 4001` (see the [CLI reference](reference/cli.md#previewing-locally-preview)).

## npx uses an old cached version

If running `npx github:akilasatolu/tsuzuri#v1 init` doesn't reflect the latest changes (behavior
you expected to be fixed hasn't changed), `npx` or git may be reusing an old version from its
cache. The version shown on the first line when it runs (`tsuzuri v1.0.0` and so on) tells you
which version is actually running. If it's old, try running it with a full version (the latest
one in the [releases](https://github.com/akilasatolu/tsuzuri/releases)), like this.

```
npx github:akilasatolu/tsuzuri#v<latest version> init --update
```

If that doesn't help, consider clearing your local `npx` cache and running it again.

## Pages broke after switching to a custom domain

Setting `CUSTOM_DOMAIN` switches the internal `BASE_PATH` (the path prefixed to links within the
site) to empty, and `SITE_ORIGIN` (the base of absolute URLs) to `https://<CUSTOM_DOMAIN>`. Since
these values change when you move to a custom domain, if images or CSS fail to load, or links
contain the path twice, first check whether the build recognizes the right `CUSTOM_DOMAIN` value
(whether it's a valid host name; including a scheme or path makes it invalid, and it falls back
to empty) by looking at `customDomain` and `siteOrigin` in the `sitemap.json` output with
`SITEMAP_JSON=true`. See "Setting up a custom domain" in [Publish settings](./guides/publish.md) for
details.

## I don't want `llms.txt`, or I want to use one I wrote

`llms.txt` is output by default when building on GitHub Actions. To stop it, write
`LLMS_TXT=false` in `.github/tsuzuri/config`. To use your own, put a `llms.txt` right under
the repository: it's copied to the site as it is and none is generated. A symbolic link, or
something that isn't a regular file, isn't used (a warning is shown, and nothing is copied or
generated). See "llms.txt" in [How it works](./reference/how-it-works.md) for details.

## Is HTML written in Markdown output as is?

Yes. HTML written in Markdown (`<div>`, `<script>` and so on) and links starting with
`javascript:` are output to the generated page as they are, without sanitizing. Tsuzuri is a tool
for "publishing the contents of your own repository as your own site", and it assumes the people
writing the Markdown are trusted just like the site owner.

If you accept Markdown through pull requests from others, check before merging that it doesn't
contain unintended `<script>` tags or links.
