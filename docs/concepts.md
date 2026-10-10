---
title: Concepts
---

# Concepts

This page explains how a multi-page site is built from a single README.

## Crawling from the README (BFS)

The build starts from `ROOT_MD` (`README.md` by default) and collects pages by following the
links in the Markdown, using a method called BFS (breadth-first search).

```
README.md ──> docs/getting-started.md ──> docs/configuration.md
       └────> docs/faq.md
```

The key point is that **only files reachable by following links** are included in the site.
Even if a Markdown file is in the repository, it isn't written to the build output (`_site/`)
unless some page reachable from README.md links to it. Put the other way around, to add a new
page, just link it from an existing page and it becomes part of the site.
The same goes for images (`.png`, `.jpg`, `.svg` and so on) and other files such as PDFs and
zips: only those linked or embedded from Markdown are collected, and they are copied with the
same folder structure.
However, files starting with `.` (such as `.env`) other than Markdown and images, and files
inside folders starting with `.` (such as `.github/`) other than Markdown, images, video, audio
and PDFs (settings files, for example), are never copied, so they aren't published by mistake
(they become links to the file on GitHub; see the table below).

### Which files are copied

Among the linked files, the ones with the following extensions are copied (the extension is
compared ignoring case, so `A.PDF` is copied too, and `app.tar.gz` is matched by `gz`; v1.32.0
or later. Before that, every file with an extension was copied).

| Kind | Extensions |
|---|---|
| Images | `png` `jpg` `jpeg` `gif` `svg` `webp` `bmp` `ico` `avif` `apng` `tif` `tiff` `heic` `heif` `jxl` |
| Documents | `pdf` `doc` `docx` `xls` `xlsx` `ppt` `pptx` `odt` `ods` `odp` `epub` `html` `htm` |
| Archives | `zip` `tar` `gz` `tgz` `bz2` `xz` `7z` |
| Video | `mp4` `webm` `mov` `m4v` `ogv` `avi` `mkv` |
| Audio | `mp3` `m4a` `wav` `ogg` `oga` `flac` `aac` `opus` `weba` |

The idea is that files you open with an app or a browser are copied, while files whose contents
you read as text (source code, settings files, `.txt`, `.csv` and so on) and files with any
other extension become links to the file on GitHub. This keeps a kind of file Tsuzuri doesn't
know from being published unintentionally. Inside folders starting with `.`, only the PDF, video
and audio entries above (and images) are copied.

A linked `.html` or `.htm` file is copied as it is, without changing its contents. A page that
is complete in a single file (styles and scripts written inside it) is shown as it is. The other
files the HTML loads (CSS, JavaScript, images) are not followed, so they aren't copied along with
it, and the page doesn't appear in the navigation, the search or `sitemap.xml`.

A link to GitHub only opens for visitors who can view the repository. In a private repository,
for example, visitors without access can't open it, so for files you want them to see, use a
copied format or write the contents on the page.

Pages and images in folders starting with `.`, such as `.github/`, are written to a path with
a leading `_`, like `_.github/` (e.g. `.github/logo.png` → `_.github/logo.png`; v1.4.0 or
later). This is because the artifact uploaded to GitHub Pages can't contain files or folders
starting with `.`. Links are rewritten to this path automatically. Video (`.mp4`, `.webm` and
so on), audio (`.mp3` and so on) and PDFs are written the same way (v1.5.0 or later; in v1.4.0
they become links to the file on GitHub).

If the output path of a linked file collides with a generated page or a file Tsuzuri creates
(`index.html`, `404.html` and so on), the file is not copied, so the generated
one isn't overwritten, and a warning is shown (with `STRICT_LINKS=true` the build fails;
v1.4.0 or later).

Links to paths without an extension, to paths starting with `.`, or to files whose extension
isn't in the table above are handled as follows, depending on what actually exists in the
repository.

| Link target | Link in the generated site |
|---|---|
| A folder containing `README.md` or `index.md` (`[Guide](guide)`, `[Guide](guide/)`) | The page for that folder on the site (`…/guide/`) |
| A file that isn't published on the site (`LICENSE`, `.env.example` and so on) | That file on GitHub (`https://github.com/<owner>/<repo>/blob/<commit>/LICENSE`) |
| A file whose extension isn't in the copied list (`src/foo.js`, `package.json`, `notes.txt`) | That file on GitHub (`…/blob/<commit>/src/foo.js`). A line range such as `#L10-L20` is kept |
| A folder with neither `README.md` nor `index.md` (`[Source](src/)`) | The listing of that folder on GitHub |
| Something that doesn't exist | Left as is (treated as a broken link; with `STRICT_LINKS=true` the build fails) |

