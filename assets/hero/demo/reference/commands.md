---
title: Commands
order: 10
---

# Commands

This page lists every command of Pocket Timer. Run `pocket-timer <command> --help` to see the same information in your terminal.

## Start a timer

```sh
pocket-timer <length> [--label <text>] [--sound <name>] [--silent]
```

| Option | Description |
| --- | --- |
| `--label` | A name for the session, shown in the notification and the history |
| `--sound` | `bell`, `chime`, `wood` or `none` |
| `--silent` | No notification and no sound |
| `--repeat <n>` | Runs the timer `n` times in a row |
| `--detach` | Keeps the timer running after you close the terminal |

## preset

```sh
pocket-timer preset <name>
pocket-timer preset add <name> <length> [--label <text>]
pocket-timer preset list
pocket-timer preset remove <name>
```

See the [presets guide](../guides/presets.md) for examples.

## history, export and import

```sh
pocket-timer history [--today | --week] [--label <text>] [--total]
pocket-timer export [--format csv | json] [--since <date>]
pocket-timer import <file>
```

## config

```sh
pocket-timer config get <key>
pocket-timer config set <key> <value>
```

The keys are listed in [configuration](configuration.md).
