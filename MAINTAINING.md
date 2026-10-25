# Maintaining Tsuzuri
English | [日本語](MAINTAINING.ja.md)

This document is for people who can push to `main`: how the user documentation (`docs/`) is published, how to review PRs and update dependencies, and how to cut a release. Contributors do not need to read it; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation site

`docs/` (with `README.md`) is the source of the user-facing site, which is built with Tsuzuri itself. Merging to `main` runs `.github/workflows/tsuzuri-pages.yml` and publishes the site to GitHub Pages. User-facing documentation fixes are PRs to `main`, like code changes.

- `.github/tsuzuri/` (the build script, `lib/`, the built-in theme CSS, `package.json`, `package-lock.json` and `.gitignore`) and `tsuzuri-pages.yml` change only through `init --update` at release time (see Releasing). Do not edit them by hand. The one exception is the SHA and version comment of an action: update them by hand in `tsuzuri-pages.yml` together with the other three files, as described in Updating dependencies. `.github/tsuzuri/config` and the custom CSS under `.github/tsuzuri/styles/` (such as `custom.css` and `plain.css`) are this site's own settings, and `init --update` leaves them alone.
- Publishing does not wait for CI. Check the site before merging with the `docs-build` job of CI, which builds the site without deploying it.

## One-time repository setup

Done once when the repository is created.

**Publishing the site.** Set `Source` to `GitHub Actions` in `Settings > Pages` (this creates the `github-pages` environment). If `Settings > Environments > github-pages > Deployment branches and tags` has rules and `main` is not among them, add `main`; otherwise the deploy job fails with `Branch "main" is not allowed to deploy to github-pages due to environment protection rules.`

## Reviewing and merging PRs

- CI must pass (`.github/workflows/ci.yml`).
- If the PR re-saved `test/fixtures/golden/`, read the diff and check that it contains only the intended change. A changed CSS file name (`tsuzuri-<hash>.css`) is expected whenever the CSS changes.
- The PR agrees to the MIT License (see the template checklist).
- `CHANGELOG.md` is **not** written in PRs. You write it at release time, in English and Japanese (see Releasing).

## Updating dependencies

Dependencies and GitHub Actions are updated by hand. There is no fixed schedule: check whenever you like, and always check before a release. Run `npm outdated` to see which ones have updates and `npm audit` to see known vulnerabilities. Packages installed here are also distributed to users through `init`, so a compromised version would reach them. These measures are in place:

- **Only stable versions at least 30 days old** (security fixes are the exception): before updating, check that the version was published 30 or more days ago with `npm view <name> time --json`. Pre-release versions (alpha, beta, rc) are never taken; do not write a version that contains `-` in a dependency.
- **No install scripts**: `ignore-scripts=true` in `.npmrc`, and `npm ci --ignore-scripts` in CI. Generated workflows and `preview` install with `--ignore-scripts` as well.
- **Signature check**: `npm audit signatures` in CI.
- **Check before you merge.** When updating, check the changed versions and their release notes, check that the `package-lock.json` diff adds no unfamiliar dependency, and check that CI is green.

**Build dependencies** (`marked`, `highlight.js`, `marked-footnote`; `BUILD_DEPENDENCIES` in `bin/cli.mjs`) are also installed by users' workflows. Write their versions in `package.json` exactly (for example `12.0.2`), not as ranges, or `scripts/build-lockfiles.mjs` and its test fail. `templates/tsuzuri/package.json` and `package-lock.json` are committed, ready-made copies built from the root lockfile (npm drops the root `package-lock.json` from the package, so `init` copies these). When a PR changes these dependencies or theirs, rebuild them in the same PR, or the test in `test/cli.test.mjs` that compares the committed copies with freshly built ones fails:

1. Create an update branch and update with `npm install <name>@<version>` (add `--save-exact` for the dependencies whose version is pinned).
2. Run `node scripts/build-lockfiles.mjs` (no install needed).
3. Check that the diff in `templates/tsuzuri/` contains only the updated versions and hashes.
4. Commit and push to the update branch.

Updates to dev-only dependencies (ESLint and so on) do not change these files.

**`gemoji`** is a dev-only dependency used to build the emoji shortcode table `.github/scripts/lib/emoji-data.mjs` (committed, never edited by hand; not shipped to users). When `gemoji` is updated, rebuild the table in the same PR, or `test/emoji.test.mjs` fails:

1. Create an update branch, then run `npm install gemoji@<version>` and `npm ci`.
2. Run `node scripts/build-emoji-data.mjs`.
3. Check that the diff of `emoji-data.mjs` contains only emoji additions, changes and removals.
4. Commit and push.

