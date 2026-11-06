---
title: Presets
order: 20
---

# Presets

A preset is a timer you use often, saved under a short name. Instead of typing the length and the label every time, you start it with one word.

## Create a preset

Use `preset add` with a name, a length and an optional label.

```sh
pocket-timer preset add focus 50m --label "Deep work"
pocket-timer preset add break 10m --label "Break"
```

Presets are saved in your [configuration file](../reference/configuration.md), so you can also edit them by hand.

## Start a preset

```sh
pocket-timer preset focus
```

To see every preset you have saved, run `pocket-timer preset list`.

## Example: a classic work rhythm

Many people work in blocks of 25 minutes with a 5-minute break, and take a longer break after four blocks.

| Preset | Length | Label |
| --- | --- | --- |
| `pomodoro` | 25m | Focus |
| `short` | 5m | Short break |
| `long` | 20m | Long break |

> [!TIP]
> Add `--repeat 4` to run a preset several times in a row, with a short break in between.

## Remove a preset

```sh
pocket-timer preset remove break
```