When building on GitHub Actions, the URL for links to GitHub is known automatically. When
building locally, it's made from git's `origin` (the GitHub repository) and the current branch
name (links to files you haven't pushed yet won't open on GitHub). If neither is known, a
warning is shown and the link keeps the path within the site (it won't open, since the file
isn't on the site, but the target exists, so it isn't treated as a broken link). This includes
files such as `.js` that used to be copied: with a host other than GitHub, for example, they
no longer open.

### Embedding files that aren't copied

Linking and embedding are treated differently. If an image, video or audio embedded with
`![](…)`, `<img src>`, `srcset`, `<video src>`, `<audio src>` or `<source src>` points to a file
that exists but isn't copied (an extension that isn't in the table, or a folder without
`README.md` or `index.md`), the `src` becomes a link to GitHub, so it can't be shown or played.
At the end of the build, a warning like "the embedded target X is a kind of file that isn't
copied, so it can't be shown or played (referenced from Y)" is printed (for a folder, "is a
folder"). With `STRICT_LINKS=true` this counts as a link problem and the build fails, so an
update can stop a build that used to pass. To fix it, change the file to a format in the table
or, if you don't need to embed it, turn the embed into a plain link. Plain links such as
`[x](clip.xyz)` and `<a href>` don't produce this warning.

Linking to the same file from several places doesn't process it twice, and pages that link to
each other in a cycle, like A→B→A, don't cause an infinite loop (a file already visited is not
visited again).

## Markdown → HTML conversion

Each collected `.md` file is converted to HTML and written under `_site/` with the same folder
structure and a `.html` extension (e.g. `docs/faq.md` → `docs/faq.html`). Links to other pages
in the Markdown (written like `[FAQ](./docs/faq.md)`) are rewritten to point to the `.html`
files automatically. You don't need to rewrite any links yourself.

When Japanese text is wrapped in the middle of a sentence (still the same paragraph in
Markdown), line breaks between two full-width characters (kanji, kana and full-width
punctuation) are removed in the output, so no stray spaces appear.

### Folder URLs (README.md → index.html)

`ROOT_MD` is also written as the top page of the site (`index.html`). In the same way, a
`README.md` in a subfolder is also written as that folder's `index.html` (e.g.
`guide/README.md` → `guide/README.html` and `guide/index.html`). This lets the page open at a
folder URL like `https://…/guide/`. If the same folder has an `index.md`, that one becomes
`index.html`.

When Markdown links to a folder, like `[Guide](guide/)`, the link keeps the trailing `/` and
points to `…/guide/`, and that folder's `README.md` (or `index.md` if there's no README) is
included in the site. A link to a folder with neither becomes a link to the folder listing on
GitHub (see the table above).

### Links to headings

Each heading gets an `id` using the same rules as when GitHub displays a README. So links to a
heading within a page that work on GitHub, such as `[details](docs/frontmatter.md#theme)`, also
work on the generated site.

- The `id` is the heading text lowercased, with punctuation removed and spaces replaced by `-`
  (e.g. `## Getting Started` → `getting-started`, `## テーマ・スタイル(Theming)` →
  `テーマスタイルtheming`). Non-ASCII letters such as Japanese are kept as they are.
- If the same heading appears more than once on a page, the second and later ones get `-1`,
  `-2` and so on.

If the target page doesn't have that heading (the heading was renamed, misspelled and so on),
the build log shows it as "a link whose heading isn't found on the target page". With
`STRICT_LINKS=true` the build fails (v1.5.0 or later).

## Absolute paths and BASE_PATH

All links and image paths in the generated HTML are unified as "absolute paths from the root of
the site". This is done by prefixing them with a value called `BASE_PATH`.

`BASE_PATH` is computed automatically depending on the kind of site (it's not something you
set; it's computed in the build job of the workflow (`docs-pages.yml`) and passed to
`build-docs.mjs` as an environment variable on GitHub Actions).

- **User or organization sites** (repositories named `<owner>.github.io`), or when using a
  custom domain: `BASE_PATH` is empty and the site is placed right under the domain.
- **Project sites** (any other ordinary repository name): `BASE_PATH` is `/<repository name>`
  (the repository name becomes part of the URL, as in `https://<owner>.github.io/<repo>/`).

Thanks to these unified absolute paths, broken links from miscalculated relative paths are
unlikely, however deep a page is in the folder structure.

## External links and anchors

The following links are not treated as "pages within the site" and are not crawled (they are
written as they are, without rewriting).

- External links with a scheme, such as `http://`, `https://` and `mailto:`
- Protocol-relative URLs such as `//example.com/...`
- Links that are only an anchor within the same page, such as `#heading-name`

