---
title: Sharing and search
description: What to write so that your links look good when shared and your site is easy to find, covering OGP, the favicon, the sitemap and llms.txt
order: 60
---

# Sharing and search

A few settings decide how your pages look when their links are shared, and how search engines and AI tools find your site.

## How a link looks when shared (OGP)

- **Title and description**: write `title` and `description` in the frontmatter of each page. They appear in link previews and in search results. Without `description`, up to 120 characters from the first paragraph are used.
- **Image**: write `ogImage` in the frontmatter of a page, or set `OGP_DEFAULT_IMAGE` in `.github/tsuzuri/config` for all pages that don't have one (for example `assets/ogp.png`). Without either, no image is shown.
- **Site name**: `SITE_NAME` is shown as the name of the site in the preview, and at the top of the navigation. It is the repository name when left empty.

Details: [`OGP_DEFAULT_IMAGE`](../reference/configuration.md#ogp_default_image), [`SITE_NAME`](../reference/configuration.md#site_name) and [`description` and `ogImage`](../reference/frontmatter.md).

## Favicon

Set `FAVICON_FILE` to the path of an image (for example `FAVICON_FILE=assets/favicon.svg`) and every page shows it as the icon in the browser tab. Without it, there is no favicon. Details: [`FAVICON_FILE`](../reference/configuration.md#favicon_file).

> [!NOTE]
> The logo colors of Tsuzuri (flame-orange lines on white pages on a navy background) are Tsuzuri's own branding. They have nothing to do with the favicon of your site, which you set with `FAVICON_FILE`.

## sitemap.xml and robots.txt

On GitHub Actions, a `sitemap.xml` that lists the pages of your site is written for search engines (without the pages that have `noindex: true`). With `LAST_UPDATED=true`, it also has the date each page was last updated. A `robots.txt` that points to it is written only when the site is right under a domain (a repository named `<owner>.github.io`, or `CUSTOM_DOMAIN`). You don't write any of these yourself.

## llms.txt

`LLMS_TXT` is on by default: an `llms.txt` that lists the pages of your site for AI tools is written on GitHub Actions. Its `## Docs` list follows the order of the navigation, so the page you want an AI to read first should come first (set `order`). Pages with `nav: false` are listed under `## Optional`. Write `LLMS_TXT=false` to turn it off. Details: [How it works](../reference/how-it-works.md#llmstxt).

## Read next

- [Update](./update.md): keep Tsuzuri up to date with one command.
- [FAQ](../faq.md): when something does not work.
