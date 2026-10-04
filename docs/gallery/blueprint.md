---
title: Blueprint (blueprint)
theme: blueprint
styleFile: .github/tsuzuri/styles/plain.css
description: A sample page of Tsuzuri's built-in theme "Blueprint (blueprint)"
---

# Blueprint (blueprint)

Like a blueprint, with a white grid and fine lines on blue, and headings with dimension lines. Always looks the same.

To use this theme for the whole site, set `THEME=blueprint` in `.github/docs-pages.config`.
To use it for a single page, write `theme: blueprint` in that page's frontmatter
(see [Theming](../theming.md)).

[← Minimal (minimal)](minimal.md) · [Gallery](../gallery.md) · [90s (nineties) →](nineties.md)

## Heading level 2

A paragraph of text. It includes **bold**, *italic*, ~~strikethrough~~, `inline code`,
[a link within the site](../getting-started.md) and [an external link](https://github.com/akilasatolu/tsuzuri).
This is also where you can check the line spacing and readability of longer passages of text.

### Heading level 3

- Bullet item 1
- Bullet item 2
  - Nested item

1. Numbered item 1
2. Numbered item 2

#### Heading level 4

> A blockquote. Use it for quotes from other documents or for supplementary notes.

| Setting | Default | Description |
|---|---|---|
| `THEME` | `material` | The built-in theme name |
| `NAV_ENABLED` | `false` | Whether to show the navigation |
| `LANGUAGES` | `en` | The site language (the value of `<html lang>`) |

```js
// A code block
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![The Tsuzuri logo](../../assets/favicon.svg)

[← Minimal (minimal)](minimal.md) · [Gallery](../gallery.md) · [90s (nineties) →](nineties.md)
