---
title: Theming
---

# Theming

## The three-layer cascade

The look (CSS) of the generated pages is made by stacking (cascading) three layers in order.
Later layers have higher priority: for rules of the same specificity, a later layer overrides
an earlier one.

```
1. Base CSS (base.css)       … always applied. Only structural rules without colors, such as
                               the layout width, table borders and code block padding
        ↓
2. THEME (resolved by name in config.mjs) … the colors and decoration of the theme chosen
                               with the `THEME` key (with `THEME=none`, this whole layer is skipped)
        ↓
3. STYLE_FILE (always last)  … your own CSS. If set, it's always loaded last
```

The base CSS has no colors at all; it only references CSS custom properties (variables), as in
`color: var(--fg);`. The actual colors are decided only by the variables defined by the theme
in the second layer. With `THEME=none`, the second layer is skipped entirely, so the variables
stay undefined, and the colors end up as the browser's default look (black text on a white
background, and so on).

## Built-in themes

Choose one of the following with the `THEME` key in `.github/docs-pages.config`.
**A theme switches not just the colors but also decoration such as link underlines, heading
weight and line spacing, as one "visual identity"** (it isn't a feature for swapping only the
colors).

You can see what each theme actually looks like in the [theme gallery](gallery.md).

These themes follow recent web design trends (v1.19.0 or later). Each one shows the content and
the navigation on cards with the theme's texture. If `THEME` is left out, it's Material
(`material`) (v1.20.0 or later).

- **Material (`material`, the default)**: a standard style inspired by Material Design 3. Blue
  colors, rounded cards with shadows, and a tinted selection in the navigation.
- **Glass (`glass`)**: Glassmorphism. Thin, clear glass cards that let the colors show through,
  over a slowly swaying, flowing aurora.
- **Neumorphism (`neumorphism`)**: Neumorphism. Parts in the same color as the background,
  raised or pressed in with light and shadow.
- **Editorial (`editorial`)**: a style that relies on typography and white space, like a
  magazine or a polished document. Large serif headings with chapter numbers, and a vermilion
  accent.
- **Minimal (`minimal`)**: a calm look in only white, black and gray, like the Vercel or Linear
  docs. Only links are blue.
- **Blueprint (`blueprint`)**: like a blueprint, with a white grid and fine lines on blue, and
  headings with dimension lines. Always looks the same.
- **90s (`nineties`)**: 90s nostalgia. A Windows 95-style teal desktop with gray windows and
  raised buttons. Light only.

Blueprint (`blueprint`) always looks the same and 90s (`nineties`) is light only; the others
switch between light and dark automatically to match the OS setting. Glass's glass (the
background blur) is shown as semi-transparent cards in browsers that don't support it.

### none
The theme layer (the second layer) isn't applied at all. Only the base CSS is applied, and the
colors and decoration are the browser's defaults.

## Overriding the theme for a single page

`THEME` in `.github/docs-pages.config` is the site-wide default, but the frontmatter `theme`
key lets you swap only the second layer (THEME) for each page. Besides built-in theme names,
you can also give a custom CSS file you've prepared (with its path). See the
[frontmatter reference](frontmatter.md#theme) for details.

## Customizing with your own CSS

Put a CSS file at the path set in `STYLE_FILE` of `.github/docs-pages.config` (default
`.github/tsuzuri/styles/custom.css`, the same folder as the built-in theme CSS), and it's added
as the third layer, loaded after the chosen theme. Use it to override part of a theme, or to
fine-tune the colors just by overriding variables. If the file doesn't exist it's ignored, and
the site is built with the theme as is.

Each theme file defines CSS custom properties in the form `:root { --name: value; }`. By
redefining the same variable names in `STYLE_FILE`, you can swap just the colors. The main
variables are listed below.

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
| `--hl-keyword` / `--hl-string` / `--hl-number` / `--hl-title` / `--hl-attr` / `--hl-comment` | Syntax highlighting colors (keywords, strings, numbers, function names and the like, attributes and variables, comments). If not set, they're derived from the theme's `--accent` and `--fg` |
| `--alert-note` / `--alert-tip` / `--alert-important` / `--alert-warning` / `--alert-caution` | Color of the box and title of alerts (`> [!NOTE]` and so on) |

> [!TIP]
> This site itself uses `THEME=none` and creates its look only with custom CSS in `STYLE_FILE`.
> See [custom.css](https://github.com/akilasatolu/tsuzuri/blob/docs/.github/tsuzuri/styles/custom.css)
> as an example of how to write it (you can see the result in the
> [custom CSS example](gallery/custom.md)).
>
> To change the custom CSS for some pages only, or not apply it at all, set a different CSS file
> with [`styleFile`](frontmatter.md#stylefile) in that page's frontmatter (v1.5.0 or later). This
> site's theme gallery sets an empty CSS file, so it shows only the built-in themes.

Besides overriding variables, you can also add ordinary CSS rules such as `main h1 { ... }`
directly to `STYLE_FILE` to adjust details. `STYLE_FILE` is loaded after the base CSS and the
theme, so for the same specificity, what you add wins.

## Supporting light and dark

On sites with `NAV_ENABLED=true`, readers can choose light or dark with a button in the
navigation (v1.7.0 or later). The chosen mode is added as `<html data-theme="light">` or
`<html data-theme="dark">` (nothing is added when they haven't chosen, and the OS setting is
followed).

To write dark colors in your custom CSS, write the same colors for both "when the OS is in dark
mode (unless light was chosen)" and "when dark was chosen". The built-in themes are written
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

The older style, with only `:root` inside `@media (prefers-color-scheme: dark)`, doesn't break
the page, but if the OS is in dark mode and the reader chooses "light", those colors stay dark.
