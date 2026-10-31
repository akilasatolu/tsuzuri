---
title: Update
description: Update to the latest Tsuzuri with one command; your settings file and your own custom styles stay as they are
order: 50
---

# Update

Updating is one command, and your settings file and your own custom styles stay as they are.

## Updating to the latest version (`--update`)

To update Tsuzuri in a repository where you've already run `init`, run it with `--update`.

```
npx github:akilasatolu/tsuzuri#v1 init --update
```

It asks nothing and works as follows.

| File | With `--update` |
|---|---|
| `.github/workflows/tsuzuri-pages.yml` | Overwritten with the latest version |
| Build script, `base.css` and `default.css` under `.github/tsuzuri/` | Overwritten with the latest version (new files are added; scripts under `lib/` no longer used by the latest version are deleted). `default.css` is overwritten, so copy it under another name if you want to edit it; CSS files in `styles/` are never deleted |
| `.github/tsuzuri/config` | **Not changed** (a `LANG` in a settings file created up to v1.27.0 is not rewritten to `LANGUAGES` either) |
| Custom styles you put in `.github/tsuzuri/styles/` (the ones downloaded from the gallery, and your own) | **Not changed** (and not deleted; an old `material.css` and the like are left too) |

If you run `--update` with a settings file created up to v1.27.0 (one with `LANG` but no
`LANGUAGES`), it points out `LANGUAGES` under "Keys missing from the settings file". Without a
language the site becomes English, so for a Japanese site add `LANGUAGES=ja` and delete the
`LANG` line (see the [configuration reference](../reference/configuration.md#languages)).

`--lang` does not change what `--update` writes, except for one case: with `init --update --lang ja`,
the messages are in Japanese. The workflow, `.gitignore`, `package.json` and CSS files it overwrites are the
same with or without `--lang`.

After it runs, check the changes with `git diff` before committing and pushing. Running it in a
repository without `.github/tsuzuri/config` (where you haven't run `init` yet) writes
nothing and exits with an error. Run it without `--update` the first time.

## Pinning and updating the version

The build script is copied under `.github/tsuzuri/` when you run `init`, so **once generated,
the version never changes automatically unless you do something** (unlike the old
`uses: ...@v1`, it's no longer updated to the latest on every workflow run).

To update to the latest Tsuzuri, run the setup command with `--update`. Only the workflow and
the build script (including `base.css` and `default.css`) are overwritten with the latest version;
`.github/tsuzuri/config` and the custom styles you put in `styles/` are left as they are (see "Updating to the latest version (`--update`)" above).

```sh
npx github:akilasatolu/tsuzuri#v1 init --update
```

The build dependencies (marked and others) are also pinned to the versions and hashes written in
`.github/tsuzuri/package-lock.json` (v1.7.0 or later). They don't change until you run
`--update`.

To pin a specific version, specify a tag. `#v1` is the latest v1 release (updated without
breaking compatibility); a full version such as `#v1.2.0` pins that release.

```sh
npx github:akilasatolu/tsuzuri#v1.2.0 init --update
```

## Pinning the ref

If you leave out the `ref` (a version, branch or tag), as in `npx github:akilasatolu/tsuzuri init`,
the latest state of the default branch (`main`) runs, which may include unreleased changes.
Normally, run it with `#v1`. Depending on your local cache or `npx` itself, an old version may
run, so to pin a released version, specify a tag such as `#v1` explicitly, like this.

```
npx github:akilasatolu/tsuzuri#v1 init
```

`v1` is a tag that is kept up to date without breaking compatibility (a `v2` is created only
for breaking changes). If "the behavior changes every time I run it" or "the latest changes
don't show up", try `#v1` first.

## Read next

- [FAQ](../faq.md): when something does not work.
- [Reference](../reference/README.md): look up a setting or a specification.
