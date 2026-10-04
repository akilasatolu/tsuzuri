<div class="tsuzuri-hero" align="center">

<img src="assets/favicon.svg" width="72" height="72" alt="Tsuzuri logo">

# Tsuzuri

<p class="tsuzuri-hero-lead">Bind your README into a website.</p>

<p class="tsuzuri-hero-sub">Starting from your README, Tsuzuri follows the links, turns the connected Markdown into a GitHub Pages site, and publishes it automatically.</p>

<p class="tsuzuri-hero-actions"><a class="tsuzuri-button tsuzuri-button-primary" href="docs/getting-started.md">Get started</a><span class="tsuzuri-sep"> · </span><a class="tsuzuri-button" href="#documentation">Documentation</a><span class="tsuzuri-sep"> · </span><a class="tsuzuri-button" href="https://github.com/akilasatolu/tsuzuri">GitHub</a></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/akilasatolu/tsuzuri/blob/main/LICENSE)
[![Build Status](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/akilasatolu/tsuzuri/actions/workflows/ci.yml)

</div>

## What is Tsuzuri?

Tsuzuri starts from your repository's `README.md`, follows the links in the text, and turns
the connected Markdown files and images into a GitHub Pages site, then deploys it. The name
(綴, *tsuzuri*) is a bookbinding term for binding many sheets of paper into one volume, which
is exactly what the tool does: it binds the Markdown files linked from your README into a
single site.

With a single settings file, you can publish your README and docs folder as a website
almost as they are. As you add pages, just link them from the README and they appear on
the site automatically, so you never have to rebuild the navigation by hand.

**A note on branding**: the colors of the logo (lines running from a flame-orange center to
white pages on a navy background) are Tsuzuri's own branding. They have nothing to do with
the favicon of the pages you generate (the one you set with the `FAVICON_FILE` setting), so
please don't confuse the two.

This documentation is itself generated with Tsuzuri and published on GitHub Pages:
https://akilasatolu.github.io/tsuzuri/

## Features

<div class="tsuzuri-features">
<div class="tsuzuri-feature">
<h3><span class="tsuzuri-sep">【</span><span class="tsuzuri-feature-mark">綴</span><span class="tsuzuri-sep">】</span>Follow the links, get one site</h3>
<p>Pages and images linked from the README are collected automatically. To add a page, just add one link. No sitemap to maintain.</p>
</div>
<div class="tsuzuri-feature">
<h3><span class="tsuzuri-sep">【</span><span class="tsuzuri-feature-mark">設</span><span class="tsuzuri-sep">】</span>Just one settings file</h3>
<p>Change the behavior by editing .github/docs-pages.config. You never need to edit the workflow YAML.</p>
</div>
<div class="tsuzuri-feature">
<h3><span class="tsuzuri-sep">【</span><span class="tsuzuri-feature-mark">彩</span><span class="tsuzuri-sep">】</span>Themes and custom CSS</h3>
<p>Pick one of seven themes such as Material, Glass, Editorial and Minimal, then fine-tune it with your own CSS. This site is built with custom CSS too.</p>
</div>
<div class="tsuzuri-feature">
<h3><span class="tsuzuri-sep">【</span><span class="tsuzuri-feature-mark">探</span><span class="tsuzuri-sep">】</span>Navigation, search and table of contents</h3>
<p>A sidebar, site search and an in-page table of contents are generated for you. OGP, favicons, sitemap.xml and multilingual sites are supported.</p>
</div>
</div>

## Quick start

[Getting Started](docs/getting-started.md) explains each step in detail.

1. Run the following command at the root of your repository (it asks a few questions and
   generates the files).

   ```sh
   npx github:akilasatolu/tsuzuri#v1 init
   ```

   Besides the workflow (`.github/workflows/docs-pages.yml`) and the settings file
   (`.github/docs-pages.config`), this command copies the whole build script
   (under `.github/tsuzuri/`) into your repository. After that, builds and deployments run
   entirely inside your repository, without fetching `akilasatolu/tsuzuri` each time
   (see the [CLI reference](docs/cli.md) for details).

2. In your GitHub repository, open **Settings → Pages** and set Source to **GitHub Actions**
   (first time only).
3. Push or merge to the branch set in `TRIGGER_BRANCH` of `.github/docs-pages.config`
   (the repository's default branch, usually `main`, if left out).

The workflow runs in the Actions tab, and when it finishes the site is published on GitHub
Pages. The URL is shown under Settings → Pages. For each item in the settings file, see the
[configuration reference](docs/configuration.md).

## Documentation

- [Getting Started](docs/getting-started.md)
- [Reference for AI agents](docs/ai-reference.md)
- [Concepts](docs/concepts.md)
- [Configuration reference](docs/configuration.md)
- [Theming](docs/theming.md)
- [Theme gallery](docs/gallery.md)
- [Frontmatter reference](docs/frontmatter.md)
- [Multilingual sites (i18n)](docs/i18n.md)
- [CLI reference](docs/cli.md)
- [Deployment](docs/deployment.md)
- [Examples](docs/examples.md)
- [FAQ](docs/faq.md)
- [Changelog (release notes)](https://github.com/akilasatolu/tsuzuri/releases)

## Customizing the style

You don't have to write CSS to change the look. Just set `THEME` in
`.github/docs-pages.config` to one of the themes, such as Material (`material`, the default),
Glass (`glass`), 90s (`nineties`) or no decoration (`none`), and the colors, link underlines
and the rest of the look switch together. See [Theming](docs/theming.md) for details.

If you only want to fine-tune the colors, override the following CSS custom properties in
the CSS file set in `STYLE_FILE` of `.github/docs-pages.config` (it is loaded after the
theme, as the third layer).

| Variable | Meaning |
|---|---|
| `--fg` | Text color |
| `--bg` | Background color |
| `--border` | Color of table borders and dividers |
| `--accent` | Accent color for links and the like |
| `--code-bg` | Background of code blocks and inline code |
| `--font` | Body font (font-family) |
| `--content-width` | Maximum width of the content column (e.g. `860px`) |
| `color-scheme` | `light` / `dark` / `light dark` (follows the OS setting) |

With `THEME=none`, these variables are not defined anywhere, so the browser's default look
(black text on a white background, and so on) is used as is.

## Theme preview

You can compare the built-in themes as real pages in the [theme gallery](docs/gallery.md).

To compare them on your own site, use the `theme` key in the frontmatter to give each page a
different theme (it swaps the theme of a single page, separately from the site-wide `THEME`
setting; see the [frontmatter reference](docs/frontmatter.md#theme)). Give several Markdown
files different `theme` values and build, and you can compare the looks with the regular
`docs-pages.yml`.

## Contributing

Contributions to both code and documentation are welcome. Tsuzuri itself (the CLI, the build
script and the theme CSS) is developed on the
[`main` branch](https://github.com/akilasatolu/tsuzuri/tree/main). This site (the user
documentation) lives on the `docs` branch and is published to GitHub Pages with Tsuzuri
itself. For setting up a development environment and how to send a PR, see
[CONTRIBUTING.md](https://github.com/akilasatolu/tsuzuri/blob/main/CONTRIBUTING.md).

## License

[MIT License](https://github.com/akilasatolu/tsuzuri/blob/main/LICENSE)
