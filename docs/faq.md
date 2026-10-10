---
title: FAQ
---

# FAQ

## Deployment doesn't run

First, check that the name of the branch you pushed matches `TRIGGER_BRANCH` in
`.github/docs-pages.config`. The workflow starts for a push to any branch, but if the branch name
doesn't match, a value `should_deploy=false` is recorded internally, and the build (including
installing the dependencies and checking for broken links) and the following deploy job
(the step that actually publishes to GitHub Pages) are skipped entirely. Open the workflow run in
the repository's Actions tab, and if the log of the "Check trigger branch" step shows a message
like

```
TRIGGER_BRANCH=main ではない push (feature/foo) のためスキップします
```

(skipping because the push (feature/foo) isn't to TRIGGER_BRANCH=main), this is the cause. Merge
or push to the target branch, or change the value of `TRIGGER_BRANCH` itself (for manual runs
(`workflow_dispatch`) this check isn't done and it always deploys; see
[Deployment](./deployment.md)).

If the deploy job did start but fails with the following error, the cause is different.

```
Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.
```

This happens when you set a branch other than the default branch as `TRIGGER_BRANCH` and the
`github-pages` environment doesn't allow deployments from that branch. Allow it with the steps in
"Using a branch other than the default branch as the trigger branch" in
[Deployment](./deployment.md).

## I get broken link warnings

If a file linked from Markdown doesn't actually exist, the build doesn't fail; it records the link
as "a link that wasn't found" and continues. Which links these are is shown in the Build step of
the workflow log in the Actions tab, as "files whose link target wasn't found" and "links ignored
for security reasons", along with the file that contains them. To dig deeper, you can temporarily
set `SITEMAP_JSON=true` to output the debugging `sitemap.json` (see [Concepts](./concepts.md)). If
you don't want to publish with broken links, set `STRICT_LINKS=true` to make the build fail (see
the [configuration reference](./configuration.md#strict_links)).

A link to a file whose extension isn't in the list of copied files (such as `src/foo.js`) is
checked the same way: if the file exists it becomes a link to GitHub, and if it doesn't exist it
is reported as a link whose target wasn't found. See "Which files are copied" in
[Concepts](./concepts.md).

## The build stopped after an update, with a warning about an embedded file

Since v1.32.0, only the files with the extensions listed in "Which files are copied" in
[Concepts](./concepts.md) are copied to the site. If an image, video or audio embedded with
`![](…)`, `<img src>`, `<video src>` and so on points to a file with another extension (or to a
folder), it can't be shown or played, so the Build step shows a warning that "the embedded
target X is a kind of file that isn't copied". With `STRICT_LINKS=true`, this makes the build
fail, so it can stop a build that passed before you updated. To fix it, change the file to a
format on the list (for example `.mp4` for video, `.png` or `.avif` for images), or replace the
embed with a plain link such as `[clip](clip.xyz)`, which doesn't produce the warning.

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

1. A typo in `THEME`. A theme name that doesn't exist (e.g. `sepia`) falls back to `material`
   automatically, with a warning (see the [configuration reference](./configuration.md)).
2. Whether a file actually exists at the path set in `STYLE_FILE`. If it doesn't, no warning is
   shown (the build log only says `Custom style file not used`), and the custom CSS isn't
   applied.
3. The priority of the three-layer cascade (base CSS → THEME → STYLE_FILE). `STYLE_FILE` is the
   top layer, loaded last, so check whether the CSS rules you wrote there override as expected,
   including in terms of specificity (the strength of the selector). See
   [Theming](./theming.md) for details.

## The preview looks different from the published site

`preview` builds with the build script copied into your repository (`.github/tsuzuri/`) and the
settings in `.github/docs-pages.config`, so it generally looks the same as the published site. If
it doesn't, check the following.

1. **Changes not pushed yet**: local changes show up in `preview`, but not on the published site
   until you push.
2. **Browser cache**: the published site may be showing an old version. Reload it.
3. **Different site URL**: the published site has a path, like `https://<owner>.github.io/<repo>/`,
   while `preview` opens at `http://localhost:4000/`. Links are adjusted automatically, so this is
   usually fine, but if you wrote a full URL of the published site in Markdown, like
   `https://<owner>.github.io/<repo>/...`, it goes to the published site.

## preview says "ポート 4000 は使用中です" (port 4000 is in use)

Another app (or another `preview`) is using the same port. Choose another number, like
`--port 4001` (see the [CLI reference](cli.md#previewing-locally-preview)).

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
`SITEMAP_JSON=true`. See "Setting up a custom domain" in [Deployment](./deployment.md) for
details.

## Is HTML written in Markdown output as is?

Yes. HTML written in Markdown (`<div>`, `<script>` and so on) and links starting with
`javascript:` are output to the generated page as they are, without sanitizing. Tsuzuri is a tool
for "publishing the contents of your own repository as your own site", and it assumes the people
writing the Markdown are trusted just like the site owner.

If you accept Markdown through pull requests from others, check before merging that it doesn't
contain unintended `<script>` tags or links.
