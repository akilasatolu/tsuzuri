---
title: History
order: 40
---

# History

Every session that you finish or stop is saved in your history, with its label, its length and when it started. The history helps you see where your time went.

## See your history

```sh
pocket-timer history
pocket-timer history --today
pocket-timer history --week --label "Write docs"
```

The list shows the newest sessions first. Stopped sessions are marked with `(stopped)`.

## Totals

Add `--total` to see how much time you spent on each label.

| Label | Sessions | Time |
| --- | --- | --- |
| Write docs | 6 | 2h 30m |
| Review pull requests | 3 | 1h 15m |
| Break | 8 | 40m |

## Export

Write your history to a file to use it in a spreadsheet or in your own scripts. See [`export`](../reference/commands.md) for every option.

```sh
pocket-timer export --format csv > history.csv
```

> [!NOTE]
> The history is a plain JSON file. Its location is set by `historyFile` in the [configuration](../reference/configuration.md).
