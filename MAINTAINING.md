# Maintaining Tsuzuri
English | [日本語](MAINTAINING.ja.md)

This document is for people who can push to `main`: how the `docs` branch is kept in sync, how to review PRs and update dependencies, and how to cut a release. Contributors do not need to read it; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Branches and docs sync

`main` (Tsuzuri itself) and `docs` (the user-facing site) are independent branches with no shared history. **Never merge one into the other.**

Every time CI succeeds on a push to `main`, `.github/workflows/sync-docs.yml` runs `init --update` with that commit's Tsuzuri on the `docs` branch and pushes the result if anything changed. That push triggers `docs-pages.yml` (which exists only on `docs`) and the site is published again.

```
push to main → CI passes → sync-docs.yml → push to docs → docs-pages.yml → GitHub Pages
```

- Only `.github/workflows/docs-pages.yml` and `.github/tsuzuri/` on `docs` are updated. `.github/docs-pages.config`, custom CSS, the README and `docs/` are left alone. Do not edit the updated files by hand.
- Nothing runs when CI fails or for PR builds. If nothing changed, no commit is made.
- If a manual push to `docs` collides with a sync, run `git pull --rebase` and push again.
- User-facing documentation fixes are PRs to `docs`, not `main`.

## One-time repository setup

Done once when the repository is created.

**Publishing the `docs` branch.** `docs` is deployed with `TRIGGER_BRANCH=docs`, which is not the default branch, so GitHub needs two settings:

1. `Settings > Pages`: set `Source` to `GitHub Actions` (this creates the `github-pages` environment).
2. `Settings > Environments > github-pages`: add `docs` to `Deployment branches and tags`.

If you skip 2, the deploy job fails with `Branch "docs" is not allowed to deploy to github-pages due to environment protection rules.` Also, because `docs-pages.yml` exists only on `docs`, the Actions tab shows no "Run workflow" button; push to `docs` to deploy.

**Deploy key for `sync-docs.yml`.** The default `GITHUB_TOKEN` cannot be used to push to `docs`, because a push made with it does not start `docs-pages.yml`. Use a deploy key with write access:

1. Create a key pair without a passphrase.

   ```sh
   ssh-keygen -t ed25519 -C "tsuzuri docs sync" -N "" -f tsuzuri_docs_deploy_key
   ```

2. Register the public key: `Settings > Deploy keys > Add deploy key`. Title: `docs sync` (any), Key: contents of `tsuzuri_docs_deploy_key.pub`, and **check `Allow write access`**.
3. Register the private key as a secret: `Settings > Secrets and variables > Actions > New repository secret`. Name: `DOCS_DEPLOY_KEY`, Secret: contents of `tsuzuri_docs_deploy_key` (not the `.pub`).
4. Delete the local key files.

   ```sh
   rm tsuzuri_docs_deploy_key tsuzuri_docs_deploy_key.pub
   ```

Without the key, `sync-docs.yml` fails at the `docs` checkout. CI on `main` and the published site are not affected.

## Reviewing and merging PRs

- CI must pass (`.github/workflows/ci.yml`).
- If the PR re-saved `test/fixtures/golden/`, read the diff and check that it contains only the intended change. A changed CSS file name (`tsuzuri-<hash>.css`) is expected whenever the CSS changes.
- The PR agrees to the MIT License (see the template checklist).
- `CHANGELOG.md` is **not** written in PRs. You write it at release time, in English and Japanese (see Releasing).
- Never enable auto-merge on Dependabot PRs (see below).

## Updating dependencies

Dependabot opens weekly PRs for the dependencies in `package.json`, the GitHub Actions in the workflows, and the mermaid version in `deps/mermaid/package.json`. Packages installed here are also distributed to users through `init`, so a compromised version would reach them. These measures are in place:

- **Only stable versions at least 30 days old**: `cooldown` in `.github/dependabot.yml`. Pre-release versions (alpha, beta, rc) are never proposed; do not write one in a dependency. Security updates are not delayed.
- **No install scripts**: `ignore-scripts=true` in `.npmrc`, and `npm ci --ignore-scripts` in CI. Generated workflows and `preview` install with `--ignore-scripts` as well.
- **Signature check**: `npm audit signatures` in CI.
- **No auto-merge.** Before merging a Dependabot PR, check the changed versions and their release notes, check that the `package-lock.json` diff adds no unfamiliar dependency, and check that CI is green.

