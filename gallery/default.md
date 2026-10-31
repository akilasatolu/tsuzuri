---
title: Default (default)
theme: default.css
description: A sample page of the custom style "Default (default)"
nav: false
---

# Default (default)

Inspired by Material Design 3. Blue colors, rounded cards with shadows, and a tinted selection in the navigation.

`default.css` is included in the package, so you don't need to download it: `init` puts it in
`.github/tsuzuri/styles/`, and `THEME=default.css` is written in `.github/tsuzuri/config` from the start.
To use it for a single page only, write `theme: default.css` in that page's frontmatter
(see [Change the look](../docs/guides/style.md)).

[Gallery](README.md) · [Glass (glass) →](glass.md)

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

[Gallery](README.md) · [Glass (glass) →](glass.md)
