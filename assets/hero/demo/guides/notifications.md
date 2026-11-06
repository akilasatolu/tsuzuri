---
title: Notifications
order: 30
---

# Notifications

When the time is up, Pocket Timer tells you in two ways: a desktop notification and a short sound. You can change both, or turn them off.

## Desktop notifications

The notification shows the label of the session and how long it lasted. On macOS, allow notifications for your terminal app the first time you are asked.

```sh
pocket-timer 25m --label "Review pull requests"
```

To turn notifications off for one timer, add `--silent`.

## Sounds

Pocket Timer comes with three sounds: `bell` (the default), `chime` and `wood`. Choose one with `--sound`, or set the default in the [configuration](../reference/configuration.md).

```sh
pocket-timer 25m --sound chime
pocket-timer 25m --sound none
```

## Quiet hours

During quiet hours, Pocket Timer shows the notification but plays no sound. This is useful in shared offices or late at night.

```json
{
  "quietHours": { "from": "22:00", "to": "07:00" }
}
```

> [!WARNING]
> Quiet hours use the time zone of your computer. If you travel, check the time with `pocket-timer config get timeZone`.
