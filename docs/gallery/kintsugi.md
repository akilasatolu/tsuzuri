---
title: Kintsugi (kintsugi)
theme: kintsugi
styleFile: plain.css
description: A sample page of Tsuzuri's built-in theme "Kintsugi (kintsugi)"
---

# Kintsugi (kintsugi)

A style after kintsugi, the craft of mending broken pottery with lacquer and gold. Gold seams run across porcelain-like cards, and code blocks are lacquer black. Porcelain in light mode, black lacquer in dark mode.

To use this theme for the whole site, set `THEME=kintsugi` in `.github/tsuzuri/config`.
To use it for a single page, write `theme: kintsugi` in that page's frontmatter
(see [Theming](../theming.md)).

[← Minimal (minimal)](minimal.md) · [Gallery](../gallery.md) · [Blueprint (blueprint) →](blueprint.md)

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

[← Minimal (minimal)](minimal.md) · [Gallery](../gallery.md) · [Blueprint (blueprint) →](blueprint.md)
