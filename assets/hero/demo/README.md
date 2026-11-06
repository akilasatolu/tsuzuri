<!-- Tsuzuri のトップの GIF(scripts/make-hero-gif.mjs)で使う、架空のプロジェクトの見本。 -->
# Pocket Timer

Pocket Timer is a tiny command-line timer for focused work sessions. You give it a length and a label, and it counts down in your terminal while you work. When the time is up, it tells you with a desktop notification and a short sound, and it keeps a history of every session.

It is made for people who already live in the terminal: developers, writers and students who want a simple way to split the day into blocks of work and breaks, without opening another app or signing up for anything.

> [!TIP]
> New to Pocket Timer? Start with the [getting started guide](guides/getting-started.md).

## Why Pocket Timer

Most timers want a window, an account or a phone. Pocket Timer is a single command that starts in a blink and gets out of your way.

- **Fast**: it starts instantly and uses almost no memory.
- **Quiet**: one notification when the time is up, and nothing else.
- **Yours**: your history stays in a plain file on your computer.

## Install

```sh
npm install -g pocket-timer
brew install pocket-timer
```

## Quick start

```sh
pocket-timer 25m --label "Write docs"
pocket-timer 5m --label "Break"
pocket-timer history --today
```

The first command starts a 25-minute session called "Write docs". Press `p` to pause and `q` to stop. The last command lists what you did today.

## Commands

| Command | What it does |
| --- | --- |
| `pocket-timer <length>` | Starts a timer, such as `25m` or `90s` |
| `pocket-timer preset <name>` | Starts a saved preset |
| `pocket-timer history` | Lists your past sessions |
| `pocket-timer export` | Writes your history to CSV or JSON |
| `pocket-timer config` | Shows or changes your settings |

## Documentation

- Guides
  - [Getting started](guides/getting-started.md)
  - [Presets](guides/presets.md)
  - [Notifications](guides/notifications.md)
  - [History](guides/history.md)
- Reference
  - [Commands](reference/commands.md)
  - [Configuration](reference/configuration.md)
  - [Environment variables](reference/environment.md)
- [FAQ](faq.md)

## License

MIT
