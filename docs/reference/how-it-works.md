---
title: How it works
description: How the build follows the links from your README and turns the pages into a static site
order: 40
---

# How it works

This page explains how a multi-page site is built from a single README.

## Crawling from the README (BFS)

The build starts from `ROOT_MD` (`README.md` by default) and collects pages by following the
links in the Markdown, using a method called BFS (breadth-first search).

```
README.md ──> docs/getting-started.md ──> docs/configuration.md
       └────> docs/faq.md
```

The key point is that **only files reachable by following links** are included in the site.
Even if a Markdown file is in the repository, it isn't written to the build output (`_site/`)
unless some page reachable from README.md links to it. Put the other way around, to add a new
page, just link it from an existing page and it becomes part of the site.
The same goes for images (`.png`, `.jpg`, `.svg` and so on) and other files such as PDFs and
zips: only those linked or embedded from Markdown are collected, and they are copied with the
same folder structure.
However, files starting with `.` (such as `.env`) other than Markdown and images, and files
inside folders starting with `.` (such as `.github/`) other than Markdown, images, video, audio
and PDFs (settings files, for example), are never copied, so they aren't published by mistake
(they become links to the file on GitHub; see the table below).

### Which files are copied

Among the linked files, the ones with the following extensions are copied (the extension is
compared ignoring case, so `A.PDF` is copied too, and `app.tar.gz` is matched by `gz`; v1.32.0
or later. Before that, every file with an extension was copied; `css` is copied from v1.38.0 or later).

| Kind | Extensions |
|---|---|
| Images | `png` `jpg` `jpeg` `gif` `svg` `webp` `bmp` `ico` `avif` `apng` `tif` `tiff` `heic` `heif` `jxl` |
| Documents | `pdf` `doc` `docx` `xls` `xlsx` `ppt` `pptx` `odt` `ods` `odp` `epub` `html` `htm` |
| Archives | `zip` `tar` `gz` `tgz` `bz2` `xz` `7z` |
| Video | `mp4` `webm` `mov` `m4v` `ogv` `avi` `mkv` |
| Audio | `mp3` `m4a` `wav` `ogg` `oga` `flac` `aac` `opus` `weba` |
| Stylesheets | `css` |

The idea is that files you open with an app or a browser are copied, while files whose contents
you read as text (source code, settings files, `.txt`, `.csv` and so on) and files with any
other extension become links to the file on GitHub. The exception is `css`: a CSS file is copied
so that it can be downloaded (this is how the [gallery](../../gallery/README.md) offers custom styles). This keeps a kind of file Tsuzuri doesn't
know from being published unintentionally. Inside folders starting with `.`, only the PDF, video,
audio and stylesheet (`css`) entries above (and images) are copied. So a CSS file in `.github/` (for
example `.github/tsuzuri/styles/glass.css`) is copied too, and appears in the site under `_.github/`.

A linked `.html` or `.htm` file is copied as it is, without changing its contents. A page that
is complete in a single file (styles and scripts written inside it) is shown as it is. The other
files the HTML loads (CSS, JavaScript, images) are not followed, so they aren't copied along with
it, and the page doesn't appear in the navigation, the search or `sitemap.xml`.

A link to GitHub only opens for visitors who can view the repository. In a private repository,
for example, visitors without access can't open it, so for files you want them to see, use a
copied format or write the contents on the page.

Pages and images in folders starting with `.`, such as `.github/`, are written to a path with
a leading `_`, like `_.github/` (e.g. `.github/logo.png` → `_.github/logo.png`; v1.4.0 or
later). This is because the artifact uploaded to GitHub Pages can't contain files or folders
starting with `.`. Links are rewritten to this path automatically. Video (`.mp4`, `.webm` and
so on), audio (`.mp3` and so on) and PDFs are written the same way (v1.5.0 or later; in v1.4.0
they become links to the file on GitHub).

If the output path of a linked file collides with a generated page or a file Tsuzuri creates
(`index.html`, `404.html` and so on), the file is not copied, so the generated
one isn't overwritten, and a warning is shown (with `STRICT_LINKS=true` the build fails;
v1.4.0 or later).

Links to paths without an extension, to paths starting with `.`, or to files whose extension
isn't in the table above are handled as follows, depending on what actually exists in the
repository.

| Link target | Link in the generated site |
|---|---|
| A folder containing `README.md` or `index.md` (`[Guide](../guide)`, `[Guide](../guide)`) | The page for that folder on the site (`…/guide/`) |
| A file that isn't published on the site (`LICENSE`, `.env.example` and so on) | That file on GitHub (`https://github.com/<owner>/<repo>/blob/<commit>/LICENSE`) |
| A file whose extension isn't in the copied list (`src/foo.js`, `package.json`, `notes.txt`) | That file on GitHub (`…/blob/<commit>/src/foo.js`). A line range such as `#L10-L20` is kept |
| A folder with neither `README.md` nor `index.md` (`[Source](../src)`) | The listing of that folder on GitHub |
| Something that doesn't exist | Left as is (treated as a broken link; with `STRICT_LINKS=true` the build fails) |