**Build dependencies** (`marked`, `highlight.js`, `marked-footnote`; `BUILD_DEPENDENCIES` in `bin/cli.mjs`) are also installed by users' workflows. Write their versions in `package.json` exactly (for example `12.0.2`), not as ranges, or `scripts/build-lockfiles.mjs` and its test fail. `templates/tsuzuri/package.json` and `package-lock.json` are committed, ready-made copies built from the root lockfile (npm drops the root `package-lock.json` from the package, so `init` copies these). When a PR changes these dependencies or theirs, rebuild them in the same PR, or the test in `test/cli.test.mjs` that compares the committed copies with freshly built ones fails:

1. Fetch the PR branch (for example `git fetch origin`, then `git switch <branch>`).
2. Run `node scripts/build-lockfiles.mjs` (no install needed).
3. Check that the diff in `templates/tsuzuri/` contains only the updated versions and hashes.
4. Commit and push to the PR branch. Dependabot stops rebuilding PRs that a person pushed to; to have it rebuild one, comment `@dependabot recreate` and redo these steps.

Updates to dev-only dependencies (ESLint and so on) do not change these files.

**`gemoji`** is a dev-only dependency used to build the emoji shortcode table `.github/scripts/lib/emoji-data.mjs` (committed, never edited by hand; not shipped to users). When `gemoji` is updated, rebuild the table in the same PR, or `test/emoji.test.mjs` fails:

1. Fetch the PR branch and run `npm ci`.
2. Run `node scripts/build-emoji-data.mjs`.
3. Check that the diff of `emoji-data.mjs` contains only emoji additions, changes and removals.
4. Commit and push (`@dependabot recreate` works as above).

**GitHub Actions.** The workflow that `init` generates comes from `templates/.github/workflows/docs-pages.yml`, and Dependabot updates the actions in it too. The versions of the same action in `ci.yml`, `sync-docs.yml` and the template must match or a test fails, so update the others when only one was bumped.

**mermaid.** The version that generated pages load from the CDN is `MERMAID_VERSION` in `.github/scripts/lib/html-renderer.mjs`. `deps/mermaid/package.json` repeats it only so that Dependabot watches it (nothing is installed). When Dependabot updates that file, in the same PR:

1. Set `MERMAID_VERSION` to the same version.
2. Run `node scripts/mermaid-integrity.mjs` and write the printed hash to `MERMAID_INTEGRITY`. Generated pages refuse to run a file that does not match it; the `verify-cdn` job in CI checks the match.

## Releasing

Versions follow [Semantic Versioning](https://semver.org/). Two kinds of tags go on commits of `main`:

- `vX.Y.Z` (for example `v1.0.0`): fixed to that release; never moved.
- `vX` (for example `v1`): points to the latest release of that major version and is moved at every release by `release.yml`. Users run `npx github:akilasatolu/tsuzuri#v1 init` to stay on a compatible version. A release with breaking changes starts a new major (`v2`).

Steps:

1. Check that `npm test` and `npm run lint` pass on `main` and that CI is green.
2. Run `node scripts/check-package.mjs`. It checks the packed package the way users get it; see the comment at the top of the script. This includes that `init --update` keeps the config file and the custom CSS (`.github/tsuzuri/styles/custom.css`).
3. Write `CHANGELOG.md` before tagging. Under `[Unreleased]`, summarize the user-visible changes since the previous tag (the source is the merged PRs and `git log v<previous version>..main`, with the tag of the previous release in place of `v<previous version>`), using the categories described at the top of `CHANGELOG.md`. Rename the heading to `## [X.Y.Z] - YYYY-MM-DD` and add an empty `[Unreleased]` above it. In each release section, write the English block first, then the line `<!-- ja -->`, then the Japanese block with the Japanese category names (see the top of `CHANGELOG.md`). `scripts/release-notes.mjs` fails if the `## [X.Y.Z]` section is missing or empty, if the `<!-- ja -->` line is missing, or if either block is empty, and `release.yml` runs it after you push the tag.
4. Set `version` to `X.Y.Z` in `package.json` and `package-lock.json` (the top-level `version` and `packages[""].version`; leave dependency versions alone).
5. Commit, push to `main`, then tag and push the tag.

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

6. Pushing the tag starts `.github/workflows/release.yml`. Check the result in the Actions tab. It:
   - checks that the tag matches `version` in `package.json` and that the tagged commit is on `main`,
   - creates the GitHub Release from the matching `CHANGELOG.md` section (`scripts/release-notes.mjs`; the release notes have the English text first, then the Japanese),
   - moves the major tag (`vX`) to this commit.

   Your local `vX` tag stays old; run `git fetch --tags --force` if you need it.
7. After the release, check that the `docs` site is published correctly (CI passes, then `sync-docs.yml`, then `docs-pages.yml`).
