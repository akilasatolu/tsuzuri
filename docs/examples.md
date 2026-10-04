---
title: Examples
---

# Examples

## Sites built with Tsuzuri

### This site

The documentation site you're reading is built with Tsuzuri itself
([source](https://github.com/akilasatolu/tsuzuri/tree/docs)). It combines the following features.

- **A look made only with custom CSS**: it uses `THEME=none` and builds the colors, cards and
  buttons with custom CSS in `STYLE_FILE` ([custom CSS example](gallery/custom.md)).
- **The top page entrance**: the beginning of `README.md` contains HTML with classes, such as
  `<div class="tsuzuri-hero">`, styled with custom CSS. On GitHub the classes are dropped and it
  shows as ordinary text, so it still reads fine on GitHub.
- **Theme gallery**: each theme sample page sets `theme` (the page's theme) and `styleFile` (an
  empty CSS file) in the frontmatter, so it shows only the built-in theme
  ([theme gallery](gallery.md)).
- **404 page**: made with `404.md` at the root of the repository.
- **English and Japanese**: it's a [multilingual site](i18n.md) with `LANGUAGES=en,ja`. The
  English pages are the base, and each Japanese page sits next to it as `*.ja.md`.
- **No broken links published**: `STRICT_LINKS=true` makes the build fail on broken links or
  links to missing headings.

We're looking for more examples. If you'd like your site listed, see "Contributions welcome"
below.

## A documentation site

A setup that turns the repository's `README.md` and `docs/` folder into a documentation site as
they are.

```
README.md                 … the top page (links to each page in docs/)
docs/getting-started.md   … order: 1
docs/guide.md             … order: 2
docs/reference/README.md  … order: 3 (this order also decides the folder's position)
docs/reference/api.md
docs/faq.md               … no order (listed after the pages with an order)
```

```
NAV_ENABLED=true
SITE_NAME=My Project
STRICT_LINKS=true
LAST_UPDATED=true
```

- The navigation is in the order the links were found. To use an order different from the links
  in the README, set `order` in the frontmatter
  ([frontmatter reference](frontmatter.md#order)).
- Checking with `npx github:akilasatolu/tsuzuri#v1 preview --open` before pushing updates the
  browser every time you save ([CLI reference](cli.md#previewing-locally-preview)).

## Using it as a company page

Tsuzuri was originally made to "turn a README into GitHub Pages as it is", but by combining
settings you can also use it for a simple company or product page that starts from the README.
For example, you could combine the following.

- Set a Markdown file for the top page in `ROOT_MD`, and link from it to pages such as the
  company profile, the services and how to contact you
- Set `NAV_ENABLED=true` to show simple navigation between the pages
- Set `title`, `description` and `ogImage` in each page's frontmatter to control how it looks
  when shared on social media (OGP) (see the [frontmatter reference](./frontmatter.md); pages
  without a `description` get one made from the first paragraph)
- Set your brand's favicon with `FAVICON_FILE` and assign your own domain with `CUSTOM_DOMAIN`
  (see the [configuration reference](./configuration.md) and [Deployment](./deployment.md))
- Change `THEME` to one close to your brand colors, such as `material` or `glass`. To go
  further, build the look with `THEME=none` and custom CSS, like this site (see
  [Theming](./theming.md))
- Set `nav: false` on pages not worth listing in the navigation, such as past news posts

This way, you can prepare a reasonably polished set of pages with just Markdown files and a
settings file, without any extra build tools or CMS.

## Contributions welcome

If you'd like a site you built to be listed among the examples on this page, please get in
touch. For how to submit it, and how to contribute to the project in general, see
[CONTRIBUTING.md](https://github.com/akilasatolu/tsuzuri/blob/main/CONTRIBUTING.md).
