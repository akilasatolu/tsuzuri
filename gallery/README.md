---
title: Gallery
description: A gallery to compare the look of Tsuzuri's custom styles on real pages, and to download them
order: 10
---

# Gallery

See what Tsuzuri's custom styles look like on actually generated pages, and download the one you like.
Click a tile to open a sample page with the same content for every style (headings, paragraphs, links, lists,
a table, code, a quote and an image), so you can compare them. Use the arrows or dots under a screenshot to see
the light and dark looks, and the button on a tile to download its CSS file.

## How to use a custom style

1. Download the CSS file with the button on the tile of the style you like.
2. Put it in `.github/tsuzuri/styles/` in your repository.
3. Change `THEME` in `.github/tsuzuri/config` to its file name, for example `THEME=glass.css`.

`default.css` is included in the package, so you can use it without downloading it (`init` puts it in
`.github/tsuzuri/styles/`). To use a style for a single page only, write `theme: glass.css` in that page's frontmatter
(see the [frontmatter reference](../docs/reference/frontmatter.md#theme) and [Change the look](../docs/guides/style.md)). To fine-tune the colors further, copy
`default.css` under another name, override CSS variables (`--fg`, `--bg`, `--accent` and so on) in it, and set it in `THEME`
(see [Change the look](../docs/guides/style.md#writing-your-own-custom-style)).

## Tsuzuri styles

<div class="tsuzuri-tiles">

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/default-light.png" alt="default (light)">
<img src="../assets/gallery/default-dark.png" alt="default (dark)">
</div>

### [Default (default)](default.md)

A standard style inspired by Material Design 3 (the default). Blue colors, rounded cards with shadows, and a tinted selection in the navigation. Switches between light and dark automatically.

Included in the package, so you can use it without downloading it. The button gives you a copy.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/default.css" download>Download: default.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/glass-light.png" alt="glass (light)">
<img src="../assets/gallery/glass-dark.png" alt="glass (dark)">
</div>

### [Glass (glass)](glass.md)

Glassmorphism. Thin, clear glass cards that let the colors show through, over a slowly swaying, flowing aurora.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/glass.css" download>Download: glass.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/neumorphism-light.png" alt="neumorphism (light)">
<img src="../assets/gallery/neumorphism-dark.png" alt="neumorphism (dark)">
</div>

### [Neumorphism (neumorphism)](neumorphism.md)

Neumorphism. Parts in the same color as the background, raised or pressed in with light and shadow.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/neumorphism.css" download>Download: neumorphism.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/editorial-light.png" alt="editorial (light)">
<img src="../assets/gallery/editorial-dark.png" alt="editorial (dark)">
</div>

### [Editorial (editorial)](editorial.md)

A style that relies on typography and white space, like a magazine or a polished document. Large serif headings with chapter numbers, and a vermilion accent.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/editorial.css" download>Download: editorial.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/minimal-light.png" alt="minimal (light)">
<img src="../assets/gallery/minimal-dark.png" alt="minimal (dark)">
</div>

### [Minimal (minimal)](minimal.md)

A calm look in only white, black and gray, like the Vercel or Linear docs. Only links are blue.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/minimal.css" download>Download: minimal.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/kintsugi-light.png" alt="kintsugi (light)">
<img src="../assets/gallery/kintsugi-dark.png" alt="kintsugi (dark)">
</div>

### [Kintsugi (kintsugi)](kintsugi.md)

A style after kintsugi, the craft of mending broken pottery with lacquer and gold. Gold seams run across porcelain-like cards, and code blocks are lacquer black. Porcelain in light mode, black lacquer in dark mode.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/kintsugi.css" download>Download: kintsugi.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/blueprint-light.png" alt="blueprint">
</div>

### [Blueprint (blueprint)](blueprint.md)

Like a blueprint, with a white grid and fine lines on blue, and headings with dimension lines. Always looks the same.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/blueprint.css" download>Download: blueprint.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/nineties-light.png" alt="nineties">
</div>

### [90s (nineties)](nineties.md)

90s nostalgia. A Windows 95-style teal desktop with gray windows and raised buttons. Light only.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/nineties.css" download>Download: nineties.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/none-light.png" alt="none">
</div>

### [No decoration (none)](none.md)

Only the base CSS is applied, and the page is shown with the browser's default look. `none.css` is a CSS file that contains only comments.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/none.css" download>Download: none.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/tsuzuri-light.png" alt="tsuzuri (light)">
<img src="../assets/gallery/tsuzuri-dark.png" alt="tsuzuri (dark)">
</div>

### [Tsuzuri (this site)](tsuzuri.md)

This site's own look, made with a custom style of its own.

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/tsuzuri.css" download>Download: tsuzuri.css</a>

</div>

</div>

## Styles from users

There are no styles from users yet. To have your style listed here, see [Contribute & contact](../docs/contact.md).
