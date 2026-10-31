---
title: Write pages
description: To add a page, link it from your README or from a page on the site. The folders become the navigation.
order: 10
---

# Write pages

To add a page, add one link to it from your README or from a page that is already on the site. That is all it takes: the page becomes part of the site.

## Add a page by linking it

Tsuzuri starts from `README.md` and follows the links. Only the pages and files that can be reached by following links are published, so a Markdown file that nothing links to is not on the site. Images and other files work the same way: the ones you embed or link are copied along. ([How it works](../reference/how-it-works.md) has the details.)

```markdown
See the [guide](docs/guide.md).
```

## Folders and the navigation

The folders of your repository become the navigation and the URLs: `docs/guide.md` is published as `docs/guide.html`, under a "docs" group in the navigation. A `README.md` (or `index.md`) in a folder is the entrance of that folder.

To set the order, write `order` in the frontmatter. Pages with an `order` come first, smallest first; the others follow in the order their links were found. The position of a folder is set by the `order` of the `README.md` in it. A page with `nav: false` is left out of the navigation (it can still be opened from a link).

## Images and files

Write images and files as ordinary Markdown (`![logo](assets/logo.png)`, `[manual](docs/manual.pdf)`). Common image, PDF, video and archive files are copied to the site; other files, such as source code and settings files, become links to the file on GitHub. The full list is in [How it works](../reference/how-it-works.md#which-files-are-copied).

## Headings and the table of contents

The headings of a page make its table of contents when the navigation is on. Every heading gets an id, so you can link to it, as in `[setup](guide.md#setup)`. With `STRICT_LINKS=true`, a link to a heading that does not exist stops the build.

## Frontmatter

A few settings can be written at the top of a page. `title`, `description`, `nav` and `order` are the ones you need most; all the keys are in the [frontmatter reference](../reference/frontmatter.md).

```markdown
---
title: Guide
description: How to use it
order: 20
---
```

## GitHub syntax

Alerts, footnotes, diagrams, task lists and emoji codes work as they do on GitHub. See [Page features](../reference/features.md).

## Read next

- [Change the look](./style.md): pick a style in the gallery.
- [Publish settings](./publish.md): the branch, a custom domain and manual runs.
