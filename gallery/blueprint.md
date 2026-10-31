---
title: Blueprint (blueprint)
theme: blueprint.css
description: A sample page of the custom style "Blueprint (blueprint)"
nav: false
---

# Blueprint (blueprint)

Like a blueprint, with a white grid and fine lines on blue, and headings with dimension lines. Always looks the same.

To use it, download `blueprint.css` from the [gallery](README.md#blueprint-blueprint), put it in `.github/tsuzuri/styles/`,
and set `THEME=blueprint.css` in `.github/tsuzuri/config`.
To use it for a single page only, write `theme: blueprint.css` in that page's frontmatter
(see [Change the look](../docs/guides/style.md)).

[← Kintsugi (kintsugi)](kintsugi.md) · [Gallery](README.md) · [90s (nineties) →](nineties.md)

## Heading level 2

A paragraph of text. It includes **bold**, *italic*, ~~strikethrough~~, `inline code`,
[a link within the site](../docs/getting-started.md) and [an external link](https://github.com/akilasatolu/tsuzuri).
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
| `THEME` | `default.css` | The custom style file name |
| `NAV_ENABLED` | `false` | Whether to show the navigation |
| `LANGUAGES` | `en` | The site language (the value of `<html lang>`) |

```js
// A code block
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![The Tsuzuri logo](../assets/favicon.svg)

[← Kintsugi (kintsugi)](kintsugi.md) · [Gallery](README.md) · [90s (nineties) →](nineties.md)
