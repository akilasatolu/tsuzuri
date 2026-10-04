---
title: Theme gallery
description: A gallery to compare the look of Tsuzuri's built-in themes on real pages
---

# Theme gallery

See what Tsuzuri's built-in themes look like on actually generated pages. Each page has the same
sample content (headings, paragraphs, links, lists, a table, code, a quote and an image), so you
can compare them and choose a theme.

| Theme | Setting | Character |
|---|---|---|
| [Material (material)](gallery/material.md) | `THEME=material` | A standard style inspired by Material Design 3 (the default). Blue colors, rounded cards with shadows, and a tinted selection in the navigation. Switches between light and dark automatically. |
| [Glass (glass)](gallery/glass.md) | `THEME=glass` | Glassmorphism. Thin, clear glass cards that let the colors show through, over a slowly swaying, flowing aurora. |
| [Neumorphism (neumorphism)](gallery/neumorphism.md) | `THEME=neumorphism` | Neumorphism. Parts in the same color as the background, raised or pressed in with light and shadow. |
| [Editorial (editorial)](gallery/editorial.md) | `THEME=editorial` | A style that relies on typography and white space, like a magazine or a polished document. Large serif headings with chapter numbers, and a vermilion accent. |
| [Minimal (minimal)](gallery/minimal.md) | `THEME=minimal` | A calm look in only white, black and gray, like the Vercel or Linear docs. Only links are blue. |
| [Blueprint (blueprint)](gallery/blueprint.md) | `THEME=blueprint` | Like a blueprint, with a white grid and fine lines on blue, and headings with dimension lines. Always looks the same. |
| [90s (nineties)](gallery/nineties.md) | `THEME=nineties` | 90s nostalgia. A Windows 95-style teal desktop with gray windows and raised buttons. Light only. |
| [No decoration (none)](gallery/none.md) | `THEME=none` | No theme layer; only the base CSS and the browser's default look. |
| [Custom CSS example (this site)](gallery/custom.md) | `THEME=none` + `STYLE_FILE` | This site's own look, made only with custom CSS and no theme. |

This whole site is built with `THEME=none` and custom CSS (`STYLE_FILE`). Each theme page sets its
theme with `theme` in the frontmatter, and sets an empty CSS file with `styleFile` so the site's
custom CSS isn't applied (it shows only the built-in theme).

```yaml
---
theme: material
styleFile: .github/tsuzuri/styles/plain.css
---
```

For how to set it up, see [Theming](theming.md) and the
[frontmatter reference](frontmatter.md#theme).

To fine-tune the colors further, override CSS variables (`--fg`, `--bg`, `--accent` and so on) in
the custom CSS set in `STYLE_FILE`.
