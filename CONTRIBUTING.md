# Contributing to Tsuzuri
English | [日本語](CONTRIBUTING.ja.md)

Thank you for your interest in Tsuzuri. This guide covers everything up to opening a pull request. Releases and other maintainer tasks are in [MAINTAINING.md](MAINTAINING.md). Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Which branch?

Send pull requests to `main`. It holds both the code (`bin/`, `.github/scripts/`, `styles/` and so on) and the user documentation (`docs/`).

To get your own site listed on the examples page of the user site, open an issue with the URL of the site and the URL of its source. If it is accepted, a maintainer adds it to `docs/examples.md` and `docs/examples.ja.md`.

## Setting up

You need Node.js 20 or later.

```sh
npm ci
```

Use `npm ci` rather than `npm install`: it installs exactly the versions recorded in `package-lock.json`.

## Trying your changes

You do not need to push. Run your working tree directly. The examples assume you cloned this repository to `~/dev/tsuzuri` and ran `npm ci`.

**Build a site.** In a directory that has Markdown files (the root of this clone works well: it has `README.md` and `docs/`):

```sh
STYLE_DIR=~/dev/tsuzuri/styles node ~/dev/tsuzuri/.github/scripts/build-docs.mjs
```

- `STYLE_DIR` makes the build use the theme CSS from your working tree.
- Outside GitHub Actions, `.github/tsuzuri/config` is read if present, and environment variables win (for example `THEME=nineties`). The site language comes from `LANGUAGES`, not from the OS `LANG`.
- The output goes to `_site/`. If it contains the `.tsuzuri-build` marker from a previous build, everything in it is deleted before the build; a directory without the marker is only overwritten.

In a directory where `init` has already run, `node ~/dev/tsuzuri/bin/cli.mjs preview` builds, serves and rebuilds on changes.

**View it.** Links are absolute from the site root, so opening `_site/index.html` as a file breaks them. Serve it instead, and do not set `BASE_PATH`:

```sh
python3 -m http.server --directory _site 8000
```

**Try `init`.** Run the CLI of your working tree in an empty directory (`init --update` works the same way):

```sh
mkdir /tmp/tsuzuri-init-test && cd /tmp/tsuzuri-init-test
node ~/dev/tsuzuri/bin/cli.mjs
```

To build with the generated `.github/tsuzuri/`, first run the `npm install --prefix .github/tsuzuri ...` line from the generated workflow's "Install build dependency" step, then `node .github/tsuzuri/build-docs.mjs`.

**Try it on GitHub.** Push your branch and run `init` from it in a separate test repository, then check that it publishes to GitHub Pages:

```sh
npx github:akilasatolu/tsuzuri#<your-branch> init
```

## Tests and lint

```sh
npm test
npm run lint
```

`npm test` runs `node --test`, which runs every test under `test/`. `npm run lint` runs ESLint. Both must pass before you open a PR.

### Golden tests

`test/golden.test.mjs` builds sites with several configurations, keeps the complete output (HTML, CSS, scripts, and so on) in `test/fixtures/golden/`, and compares it character by character with what the current code produces. It exists to catch output that changes **unintentionally**.

When you change the output **on purpose** (a new feature, a visual or wording change), this test fails. Save the output again:

1. Save it again.

   ```sh
   UPDATE_GOLDEN=1 node --test test/golden.test.mjs
   ```

2. Check `git diff test/fixtures/golden/` and make sure it contains only the change you intended (only CSS for a style change, only the wording for a text change). When the CSS changes, its file name (`tsuzuri-<hash>.css`) changes too, so the `<link>` lines of every page change; that is expected.
3. Include the saved `test/fixtures/golden/` in the same PR as the code change, and explain in the PR why you saved it again and what changed.

Never save it again just to make the test pass. That hides unintended changes.

## Repository layout

Edit these:

- `bin/`: the setup CLI. `bin/cli.mjs` is the single source of what users receive (workflow, config file, vendored files); `bin/preview.mjs` is `preview`.
- `templates/`: the workflow template (`.github/workflows/tsuzuri-pages.yml`) and the ready-made `package.json` and `package-lock.json` of the build dependencies given to users.
- `.github/scripts/`: the build (`build-docs.mjs` and `lib/`).
- `styles/`: the theme CSS.
- `test/`: the tests, with fixtures in `test/fixtures/`.
- `scripts/`: development and CI helpers, not shipped to users. Each script starts with a comment that explains it.
- `.github/workflows/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.npmrc`: this repository's own CI, release, dependency policy and PR template.
- `CONTRIBUTING.md`, `MAINTAINING.md`, `CHANGELOG.md`: documentation for developers.

The user documentation is in `docs/` and `README.md` (the top page of the user site). Edit them on `main` like code; `.github/workflows/tsuzuri-pages.yml` publishes them.

`init` copies `.github/scripts/` and `styles/` as they are into the user's repository, so anything you put there is shipped to users.

`init` also generates `.github/workflows/tsuzuri-pages.yml` and `.github/tsuzuri/` (which includes the settings file `config`) in the **user's** repository. This repository commits them too, because it publishes its own site that way. Do not edit the workflow and the build files by hand; they change only through `init --update` at release time (see [MAINTAINING.md](MAINTAINING.md)), except the SHA and version comment of an action, which are updated by hand in `tsuzuri-pages.yml` together with the other workflow files (see "Updating dependencies" in MAINTAINING.md). `test/cli.test.mjs` tests the generation and `test/build-docs.e2e.test.mjs` tests the build.

Known limitations that users see (the frontmatter format, the mermaid CDN) are documented on the user site, not here: [Frontmatter limitations](https://akilasatolu.github.io/tsuzuri/docs/frontmatter.html#limitations), [Externally loaded files](https://akilasatolu.github.io/tsuzuri/docs/concepts.html#externally-loaded-files-and-dependency-safety).

## What CI does

`.github/workflows/ci.yml` runs on every PR and on pushes to `main`. It only reads the repository (`contents: read`) and never touches GitHub Pages, so pushing a branch is safe.

- `lint-and-test`: `npm run lint` and `npm test` on Node.js 20, 22 and 24, plus a signature check of the dependencies.
- `actionlint`: static checks of the workflows, including the workflow `init` generates.
- `verify-cdn`: checks the hash of the mermaid file that generated pages load.
- `package-check`: runs `init`, install, build and `init --update` from the packed package (`scripts/check-package.mjs`).
- `docs-build`: builds the user-facing site (`README.md` and `docs/`) the same way `tsuzuri-pages.yml` does, but does not deploy it. Broken links fail the job.

Releasing is done by maintainers; see [MAINTAINING.md](MAINTAINING.md).

## Opening a pull request

- Keep it small. Do not mix several concerns in one PR.
- Make sure `npm test` and `npm run lint` pass.
- Describe what you changed and why. If you change existing behavior, give the reason and what it affects.
- If you saved `test/fixtures/golden/` again, say why and what changed in the diff (see [Golden tests](#golden-tests)).
- You do not need to write `CHANGELOG.md`. The maintainers write it when they release.
- Do not change dependency versions in a PR. Open an issue first if you think one needs updating; the maintainers update them (see [MAINTAINING.md](MAINTAINING.md)).
- Tsuzuri is released under the MIT License. **By opening a PR you agree to provide your change under the MIT License.**
