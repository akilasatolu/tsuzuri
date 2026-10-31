---
title: Change the look
description: Pick a style in the gallery and set THEME, or change only the colors with a few CSS variables
order: 20
---

# Change the look

To change the look, pick a style in the [gallery](../../gallery/README.md) and set `THEME`. To change only the colors, override a few CSS variables.

## Pick a style from the gallery

1. Download the CSS file with the button on the tile of the style you like.
2. Put it in `.github/tsuzuri/styles/`.
3. Set `THEME` in `.github/tsuzuri/config` to its file name, for example `THEME=glass.css`.

The colors, link underlines and the rest of the look switch together. `default.css` is included in the package and is the default, so you don't need to download it just to use it.

## Custom styles

Every `.css` file you put in `.github/tsuzuri/styles/` is called a **custom style**: `default.css`,
the ones you download from the gallery, and the ones you write yourself are all treated the same
way. Choose one for the whole site with the `THEME` key in `.github/tsuzuri/config`, and write
**only the file name** (no folders):

```
THEME=glass.css
```

**A custom style switches not just the colors but also decoration such as link underlines,
heading weight and line spacing, as one "visual identity"** (it isn't a feature for swapping only
the colors).

- If `THEME` is left out or empty, it's `default.css`.
- A value that isn't the file name of a `.css` file (such as `none` or a path with folders) shows a warning, and `default.css` is used.
- If the file doesn't exist, a warning is shown, and the site is built with the base CSS only.
- The file is always read from `.github/tsuzuri/styles/`. `STYLE_DIR` doesn't affect it (`STYLE_DIR` is
  only the location of the base CSS).

### default.css (included in the package)

`default.css` is Tsuzuri's standard custom style, inspired by Material Design 3: blue colors,
rounded cards with shadows, and a tinted selection in the navigation. It switches between light and
dark automatically. It is included in the package: `init` puts it (and the base `base.css`) in
`.github/tsuzuri/styles/`, and the settings file starts with `THEME=default.css`, so you don't need to
download it. `init --update` overwrites it with the latest version; to edit it, copy it under another name
and set that name in `THEME`.

### Custom styles in the gallery

The other custom styles are not distributed with the package. They're in the
[gallery](../../gallery/README.md), where you can see what each looks like on real pages and download its CSS file.
Download one, put it in `.github/tsuzuri/styles/`, and set `THEME=<file name>.css`.

- **Glass (`glass.css`)**: Glassmorphism. Thin, clear glass cards that let the colors show through,
  over a slowly swaying, flowing aurora.
- **Neumorphism (`neumorphism.css`)**: Neumorphism. Parts in the same color as the background,
  raised or pressed in with light and shadow.
- **Editorial (`editorial.css`)**: a style that relies on typography and white space, like a
  magazine or a polished document. Large serif headings with chapter numbers, and a vermilion
  accent.
- **Minimal (`minimal.css`)**: a calm look in only white, black and gray, like the Vercel or Linear
  docs. Only links are blue.
- **Kintsugi (`kintsugi.css`)**: a style after kintsugi, the craft of mending broken pottery with
  lacquer and gold. Gold seams run across porcelain-like cards, and code blocks are lacquer
  black. Porcelain in light mode, black lacquer in dark mode.
- **Blueprint (`blueprint.css`)**: like a blueprint, with a white grid and fine lines on blue, and
  headings with dimension lines. Always looks the same.
- **90s (`nineties.css`)**: 90s nostalgia. A Windows 95-style teal desktop with gray windows and
  raised buttons. Light only.
- **none (`none.css`)**: a CSS file that contains only comments. Only the base CSS is applied, and
  the colors and decoration are the browser's defaults. (There is no `THEME=none` keyword; use
  `none.css` like any other custom style.)
- **Tsuzuri (`tsuzuri.css`)**: this site's own look (see below).

Blueprint always looks the same and 90s is light only; the others switch between light and dark
automatically to match the OS setting. Glass's glass (the background blur) is shown as
semi-transparent cards in browsers that don't support it.

## Change only the colors

You don't have to write CSS to change the colors. Copy `default.css` under another name (for example `my.css`), override the CSS custom properties below in it, and set that file name in `THEME` of `.github/tsuzuri/config` (`default.css` itself is overwritten by `init --update`, so don't edit it).

Each custom style defines CSS custom properties in the form `:root { --name: value; }`. By
redefining the same variable names, you can swap just the colors. The main variables are listed
below.

