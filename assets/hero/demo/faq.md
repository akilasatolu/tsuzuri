---
title: FAQ
---

# FAQ

Answers to the questions people ask most often. If yours is not here, read the [guides](guides/getting-started.md) first.

## Does Pocket Timer work offline?

Yes. Pocket Timer never connects to the internet. Your settings and history stay on your computer.

## What happens if I close the terminal?

The timer stops, and the session is saved in your [history](guides/history.md) as stopped. To keep a timer running in the background, start it with `--detach`.

## Can I use my own sound?

Yes. Set `sound` in the [configuration](reference/configuration.md) to the path of a `.wav` or `.mp3` file.

```json
{ "sound": "~/sounds/gong.wav" }
```

## How do I move my history to a new computer?

Copy the history file to the new computer, or export it on the old one and import it on the new one.

```sh
pocket-timer export --format json > history.json
pocket-timer import history.json
```

> [!NOTE]
> `import` adds the sessions to your history; it never removes the ones you already have.
