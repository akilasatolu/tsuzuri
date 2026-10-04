---
title: Frontmatter reference
---

# Frontmatter reference

"Frontmatter" is extra information (metadata) for a single page, written between `---` lines at
the very top of a Markdown file. It lets you set things like the page title and the description
used for SEO, separately from the content.

## Format

At the very top of a Markdown file (e.g. `README.md`), put a block that starts and ends with
`---`, and write one `key: value` per line inside it.

```markdown
---
title: Project name
description: A one- or two-sentence summary of the project
ogImage: /assets/ogp.png
noindex: false
---

# Regular Markdown content starts here
...
```

Only the simple one-line `key: value` form is supported. It's read by a small built-in parser
that doesn't do full YAML parsing.

## Supported keys

### title
The title of the page. Where it's used, and what happens when it isn't set:

| Used in | With `title` | Without `title` |
|---|---|---|
| The `<title>` tag and `og:title` | The `title` value | The first heading in the text (h1, including one written as `<h1>`). If there's none, the site name for the starting page and the file path for other pages |
| The navigation and the previous/next page links (with `NAV_ENABLED=true`) | The `title` value | The first heading in the text (h1, including one written as `<h1>`). If there's none, the file name (e.g. `cli.md`). Only for the starting page, the site name if there's no h1 either |
| The page list in `sitemap.json` (with `SITEMAP_JSON=true`) | The `title` value | The file path (e.g. `docs/cli.md`) |

To use different names in `<title>` and the navigation (to show a shorter name in the
navigation, for example), write a `title`.

### description
The description of the page. It's used for both `<meta name="description">` and
`<meta property="og:description">` (shown in search results and when the page is shared on
social media).

If not set, a description of up to 120 characters is made automatically from the first
paragraph of the text (excluding alert titles) (v1.6.0 or later; in earlier versions these tags
aren't output at all).

### ogImage
The image shown when the page is shared on social media (the OGP image). You can give either a
relative path or an absolute URL starting with `https://`. A relative path is relative to the
page's file (or to the repository root if it starts with `/`); it's converted to an absolute URL
of the site, and the image is copied to the site too. If left out, `OGP_DEFAULT_IMAGE` in
`.github/docs-pages.config` is used if set, and otherwise no `og:image` tag is output.

### ogType
The value used for OGP's `og:type`. If left out, the default is `website`.

### noindex
Set to `true` if you don't want search engines to index this page. Only when it's `true` is
`<meta name="robots" content="noindex">` output. With any other value (`false` or not set), the
tag isn't output at all (it's case-insensitive, and only a value equal to `"true"` counts as
true).

### theme
Set this when you want this page alone to use a theme different from `THEME` (the site-wide
theme) in `.github/docs-pages.config`. Two kinds of values are accepted.

- **A built-in theme name**: `material` / `glass` / `neumorphism` / `editorial` / `minimal` /
  `blueprint` / `nineties` / `none` (see [Theming](theming.md) for what they mean; with `none`,
  the theme layer isn't applied to this page)
- **The path of a custom CSS file**: any value that doesn't match one of the eight names above
  is treated as a custom CSS file, given as a path relative to the repository root. Prepare the
  file yourself and write its path as is. Paths outside the repository (a path starting with
  `../`, an absolute path, or a symbolic link pointing outside the repository) aren't allowed;
  if given, a warning is shown and the site-wide `THEME` is used instead.

```markdown
---
theme: nineties
---
```

```markdown
---
theme: assets/my-original-theme.css
---
```

Either way, `STYLE_FILE` in `.github/docs-pages.config` (the site-wide custom CSS, the third
layer) is still applied regardless of this key. So the layers stack as "base CSS → (this
page's) theme → STYLE_FILE". If you don't want `STYLE_FILE` applied to this page, use
[`styleFile`](#stylefile) below.

If no CSS file is found for the given theme name or path (a built-in theme's CSS is missing, a
custom path doesn't exist, and so on), a warning is shown and that page falls back to the
site-wide `THEME` (the build itself doesn't stop; a "fail-open" behavior).

### styleFile
Sets, as a path from the root of the repository, a custom CSS file used for this page instead
of `STYLE_FILE` in `.github/docs-pages.config` (the site-wide custom CSS, the third layer)
(v1.5.0 or later).

Give it an empty CSS file (only comments) and that page won't get the site-wide custom CSS, so
it shows only the `theme`. For example, use it when the whole site is built with custom CSS but
you want theme sample pages to look like the built-in theme (this site's
[theme gallery](gallery.md) does exactly that).

```markdown
---
theme: material
styleFile: .github/tsuzuri/styles/plain.css
---
```

If the file isn't found or points outside the repository, a warning is shown and the site-wide
`STYLE_FILE` is used.

### nav
With `false`, the page isn't listed in the navigation (sidebar) or in the "previous page / next
page" links (v1.6.0 or later). The page itself is still output, so it opens from links on other
pages. It's still included in site search.

Use it for pages that aren't worth listing in the navigation, such as sample or supplementary
pages.

```markdown
---
nav: false
---
```

### order
Sets the order in the navigation as a number (v1.6.0 or later). Within the same folder, pages
with an `order` come first, smallest first, and pages without one come after them, in the order
they were found through links. A folder's position can be set with the `order` of the
`README.md` (or `index.md`) inside it. On a [multilingual site](i18n.md), a navigation is made
for each language, and `order` works within each language's navigation (the `order` of a
Japanese page decides the order in the Japanese navigation).

```markdown
---
order: 1
---
```

### toc
With `NAV_ENABLED=true`, pages with three or more headings (h2 and h3) show a table of contents.
Set `false` to hide it on this page only.

```markdown
---
toc: false
---
```

## Limitations

- Line endings can be LF or CRLF (files created on Windows work as they are). A BOM at the start
  of the file is ignored too.
- Complex structures such as arrays and nested objects aren't supported. Only the flat form
  "one line = one string (or a boolean, for `noindex` only)" is.
- Values that span multiple lines (like YAML block scalars) aren't supported either.
- If the whole value is wrapped in `"…"` or `'…'`, the wrapping quotes are removed
  (`title: "My Site: Home"` becomes `My Site: Home`).
- Since no YAML parser is added, unknown keys other than those above don't cause an error;
  they're kept as strings (they aren't used in the output at the moment).
- If there's an opening `---` but no closing `---`, a warning is shown, the block isn't
  interpreted as frontmatter, and the whole block is treated as content (the build itself
  doesn't stop; a "fail-open" behavior).
