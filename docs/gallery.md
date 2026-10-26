---
title: Gallery
description: A gallery to compare the look of Tsuzuri's custom styles on real pages, and to download them
---

# Gallery

See what Tsuzuri's custom styles look like on actually generated pages, and download the one you like.
Each style has a sample page with the same content (headings, paragraphs, links, lists, a table, code,
a quote and an image), so you can compare them. Use the arrows or dots under a screenshot, or scroll it
sideways, to see the light and dark looks.

## How to use a custom style

A custom style is a CSS file in `.github/tsuzuri/styles/`. The look of a page is the base CSS
(`base.css`) plus one custom style (see [Theming](theming.md)).

1. Download the CSS file with the button under the style you like below.
2. Put it in `.github/tsuzuri/styles/` in your repository.
3. Change `THEME` in `.github/tsuzuri/config` to its file name, for example `THEME=glass.css`.

To use a style for a single page only, write `theme: glass.css` in that page's frontmatter (see the
[frontmatter reference](frontmatter.md#theme)). `default.css` is included in the package, so you can use it
without downloading it: `init` puts it in `.github/tsuzuri/styles/`, and the settings file starts with
`THEME=default.css`. To keep your own copy, download it with the button in the Default section below.
Only `default.css` is overwritten by `init --update` (to edit it, save a copy under another name); the styles
you put there yourself are left as they are.

## Default (default)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/default-light.png" alt="default (light)">
<img src="../assets/gallery/default-dark.png" alt="default (dark)">
</div>

A standard style inspired by Material Design 3 (the default). Blue colors, rounded cards with shadows, and a tinted selection in the navigation. Switches between light and dark automatically.

Included in the package, so you can use it without downloading it. Set `THEME=default.css` (the default). To keep your own copy, download it here.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/default.css" download>Download: default.css</a>

[Sample page](gallery/default.md)

## Glass (glass)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/glass-light.png" alt="glass (light)">
<img src="../assets/gallery/glass-dark.png" alt="glass (dark)">
</div>

Glassmorphism. Thin, clear glass cards that let the colors show through, over a slowly swaying, flowing aurora.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=glass.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/glass.css" download>Download: glass.css</a>

[Sample page](gallery/glass.md)

## Neumorphism (neumorphism)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/neumorphism-light.png" alt="neumorphism (light)">
<img src="../assets/gallery/neumorphism-dark.png" alt="neumorphism (dark)">
</div>

Neumorphism. Parts in the same color as the background, raised or pressed in with light and shadow.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=neumorphism.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/neumorphism.css" download>Download: neumorphism.css</a>

[Sample page](gallery/neumorphism.md)

## Editorial (editorial)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/editorial-light.png" alt="editorial (light)">
<img src="../assets/gallery/editorial-dark.png" alt="editorial (dark)">
</div>

A style that relies on typography and white space, like a magazine or a polished document. Large serif headings with chapter numbers, and a vermilion accent.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=editorial.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/editorial.css" download>Download: editorial.css</a>

[Sample page](gallery/editorial.md)

## Minimal (minimal)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/minimal-light.png" alt="minimal (light)">
<img src="../assets/gallery/minimal-dark.png" alt="minimal (dark)">
</div>

A calm look in only white, black and gray, like the Vercel or Linear docs. Only links are blue.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=minimal.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/minimal.css" download>Download: minimal.css</a>

[Sample page](gallery/minimal.md)

## Kintsugi (kintsugi)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/kintsugi-light.png" alt="kintsugi (light)">
<img src="../assets/gallery/kintsugi-dark.png" alt="kintsugi (dark)">
</div>

A style after kintsugi, the craft of mending broken pottery with lacquer and gold. Gold seams run across porcelain-like cards, and code blocks are lacquer black. Porcelain in light mode, black lacquer in dark mode.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=kintsugi.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/kintsugi.css" download>Download: kintsugi.css</a>

[Sample page](gallery/kintsugi.md)

## Blueprint (blueprint)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/blueprint-light.png" alt="blueprint">
</div>

Like a blueprint, with a white grid and fine lines on blue, and headings with dimension lines. Always looks the same.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=blueprint.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/blueprint.css" download>Download: blueprint.css</a>

[Sample page](gallery/blueprint.md)

## 90s (nineties)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/nineties-light.png" alt="nineties">
</div>

90s nostalgia. A Windows 95-style teal desktop with gray windows and raised buttons. Light only.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=nineties.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/nineties.css" download>Download: nineties.css</a>

[Sample page](gallery/nineties.md)

## No decoration (none)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/none-light.png" alt="none">
</div>

Only the base CSS is applied, and the page is shown with the browser's default look. `none.css` is a CSS file that contains only comments.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=none.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/none.css" download>Download: none.css</a>

[Sample page](gallery/none.md)

## Tsuzuri (this site)

<div class="tsuzuri-carousel">
<img src="../assets/gallery/tsuzuri-light.png" alt="tsuzuri (light)">
<img src="../assets/gallery/tsuzuri-dark.png" alt="tsuzuri (dark)">
</div>

This site's own look, made with a custom style of its own.

Use: put it in `.github/tsuzuri/styles/` and set `THEME=tsuzuri.css`.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/tsuzuri.css" download>Download: tsuzuri.css</a>

[Sample page](gallery/tsuzuri.md)

To fine-tune the colors further, copy `default.css` under another name, override CSS variables (`--fg`, `--bg`, `--accent` and so on) in it, and set it in `THEME` (see [Theming](theming.md#writing-your-own-custom-style)).