| Variable | Meaning |
|---|---|
| `--fg` | Text color |
| `--bg` | Background color |
| `--border` | Color of table borders and dividers |
| `--accent` | Accent color for links and the like |
| `--code-bg` | Background of code blocks and inline code |
| `--font` | Body font (font-family) |
| `--content-width` | Maximum width of the content column (e.g. `860px`) |
| `color-scheme` | `light` / `dark` / `light dark` (follows the OS setting) |
| `--hl-keyword` / `--hl-string` / `--hl-number` / `--hl-title` / `--hl-attr` / `--hl-comment` | Syntax highlighting colors (keywords, strings, numbers, function names and the like, attributes and variables, comments). If not set, they're derived from the custom style's `--accent` and `--fg` |
| `--alert-note` / `--alert-tip` / `--alert-important` / `--alert-warning` / `--alert-caution` | Color of the box and title of alerts (`> [!NOTE]` and so on) |

## Overriding the custom style for a single page

`THEME` in `.github/tsuzuri/config` is the site-wide default, but the frontmatter `theme` key
replaces the custom style for each page. Write the file name of a custom style (a file in
`.github/tsuzuri/styles/`, ending with `.css`). The page uses the base CSS plus that file; the
site-wide custom style is not mixed in. To show a page with no decoration, use `theme: none.css`
(the file `none.css`, which contains only comments, has to be in `.github/tsuzuri/styles/`). See
the [frontmatter reference](../reference/frontmatter.md#theme) for details.

To compare custom styles on your own site, give several Markdown files different `theme` values (file names in `.github/tsuzuri/styles/`) and build with the regular `tsuzuri-pages.yml`. You can also compare them as real pages in the [gallery](../../gallery/README.md).

## Writing your own custom style

Put a new CSS file in `.github/tsuzuri/styles/` (the same folder as `default.css`) and set its file
name in `THEME`. If you only want to change the colors a little, **copy `default.css` under another
name** (for example `my.css`), rewrite the variables, and set `THEME=my.css`. (`default.css` itself is
overwritten by `init --update`, so don't edit it.)

The variables you can override are listed in [Change only the colors](#change-only-the-colors).

> [!TIP]
> This site itself is built with a custom style of its own, a "thread" design
> ([tsuzuri.css](https://github.com/akilasatolu/tsuzuri/blob/main/.github/tsuzuri/styles/tsuzuri.css)). See it as an example of how to write
> one (you can see the result in the [custom style example](../../gallery/tsuzuri.md)).
>
> This site's [gallery](../../gallery/README.md) shows each custom style on its own page by writing
> [`theme`](../reference/frontmatter.md#theme) in the frontmatter of the sample pages.

Besides overriding variables, you can also add ordinary CSS rules such as `main h1 { ... }` to a
custom style to adjust details. The custom style is loaded after the base CSS, so for the same
specificity, what you write wins.

## Supporting light and dark

On sites with `NAV_ENABLED=true`, readers can choose light or dark with a button in the
navigation. The chosen mode is added as `<html data-theme="light">` or
`<html data-theme="dark">` (nothing is added when they haven't chosen, and the OS setting is
followed).

To write dark colors in your custom style, write the same colors for both "when the OS is in dark
mode (unless light was chosen)" and "when dark was chosen". `default.css` and the other custom styles in the gallery are written
this way too.

```css
/* Light colors */
:root {
  --fg: #1a1a1a;
  --bg: #ffffff;
}

/* Dark colors */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fg: #e5e5e5;
    --bg: #14161a;
  }
}
:root[data-theme="dark"] {
  --fg: #e5e5e5;
  --bg: #14161a;
}
```

## Two layers: base and a custom style

The look (CSS) of the generated pages is made by stacking two layers in order. The later layer
has higher priority: for rules of the same specificity, it overrides the earlier one.

```
1. Base CSS (base.css)   … always applied. Only structural rules without colors, such as the
                           layout width, table borders and code block padding
        ↓
2. A custom style (one)  … the colors and decoration. A CSS file in .github/tsuzuri/styles/,
                           chosen with `THEME=<file name>.css` (default.css if you write nothing)
```

The base CSS has no colors at all; it only references CSS custom properties (variables), as in
`color: var(--fg);`. The actual colors are decided only by the variables defined by the custom
style in the second layer. With a custom style that defines none of them (such as `none.css`,
which contains only comments), the variables stay undefined, and the colors end up as the
browser's default look (black text on a white background, and so on).

## Read next

- [Sharing and search](share-and-search.md): how links look when shared (OGP), the favicon and search.
- [Multilingual sites](multilingual.md): support more than one language.
