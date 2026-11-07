# Habit Tracker

A personal, fully offline habit tracker for Android. No account, no server: everything is stored on the phone.

## Install on your phone

**Download:** https://github.com/SaifeddineBoudokhane/Habit-tracker/releases/latest/download/habit-tracker.apk

1. Open the link on your Android phone and download the APK.
2. Open it. Android will ask you to allow installing apps from your browser/files app. Allow it.
3. Open **Habit Tracker** and allow notifications when asked.

Every push builds a new APK automatically (GitHub Actions → Releases). Installing a new one updates the
app in place and keeps your data.

## Features

- **Habit types:** yes/no, count (8 glasses of water), duration (read 20 min), and avoid (no sugar, streak = days clean).
- **Schedules:** every day, specific weekdays, X times per week (any days), every N days.
- **Today screen:** one-tap check-off, +1 for counts, progress rings, browse back to fix past days.
- **Streaks:** current and best, aware of the schedule. Rest/sick-day skips don't break a streak (limited per month).
- **Reminders:** fixed times or repeating ("every 60 min, 09:00–21:00"); quiet hours; no reminders once a habit
  is done for the day or the weekly target is met. Notification buttons: **Done**, **+1**, **Snooze 15m**,
  which log without opening the app.
- **History:** per-habit calendar (tap any day to edit), streaks, 30-day completion rate, totals.
- **Backup:** export/restore JSON, export CSV. Since data only lives on the phone, back up now and then.

## Development

Built with Expo (React Native, TypeScript), expo-sqlite, expo-notifications.

```bash
npm install
npm test            # unit tests for streaks, schedules, reminder planning, backups
npm run typecheck
npm run lint
```

Code layout:

- `src/lib/`: pure logic (dates, schedules, streaks, reminder planning, backup format) with tests in `src/lib/__tests__`
- `src/data/`: SQLite storage and the React store
- `src/notifications/`: scheduling notifications, notification actions, background tasks
- `src/app/`: screens (Expo Router)
- `src/components/`: UI pieces

See `PLAN.md` for the roadmap.
