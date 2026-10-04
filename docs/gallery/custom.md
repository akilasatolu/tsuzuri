---
title: Custom CSS example (this site)
description: A sample page of this site's own look, made only with THEME=none and custom CSS (STYLE_FILE)
---

# Custom CSS example (this site)

This look is made without a built-in theme (`THEME=none`), using only custom CSS in `STYLE_FILE`.
The whole site looks like this. It's the "thread" design, which gives shape to the name and logo of
Tsuzuri (綴り, "binding"): a single thread that binds the pages runs to the left of the content,
the h1 starts from a lit dot like the center of the logo, and each h2 is a knot on the thread.
As you read on, the thread turns flame-colored from the top, and the knots light up for the
chapters you've read, so you can tell how far you've got. The navigation is a tree in which pages
are connected by lines.

The CSS is [custom.css](https://github.com/akilasatolu/tsuzuri/blob/docs/.github/tsuzuri/styles/custom.css).
See [Theming](../theming.md#customizing-with-your-own-css) for how to write it.

[← No decoration (none)](none.md) · [Gallery](../gallery.md)

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

[← No decoration (none)](none.md) · [Gallery](../gallery.md)