When building on GitHub Actions, the URL for links to GitHub is known automatically. When
building locally, it's made from git's `origin` (the GitHub repository) and the current branch
name (links to files you haven't pushed yet won't open on GitHub). If neither is known, a
warning is shown and the link keeps the path within the site (it won't open, since the file
isn't on the site, but the target exists, so it isn't treated as a broken link). This includes
files such as `.js` that used to be copied: with a host other than GitHub, for example, they
no longer open.

### Embedding files that aren't copied

Linking and embedding are treated differently. If an image, video or audio embedded with
`![](../…)`, `<img src>`, `srcset`, `<video src>`, `<audio src>` or `<source src>` points to a file
that exists but isn't copied (an extension that isn't in the table, or a folder without
`README.md` or `index.md`), the `src` becomes a link to GitHub, so it can't be shown or played.
At the end of the build, a warning like "The embedded target X is a file of a type that is not
copied, so it cannot be displayed or played (referenced from Y)" is printed (for a folder, "is a
folder"; a build script copied by v1.36.0 or earlier prints it in Japanese, as `埋め込みの先 X は…のため、表示・再生できません (referenced from Y)`). With `STRICT_LINKS=true` this counts as a link problem and the build fails, so an
update can stop a build that used to pass. To fix it, change the file to a format in the table
or, if you don't need to embed it, turn the embed into a plain link. Plain links such as
`[x](../clip.xyz)` and `<a href>` don't produce this warning.

Linking to the same file from several places doesn't process it twice, and pages that link to
each other in a cycle, like A→B→A, don't cause an infinite loop (a file already visited is not
visited again).

## Markdown → HTML conversion

Each collected `.md` file is converted to HTML and written under `_site/` with the same folder
structure and a `.html` extension (e.g. `docs/faq.md` → `docs/faq.html`). Links to other pages
in the Markdown (written like `[FAQ](../docs/faq.md)`) are rewritten to point to the `.html`
files automatically. You don't need to rewrite any links yourself.

When Japanese text is wrapped in the middle of a sentence (still the same paragraph in
Markdown), line breaks between two full-width characters (kanji, kana and full-width
punctuation) are removed in the output, so no stray spaces appear.

### Folder URLs (README.md → index.html)

`ROOT_MD` is also written as the top page of the site (`index.html`). In the same way, a
`README.md` in a subfolder is also written as that folder's `index.html` (e.g.
`guide/README.md` → `guide/README.html` and `guide/index.html`). This lets the page open at a
folder URL like `https://…/guide/`. If the same folder has an `index.md`, that one becomes
`index.html`.

When Markdown links to a folder, like `[Guide](../guide)`, the link keeps the trailing `/` and
points to `…/guide/`, and that folder's `README.md` (or `index.md` if there's no README) is
included in the site. A link to a folder with neither becomes a link to the folder listing on
GitHub (see the table above).

### Links to headings

Each heading gets an `id` using the same rules as when GitHub displays a README. So links to a
heading within a page that work on GitHub, such as `[details](../docs/frontmatter.md#theme)`, also
work on the generated site.

- The `id` is the heading text lowercased, with punctuation removed and spaces replaced by `-`
  (e.g. `## Getting Started` → `getting-started`, `## テーマ・スタイル(Theming)` →
  `テーマスタイルtheming`). Non-ASCII letters such as Japanese are kept as they are.
- If the same heading appears more than once on a page, the second and later ones get `-1`,
  `-2` and so on.

If the target page doesn't have that heading (the heading was renamed, misspelled and so on),
the build log shows it as "Links whose target page has no such heading: N" (up to v1.36.0, in Japanese:
`リンク先のページに見出しが見つからないリンク: N 件`). With
`STRICT_LINKS=true` the build fails (v1.5.0 or later).

## Absolute paths and BASE_PATH

All links and image paths in the generated HTML are unified as "absolute paths from the root of
the site". This is done by prefixing them with a value called `BASE_PATH`.

`BASE_PATH` is computed automatically depending on the kind of site (it's not something you
set; it's computed in the build job of the workflow (`tsuzuri-pages.yml`) and passed to
`build-docs.mjs` as an environment variable on GitHub Actions).

- **User or organization sites** (repositories named `<owner>.github.io`), or when using a
  custom domain: `BASE_PATH` is empty and the site is placed right under the domain.
- **Project sites** (any other ordinary repository name): `BASE_PATH` is `/<repository name>`
  (the repository name becomes part of the URL, as in `https://<owner>.github.io/<repo>/`).

Thanks to these unified absolute paths, broken links from miscalculated relative paths are
unlikely, however deep a page is in the folder structure.

## External links and anchors

The following links are not treated as "pages within the site" and are not crawled (they are
written as they are, without rewriting).

