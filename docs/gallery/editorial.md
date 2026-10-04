---
title: Editorial (editorial)
theme: editorial
styleFile: .github/tsuzuri/styles/plain.css
description: A sample page of Tsuzuri's built-in theme "Editorial (editorial)"
---

# Editorial (editorial)

A style that relies on typography and white space, like a magazine or a polished document. Large serif headings with chapter numbers, and a vermilion accent.

To use this theme for the whole site, set `THEME=editorial` in `.github/docs-pages.config`.
To use it for a single page, write `theme: editorial` in that page's frontmatter
(see [Theming](../theming.md)).

[← Neumorphism (neumorphism)](neumorphism.md) · [Gallery](../gallery.md) · [Minimal (minimal) →](minimal.md)

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

[← Neumorphism (neumorphism)](neumorphism.md) · [Gallery](../gallery.md) · [Minimal (minimal) →](minimal.md)
