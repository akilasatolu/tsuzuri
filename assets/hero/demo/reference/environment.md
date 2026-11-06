---
title: Environment variables
order: 30
---

# Environment variables

Environment variables change how Pocket Timer behaves without editing the [configuration file](configuration.md). They are useful in scripts and on shared computers.

## Variables

| Variable | Description |
| --- | --- |
| `POCKET_TIMER_CONFIG` | Path to the configuration file |
| `POCKET_TIMER_HISTORY` | Path to the history file |
| `POCKET_TIMER_SOUND` | The sound, overriding the configuration |
| `NO_COLOR` | Turns off colors in the terminal |

## Order of precedence

When the same setting is given in more than one place, Pocket Timer uses the first one it finds:

1. Options on the command line
2. Environment variables
3. The configuration file
4. The built-in defaults

## Example

Keep a separate history for a project by setting the variable in that project's folder.

```sh
export POCKET_TIMER_HISTORY="$PWD/.timer-history.json"
pocket-timer 25m --label "Project work"
```

> [!TIP]
> Set `POCKET_TIMER_SOUND=none` in shared offices to keep every timer quiet.