- External links with a scheme, such as `http://`, `https://` and `mailto:`
- Protocol-relative URLs such as `//example.com/...`
- Links that are only an anchor within the same page, such as `#heading-name`

## Broken links and path traversal

If the target file doesn't actually exist (a broken link), the build doesn't stop with an
error. It records the link as `missing` and continues.

Links that try to reach files outside the repository, such as `../../../etc/passwd` (path
traversal), and broken links that fail URL decoding are never followed, for safety, and are
recorded as `rejected`. This is a security defense, and unlike external links or anchor-only
links, they're recorded separately so you can tell they were "deliberately refused".

In either case the build itself doesn't fail, and the valid pages are still generated (only
with `STRICT_LINKS=true` does the build fail to stop publishing; see the
[configuration reference](./configuration.md#strict_links)).

## The 404 page

A `404.html`, shown when someone visits a URL that doesn't exist, is generated too. If you put
a `404.md` at the root of the repository, its contents are used (images used in it are copied
too; this site's 404 page is also made with `404.md`). Otherwise the default content is used
("Page not found" and a link to the top page, in Japanese if the page language is Japanese and
in English otherwise; on a [multilingual site](../guides/multilingual.md), a notice for each language that has
a top page, with links to each top page, where only the notice in the URL's language is shown;
see [Multilingual sites](../guides/multilingual.md#the-404-page)). It's shown with the same navigation and custom style as the
other pages, and isn't indexed by search engines (`noindex`).

## sitemap.xml and robots.txt (for search engines)

When building on GitHub Actions (when the site URL is known), a `sitemap.xml` for search
engines is also written (with `LAST_UPDATED=true`, each page's last update date is included as
`<lastmod>`). It lists the URLs of all pages on the site (except pages with `noindex: true` in
the frontmatter), so you can submit it to Google Search Console and similar tools.

When the site is right under the domain (a repository named `<owner>.github.io`, or when
`CUSTOM_DOMAIN` is set), a `robots.txt` pointing to `sitemap.xml` is written too (`robots.txt`
can only live right under the domain, so it isn't written for a site like
`https://<owner>.github.io/<repo>/`).

Each page also gets a `<link rel="canonical">` and an `og:url` showing its canonical URL. For
the top page and a folder's `README.md`, the canonical URL is the top URL or the folder URL
(`…/guide/`), not `README.html`.

## llms.txt

When building on GitHub Actions (when the site URL is known), a `llms.txt` is also written
(v1.34.0 or later). It is a list of the pages of the site in the form proposed at
[llmstxt.org](https://llmstxt.org/), and it is on by default (`LLMS_TXT`, see the
[configuration reference](./configuration.md#llms_txt)). It's written right under the site: for
`https://<owner>.github.io/<repo>/` it is `https://<owner>.github.io/<repo>/llms.txt`.

```markdown
# Site name

> Description of the starting page

## Docs

- [Page title](https://owner.github.io/repo/page.html): Description of the page
- [Another page](https://owner.github.io/repo/other.html)

## Optional

- [Page not in the navigation](https://owner.github.io/repo/hidden.html): Description
- [日本語](https://owner.github.io/repo/ja/)
```

- The first line is the site name (`SITE_NAME`; if empty, the title of the starting page), and the
  quoted line is the description of the starting page (left out if it has none).
- `## Docs` lists the pages in the site's base language, in the same order as the navigation
  (also with `NAV_ENABLED=false`), with the starting page first. Each line is the title, the URL
  and the description; if a page has no description, the part after the URL is left out.
- `## Optional` lists the pages with `nav: false`, then, on a [multilingual site](../guides/multilingual.md), a
  link to the top page of each of the other languages (named by the language's name, without a
  description). A section with nothing to list is left out, heading included.
- The title and the description are the same as the page's `<title>` and
  `<meta name="description">`. If you write `title` and `description` in the
  [frontmatter](./frontmatter.md), they are used; if not, they are made from the first heading
  and the first paragraph, and a long description is cut off in the middle.
- Pages with `noindex: true`, the 404 page, and the pages in the other languages aren't listed.
  Even on a multilingual site there is one `llms.txt`.
- A run of whitespace and control characters (line breaks, tabs and so on) in a title or
  description becomes one space. `\`, `[`, `]`, the backtick and `<` get a `\` in front of them.
  A title is cut at 200 characters and a description at 300, and `(` and `)` in a URL become `%28`
  and `%29`.
- Only the HTML pages are linked. Markdown versions of the pages and a file with the full text
  aren't generated.

To use a `llms.txt` you wrote yourself, put it right under the repository (no link to it is
needed). It's copied to the site as it is, and none is generated (this works without the site URL
too). A symbolic link, or something that isn't a regular file (a folder, for example), isn't
used: a warning is shown, and it's neither copied nor generated (so that a link can't publish
another file in the repository). With `LLMS_TXT=false`, nothing is output or copied.
