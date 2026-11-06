---
title: Getting started
order: 10
---

# Getting started

This guide takes you from installing Pocket Timer to finishing your first focused session. It takes about five minutes.

## Install

Pocket Timer needs Node.js 20 or later. Install it with npm, or with Homebrew on macOS.

```sh
npm install -g pocket-timer
pocket-timer --version
```

## Start your first timer

Give the timer a length. Use `m` for minutes and `s` for seconds; `1h30m` also works.

```sh
pocket-timer 25m
```

A countdown with a progress bar appears in your terminal. Press `p` to pause, `p` again to resume, and `q` to stop early.

## Add a label

A label tells you later what the session was for. It is shown in the notification and saved in your history.

```sh
pocket-timer 25m --label "Write docs"
```

> [!NOTE]
> Labels can contain spaces when you put them in quotes.

## Next steps

- Save the timers you use every day as [presets](presets.md).
- Choose how you are told that the time is up in [notifications](notifications.md).