**GitHub Actions.** The workflow that `init` generates comes from `templates/.github/workflows/tsuzuri-pages.yml`. The versions of the same action in `ci.yml` (including the `docs-build` job), `release.yml`, the template and the committed `.github/workflows/tsuzuri-pages.yml` must match or a test fails. To update an action:

1. Find the commit SHA of the new version's tag, for example `git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1*'`. For an annotated tag, use the SHA on the line that ends with `^{}`.
2. Replace the old SHA and version comment with the new ones in all four files.

   ```sh
   sed -i '' 's/<old SHA> # <old version>/<new SHA> # <new version>/' .github/workflows/*.yml templates/.github/workflows/*.yml
   ```

   (`sed -i` without `''` on Linux.) Do not use `node bin/cli.mjs init --update` here: it would also overwrite `.github/tsuzuri/` with the unreleased contents of `main`.
3. Run `npm test`. It compares the four files and fails if they differ.

**mermaid.** The version that generated pages load from the CDN is `MERMAID_VERSION` in `.github/scripts/lib/html-renderer.mjs`. To update it:

1. Set `MERMAID_VERSION` to the new version (only a stable version published at least 30 days ago).
2. Run `node scripts/mermaid-integrity.mjs` and write the printed hash to `MERMAID_INTEGRITY`. Generated pages refuse to run a file that does not match it; the `verify-cdn` job in CI checks the match.

## Releasing

Versions follow [Semantic Versioning](https://semver.org/). Two kinds of tags go on commits of `main`:

- `vX.Y.Z` (for example `v1.0.0`): fixed to that release; never moved.
- `vX` (for example `v1`): points to the latest release of that major version and is moved at every release by `release.yml`. Users run `npx github:akilasatolu/tsuzuri#v1 init` to stay on a compatible version. A release with breaking changes starts a new major (`v2`).

Steps:

1. Check that `npm test` and `npm run lint` pass on `main` and that CI is green.
2. Run `node scripts/check-package.mjs`. It checks the packed package the way users get it; see the comment at the top of the script. This includes that `init --update` keeps the config file (`.github/tsuzuri/config`) and the custom CSS (`.github/tsuzuri/styles/custom.css`).
3. Write `CHANGELOG.md` before tagging. Under `[Unreleased]`, summarize the user-visible changes since the previous tag (the source is the merged PRs and `git log v<previous version>..main`, with the tag of the previous release in place of `v<previous version>`), using the categories described at the top of `CHANGELOG.md`. Rename the heading to `## [X.Y.Z] - YYYY-MM-DD` and add an empty `[Unreleased]` above it. In each release section, write the English block first, then the line `<!-- ja -->`, then the Japanese block with the Japanese category names (see the top of `CHANGELOG.md`). `scripts/release-notes.mjs` fails if the `## [X.Y.Z]` section is missing or empty, if the `<!-- ja -->` line is missing, or if either block is empty, and `release.yml` runs it after you push the tag.
4. Update the target version in `docs/ai-reference.md` and `docs/ai-reference.ja.md` (`v1.36.0` on lines 13 and 19 of the English file and lines 12 and 18 of the Japanese file) to the new version. The same commit as `CHANGELOG.md` is fine. The examples in the body (such as `#v1.36.0`; around lines 74, 78 and 809 of the English file and 70, 73 and 739 of the Japanese file) are only examples, so updating them is optional as long as the version exists.
5. Set `version` to `X.Y.Z` in `package.json` and `package-lock.json` (the top-level `version` and `packages[""].version`; leave dependency versions alone).
6. Commit, push to `main`, then tag and push the tag.

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

7. Pushing the tag starts `.github/workflows/release.yml`. Check the result in the Actions tab. It:
   - checks that the tag matches `version` in `package.json` and that the tagged commit is on `main`,
   - creates the GitHub Release from the matching `CHANGELOG.md` section (`scripts/release-notes.mjs`; the release notes have the English text first, then the Japanese),
   - moves the major tag (`vX`) to this commit.

   Your local `vX` tag stays old; run `git fetch --tags --force` if you need it.
8. Update the generated files of this repository's own site with the new tag. On `main`, run `npx github:akilasatolu/tsuzuri#<new tag> init --update` (`#vX.Y.Z` is the tag you just pushed), commit the changes (`.github/tsuzuri/` and `.github/workflows/tsuzuri-pages.yml`) and push to `main`.
9. After the release (and the `init --update` commit), check on the Actions tab that CI and `tsuzuri-pages` (which runs on every push to `main`) succeed and the site is published correctly.
