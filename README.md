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

**Habits**
- **Types:** yes/no, count (8 glasses of water), duration (read 20 min, with a built-in timer), and avoid (no sugar, streak = days clean).
- **Schedules:** every day, specific weekdays, X times per week (any days), every N days.
- **Today screen:** grouped into Morning / Afternoon / Evening / Anytime, one-tap check-off, +1 for counts,
  progress rings, browse back to fix past days, a note on any day.
- **Streaks:** current and best, aware of the schedule. Rest/sick-day skips don't break a streak (limited per month).
- **Reminders:** fixed times or repeating ("every 60 min, 09:00–21:00"); quiet hours; no reminders once a habit
  is done for the day or the weekly target is met. Notification buttons: **Done**, **+1**, **Snooze 15m**,
  which log without opening the app.

**Insight**
- Per habit: month calendar (tap a day to edit), 12-month heatmap, completion this week / month / all time,
  best and worst weekdays, notes.
- **Goals with deadlines:** "Workout 150 times in 2026", "Run 100 km this month", with progress, a pace marker
  and a projected finish date.
- **Stats tab:** overall completion, all active goals, a per-habit table and a workout summary.

**Workouts**
- Log sessions: weight × reps, bodyweight reps (+ added weight), or distance/time for cardio.
- Each set shows what you did last time; tick an empty set to repeat it.
- Templates (Push / Pull / Legs): save a finished workout as one, or build one by hand.
- Rest timer between sets, with a notification when it's over (works with the screen off).
- Personal records and a progress chart per exercise (est. 1RM, reps, distance).
- Finishing a workout can tick your "Workout" habit automatically (Settings).

**Other**
- **Home-screen widgets:** "Habits today (list)" shows everything due today; "Single habit" shows one habit
  you pick (place as many as you like). Tap to log.
- Reorder habits, archive them, dark mode (follows the phone).
- App lock with fingerprint / screen lock.
- **Your data:** updates install over the old app and keep everything. Uninstalling deletes the app's data
  (Android does that), so turn on **Automatic backup** in Settings: it saves a backup file to a folder you
  choose about once a day, and that folder survives uninstalling. Restore from it after reinstalling.
- Manual export/restore (JSON) and CSV export of habits and workouts.
- Advanced settings (week start day, snooze length, reset to defaults) and delete data
  (habit history, workouts, or everything).

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
