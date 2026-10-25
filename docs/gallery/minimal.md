---
title: Minimal (minimal)
theme: minimal.css
styleFile: plain.css
description: A sample page of the custom style "Minimal (minimal)"
---

# Minimal (minimal)

A calm look in only white, black and gray, like the Vercel or Linear docs. Only links are blue.

To use it, download `minimal.css` from the [gallery](../gallery.md#minimal-minimal), put it in `.github/tsuzuri/styles/`,
and set `THEME=minimal.css` in `.github/tsuzuri/config`.
To use it for a single page only, write `theme: minimal.css` in that page's frontmatter
(see [Theming](../theming.md)).

[← Editorial (editorial)](editorial.md) · [Gallery](../gallery.md) · [Kintsugi (kintsugi) →](kintsugi.md)

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
| `THEME` | `default.css` | The custom style file name |
| `NAV_ENABLED` | `false` | Whether to show the navigation |
| `LANGUAGES` | `en` | The site language (the value of `<html lang>`) |

```js
// A code block
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![The Tsuzuri logo](../../assets/favicon.svg)

[← Editorial (editorial)](editorial.md) · [Gallery](../gallery.md) · [Kintsugi (kintsugi) →](kintsugi.md)
