# Habit Tracker — Plan

A personal, fully offline habit tracker. No accounts, no backend, no cloud sync.
All data lives on the phone.

## Tech stack (recommended)

| Concern | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo** (TypeScript) | One codebase for Android and iOS, and all of it can be written and built from a cloud dev environment. |
| Storage | **expo-sqlite** | Real local database. Fast queries for streaks and stats, and it works offline. |
| Reminders | **expo-notifications** (local scheduled notifications) | Notifications fire from the OS even when the app is closed. A web app (PWA) can't do this reliably, which is why this isn't a web app. |
| Charts | victory-native or react-native-svg | Lightweight, offline. |
| Builds | **EAS Build** (Expo's cloud build) | Produces an installable APK without needing Android Studio or Xcode on your machine. |

Constraint to remember: iOS caps an app at **64 pending scheduled notifications**.
Hourly reminders therefore have to be scheduled as repeating triggers, or topped up
on a rolling window each time the app opens. Android has no such cap.

## Features

### Phase 1 — core (MVP) ✅ built

**Habits**
- Create, edit, archive and delete a habit: name, icon/emoji, color.
- Habit type:
  - **Yes/No**, e.g. "Workout", "Meditate".
  - **Count**, e.g. "Water: 8 glasses" or "Push-ups: 100". Tap +1, or enter a number.
  - **Duration**, e.g. "Read 20 min". Optional built-in timer.
- **Schedule**: every day, specific weekdays (Mon/Wed/Fri), X times per week
  (e.g. "gym 3×/week", any days), or every N days.
- **Avoid/negative habits**, e.g. "No sugar" or "No smoking". Success means you
  didn't do it, and the main stat is days since you last slipped.

**Today screen** (the main screen)
- Only the habits due today, with one-tap check-off.
- Progress ring or bar per count habit (e.g. 5/8 glasses).
- Undo, plus the ability to log or fix past days (you'll forget sometimes).

**Streaks**
- Current streak and best streak.
- Streaks respect the schedule. A Mon/Wed/Fri habit doesn't break on Tuesday,
  and a 3×/week habit counts in weeks.
- **Skip / rest day / sick day** that doesn't break the streak (limited, so it
  stays honest).

**Reminders / alarms**
- Per-habit reminders at fixed times (e.g. 07:00 workout).
- **Interval reminders**, e.g. "drink water every 60 min between 09:00 and 22:00".
- **Quiet hours**, so nothing fires overnight.
- Actions on the notification itself: **Done / +1 / Snooze 15 min**, logged
  without opening the app.
- Smart suppression: no reminder for a habit that's already done today.

**Data safety** (important when there's no backend)
- **Export / import backup** as a JSON file you can save to Drive, email and so on.
- CSV export, if you want to look at the data in a spreadsheet.

### Phase 2 — insight

- **Calendar heatmap** per habit (GitHub-style year view).
- **Stats**: completion % for the week, month and all time; totals (e.g. liters of
  water this month); best and worst weekdays.
- **Goals with targets and deadlines**, e.g. "Workout 150 times in 2026" or
  "Run 100 km this month", with a progress bar and projected finish.
- **Notes per check-in**, e.g. "felt weak, slept 5h".

### Phase 3 — workouts (since that's a main use case)

- Workout log per session: exercises, sets × reps × weight, or distance/time for cardio.
- Reusable workout templates (Push / Pull / Legs).
- Personal records (PRs) per exercise, plus a progress chart.
- Rest timer between sets.
- Logging a workout automatically ticks the "Workout" habit.

### Nice-to-have (only if you find you actually want them)

- Home-screen widget to check off habits.
- Dark mode (cheap, so probably worth doing early).
- Habit ordering and grouping (Morning / Evening).
- App lock (PIN or biometrics).

### Deliberately left out

Social features, leaderboards, badges/gamification, AI coaching, accounts and
cloud sync. They're not useful for a single-person offline tracker. Sync can be
added later because the data model will be clean.

## Data model (sketch)

```
habits(id, name, icon, color, type[yes_no|count|duration], target, unit,
       schedule_type[daily|weekdays|x_per_week|every_n_days], schedule_value,
       is_negative, archived, sort_order, created_at)

entries(id, habit_id, date, value, note, status[done|skipped], created_at)

reminders(id, habit_id, kind[fixed|interval], time, interval_min,
          window_start, window_end, weekdays, enabled)

goals(id, habit_id, target_total, period_start, period_end)

-- phase 3
workouts(id, date, template_id, note)
workout_sets(id, workout_id, exercise_id, set_no, reps, weight, distance, duration)
exercises(id, name, category)
```

Streaks and stats are computed from `entries`, not stored, so they can never
drift out of sync.

## Development workflow (cloud)

1. Code is written and committed in this cloud environment.
2. Logic (streaks, schedules, stats) is covered by unit tests run here (Jest).
3. Every push runs GitHub Actions (`.github/workflows/android.yml`): typecheck, tests,
   lint, then a release APK published to GitHub Releases. Install link:
   https://github.com/SaifeddineBoudokhane/Habit-tracker/releases/latest/download/habit-tracker.apk
4. No Expo account or Android Studio needed. (EAS Build remains an option later.)
