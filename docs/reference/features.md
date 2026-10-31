---
title: Page features
description: GitHub syntax, the table of contents, search, dark mode and the other features of a page on the site
order: 50
---

# Page features

GitHub syntax, search, dark mode and the other features of the pages on the site all work without extra setup.

## GitHub syntax (alerts, footnotes, diagrams, task lists)

The following syntax works the same as when GitHub displays a README.

**Alerts**: write `[!NOTE]` or similar on the first line of a blockquote, and it's shown in a
box colored by type.

```markdown
> [!NOTE]
> A supplementary note.
```

There are five types: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]`. The
box title is in Japanese if the page language is Japanese, and in English otherwise.

**Footnotes**: write `[^1]` in the text and `[^1]: content` anywhere on the page, and a
numbered link appears in the text, with a list of footnotes at the end of the page.

```markdown
The name Tsuzuri comes from a bookbinding term[^1].

[^1]: Binding many sheets of paper into one volume.
```

**Diagrams (mermaid)**: a ```` ```mermaid ```` code block is shown as a diagram such as a
flowchart. Diagrams are drawn in the browser by [mermaid](https://mermaid.js.org/), loaded
from a CDN (jsDelivr) (only on pages that have a diagram; where JavaScript doesn't run, the
diagram's source code is shown).

**Task lists**: `- [ ]` and `- [x]` become a list with checkboxes.

**Emoji shortcodes**: GitHub-style shortcodes such as `:tada:` are shown as emoji (🎉). The names
come from [gemoji](https://github.com/wooorm/gemoji), a package that lists the emoji shortcodes GitHub uses.

```markdown
Release day :tada: Thanks :+1: See you :wave:
```

This is shown as "Release day 🎉 Thanks 👍 See you 👋". Shortcodes are converted in body text,
bold and italic text, link text, tables, lists, quotes and footnotes, and between inline HTML tags
such as `<span>`. In headings too: the heading shows the emoji, but its link (the id) stays the
same as when written with the name, so `# Demo :tada:` is shown as "Demo 🎉" and keeps the
id `demo-tada`. The table of contents, the page title, the navigation and search use the emoji.
The `title` and `description` in the frontmatter are not converted.

Shortcodes are **not** converted in these places:

- Code spans and code blocks.
- Inline `<code>`, `<kbd>`, `<pre>`, `<script>`, `<tt>`, `<samp>` and `<style>`, including
  bold text or links inside them. If a `<code>`, `<kbd>`, `<pre>` or `<script>` tag is never closed, nothing is converted until the
  end of the page.
- Inside block-level HTML, such as the `<summary>` line of `<details>`. To put an emoji there,
  write the emoji character itself (🎉) instead of the shortcode.
- Links written as a bare URL (neither the displayed text nor the `href`), and the alt text of
  images.
- Names that aren't in the list, such as GitHub's image-only emoji (`:shipit:`), uppercase names
  (`:TADA:`), and text like `10:30:45`.

A shortcode is converted even in the middle of a word: the `:x:` in `root:x:0` becomes ❌. To keep
the text as it is, put a backslash before the first colon (`\:x:`) or write it as code
(`` `root:x:0` ``).

**`<picture>` and `srcset`**: the images in the `srcset` of `<img>` and `<source>` written as HTML
are handled like `src`: they are copied to the site, and their paths are rewritten to paths on
the site (a missing image gives the same "The linked file was not found: …" warning, and fails the build with
`STRICT_LINKS=true`; a build script copied by v1.36.0 or earlier prints it in Japanese, as `リンク先のファイルが見つかりません: …`). For example, this switches the logo for dark mode:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png 1x, assets/logo-dark@2x.png 2x">
  <img src="assets/logo.png" alt="Logo">
</picture>
```

The size descriptors (`1x`, `480w`) are kept as written. Values without quotes (`srcset=a.png`)
and attributes with spaces around the `=` (`srcset = "a.png"`) are not recognized, the same as for
`src`. The `media="(prefers-color-scheme: dark)"` follows the OS (browser) setting; it does not
follow the site's light/dark toggle button. GitHub's `#gh-dark-mode-only` suffix is not handled.

## Links to headings and the table of contents

Headings at h2 and below show a `#` link when you hover over them. Clicking it gives you the URL
of that heading, which is handy for sharing a specific heading.

With `NAV_ENABLED=true`, pages with three or more headings (h2 and h3) show their table of
contents at the top (right after the h1). For pages where you don't want it, write
`toc: false` in the frontmatter (see the [frontmatter reference](./frontmatter.md#toc)).

## Image loading

Images written in Markdown (`![alt](../image.png)`) get `loading="lazy"`, so they load when you
scroll to where they appear. Pages with many images show up faster.

Images in the repository (PNG, GIF, JPEG, WebP, and SVGs with a stated size) also get `width`
and `height` read from the image file (v1.5.0 or later). This keeps the text below from
jumping while images load. The displayed size doesn't change (images wider than the content
are scaled down, keeping their aspect ratio).

## Last updated date

With `LAST_UPDATED=true`, the end of each page shows the date that Markdown file was last
committed in git, like "Last updated: 2026-09-27". When building on GitHub Actions, the
workflow fetches the full git history before computing the dates (see the
[configuration reference](./configuration.md#last_updated)).

## Externally loaded files and dependency safety

Pages with a diagram (mermaid) load mermaid from a CDN (jsDelivr) in the browser. The loaded
file carries a hash check (SRI), so if its contents were swapped on the CDN, the browser won't
run it (the diagram is shown as code; v1.7.0 or later).

The build dependencies (marked, highlight.js and marked-footnote) are installed exactly as the
versions and hashes written in `.github/tsuzuri/package-lock.json`. If the downloaded contents
differ, the installation stops, and it also checks that the packages were published with
npm's official signatures (`npm audit signatures`). Package scripts are not run during
installation (v1.7.0 or later).

## Copy button for code

A "Copy" button appears at the top right of code blocks; click it to copy the code (v1.6.0 or
later). The button is always shown. Only pages with code blocks load
the small script (`tsuzuri-copy.js`). The label is "コピー" if the page language is Japanese,
and "Copy" otherwise. So that the button never covers the code, code blocks with the button get
extra space at the top.

## Image carousel

Images placed inside `<div class="tsuzuri-carousel">` ... `</div>` (raw HTML in Markdown) line up
side by side and can be scrolled sideways. Under them, "previous" and "next" arrows, dots and a count
such as "1 / 2" appear (v1.39.0 or later). They also appear when there is only one image ("1 / 1",
with the arrows disabled). Only pages with a carousel load the small script (`tsuzuri-carousel.js`). The
labels are in Japanese if the page language is Japanese, and in English otherwise. Where JavaScript
doesn't run, nothing is added and the images can still be scrolled sideways. [The gallery](../../gallery/README.md) uses it.

## Syntax highlighting

Code blocks with a language name, like ```` ```js ````, are highlighted at build time (using
[highlight.js](https://highlightjs.org/); no JavaScript runs in the browser). Code blocks
without a language name, or with an unsupported one, are shown as they are without
highlighting (the language is never guessed). The colors follow the custom style and can be changed
in your own custom style (see [Change the look](../guides/style.md)).

## Site search

With `NAV_ENABLED=true`, a search box appears at the top of the navigation. At build time, an
index (`search-index.json`) is made from each page's title and text, and when you type in the
search box, a small script (`tsuzuri-search.js`) finds the matching pages in that index and
shows them.

- Pages containing all the space-separated words are shown, up to 10, with title matches
  first.
- The index is loaded the first time the search box is used, so readers who don't search don't
  pay for it.
- Where JavaScript doesn't run, the search box simply isn't shown, and the navigation still
  works.
- It works from the keyboard too. Press ↓ in the search box to move to the results, pick one
  with ↑↓ and open it with Enter. Esc returns to the search box and clears it (v1.7.0 or later).

## Switching between light and dark

With `NAV_ENABLED=true`, a button that switches between light and dark (☀/☾) appears next to
the navigation header (v1.7.0 or later). Your choice is saved in the browser, so the page looks
the same the next time you open it. If you haven't chosen, it follows the OS setting (dark mode
or not), as before.

If the custom style has no light/dark difference (90s (`nineties.css`), which is light only, `none.css` and so
on), the button isn't shown. To write dark colors in your custom style, see
[Change the look](../guides/style.md#supporting-light-and-dark).

## How the CSS is loaded

The page CSS (the base CSS and the custom style) is combined into one file
(`tsuzuri-<string made from its contents>.css`) that every page loads (v1.7.0 or later; before
that it was embedded in each page). Since all pages use the same file, the browser cache makes
the second and later pages show up faster. When the CSS changes, the file name changes too, so
an old CSS never sticks around. Pages that change `theme` load a file for that
combination.

Readers who chose "reduce motion" in their OS don't get animations such as cards lifting on
hover (v1.7.0 or later).

## About sitemap.json (for debugging)

With `SITEMAP_JSON=true` in `.github/tsuzuri/config`, a file named `sitemap.json` is
generated right under the output folder (`OUT_DIR`, `_site` by default). It isn't generated by
default (it includes things like the names of broken link targets, which would be visible to
anyone if placed on the public site). It isn't a page to view in the browser; it's debugging
output to check "which files were actually collected and which links were excluded". It
includes the list of collected pages (with titles and descriptions), the list of images, the
page hierarchy (`hierarchy`, the parent-child relationships from following links, and `tree`,
following the folder structure), the lists of `missing` (broken links) and `rejected` (refused
links) described above, and settings such as the current `THEME` (the custom style file name) and the site name. When the
site isn't generated as you expect, set `SITEMAP_JSON=true` temporarily and check this file to
find the cause more easily (we recommend setting it back to `false` when you're done).

The title of each page in the page list (`pages`) and in `tree` is the frontmatter `title`. For
pages without a `title`, `pages` uses the file path (e.g. `docs/cli.md`), while `tree` and the
navigation use the first `# heading` (h1) in the text, or the file name (e.g. `cli.md`) if
there's none.