## Broken links and path traversal

If the target file doesn't actually exist (a broken link), the build doesn't stop with an
error. It records the link as `missing` and continues.

Links that try to reach files outside the repository, such as `../../../etc/passwd` (path
traversal), and broken links that fail URL decoding are never followed, for safety, and are
recorded as `rejected`. This is a security defense, and unlike external links or anchor-only
links, they're recorded separately so you can tell they were "deliberately refused".

In either case the build itself doesn't fail, and the valid pages are still generated (only
with `STRICT_LINKS=true` does the build fail to stop publishing; see the
[configuration reference](./configuration.md#strict_links)).

## The 404 page

A `404.html`, shown when someone visits a URL that doesn't exist, is generated too. If you put
a `404.md` at the root of the repository, its contents are used (images used in it are copied
too; this site's 404 page is also made with `404.md`). Otherwise the default content is used
("Page not found" and a link to the top page, in Japanese if the page language is Japanese and
in English otherwise; on a [multilingual site](./i18n.md), a notice for each language that has
a top page, with links to each top page, where only the notice in the URL's language is shown;
see [Multilingual sites](./i18n.md#the-404-page)). It's shown with the same navigation and theme as the
other pages, and isn't indexed by search engines (`noindex`).

## sitemap.xml and robots.txt (for search engines)

When building on GitHub Actions (when the site URL is known), a `sitemap.xml` for search
engines is also written (with `LAST_UPDATED=true`, each page's last update date is included as
`<lastmod>`). It lists the URLs of all pages on the site (except pages with `noindex: true` in
the frontmatter), so you can submit it to Google Search Console and similar tools.

When the site is right under the domain (a repository named `<owner>.github.io`, or when
`CUSTOM_DOMAIN` is set), a `robots.txt` pointing to `sitemap.xml` is written too (`robots.txt`
can only live right under the domain, so it isn't written for a site like
`https://<owner>.github.io/<repo>/`).

Each page also gets a `<link rel="canonical">` and an `og:url` showing its canonical URL. For
the top page and a folder's `README.md`, the canonical URL is the top URL or the folder URL
(`…/guide/`), not `README.html`.

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
the site (a missing image gives the same "file not found" warning, and fails the build with
`STRICT_LINKS=true`). For example, this switches the logo for dark mode:

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

Images written in Markdown (`![alt](image.png)`) get `loading="lazy"`, so they load when you
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

## Syntax highlighting

Code blocks with a language name, like ```` ```js ````, are highlighted at build time (using
[highlight.js](https://highlightjs.org/); no JavaScript runs in the browser). Code blocks
without a language name, or with an unsupported one, are shown as they are without
highlighting (the language is never guessed). The colors follow the theme and can be changed
with custom CSS (see [Theming](./theming.md)).

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

If the theme has no light/dark difference (90s (`nineties`), which is light only, `none` and so
on), the button isn't shown. To write dark colors in your custom CSS, see
[Theming](./theming.md#supporting-light-and-dark).

## How the CSS is loaded

The page CSS (base CSS, theme and custom CSS) is combined into one file
(`tsuzuri-<string made from its contents>.css`) that every page loads (v1.7.0 or later; before
that it was embedded in each page). Since all pages use the same file, the browser cache makes
the second and later pages show up faster. When the CSS changes, the file name changes too, so
an old CSS never sticks around. Pages that change `theme` or `styleFile` load a file for that
combination.

Readers who chose "reduce motion" in their OS don't get animations such as cards lifting on
hover (v1.7.0 or later).

## About sitemap.json (for debugging)

With `SITEMAP_JSON=true` in `.github/docs-pages.config`, a file named `sitemap.json` is
generated right under the output folder (`OUT_DIR`, `_site` by default). It isn't generated by
default (it includes things like the names of broken link targets, which would be visible to
anyone if placed on the public site). It isn't a page to view in the browser; it's debugging
output to check "which files were actually collected and which links were excluded". It
includes the list of collected pages (with titles and descriptions), the list of images, the
page hierarchy (`hierarchy`, the parent-child relationships from following links, and `tree`,
following the folder structure), the lists of `missing` (broken links) and `rejected` (refused
links) described above, and settings such as the current `THEME` and the site name. When the
site isn't generated as you expect, set `SITEMAP_JSON=true` temporarily and check this file to
find the cause more easily (we recommend setting it back to `false` when you're done).

The title of each page in the page list (`pages`) and in `tree` is the frontmatter `title`. For
pages without a `title`, `pages` uses the file path (e.g. `docs/cli.md`), while `tree` and the
navigation use the first `# heading` (h1) in the text, or the file name (e.g. `cli.md`) if
there's none.
