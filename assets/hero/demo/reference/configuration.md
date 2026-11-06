---
title: Configuration
order: 20
---

# Configuration

Pocket Timer reads its settings from a JSON file. Every setting is optional; a missing setting uses its default. Settings given on the command line always win over the file.

## Where the file is

| System | Location |
| --- | --- |
| macOS and Linux | `~/.config/pocket-timer/config.json` |
| Windows | `%APPDATA%\pocket-timer\config.json` |

You can point to another file with the `POCKET_TIMER_CONFIG` [environment variable](environment.md).

## Keys

| Key | Default | Description |
| --- | --- | --- |
| `defaultLength` | `25m` | The length used when you give none |
| `sound` | `bell` | The sound played when the time is up |
| `notifications` | `true` | Shows a desktop notification |
| `quietHours` | none | Hours without sound, such as `22:00`–`07:00` |
| `historyFile` | next to the config | Where the history is saved |
| `timeZone` | your computer's | The time zone used for quiet hours and the history |
| `presets` | `{}` | Your saved presets |

## Example

```json
{
  "defaultLength": "50m",
  "sound": "chime",
  "presets": {
    "focus": { "length": "50m", "label": "Deep work" }
  }
}
```
