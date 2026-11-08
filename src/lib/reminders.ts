import { addDays, atTime, parseTime, todayKey } from './dates';
import { getEntry, isComplete, isScheduled, weekCount } from './schedule';
import type { EntryIndex, Habit, Reminder, Settings } from './types';

export interface PlannedNotification {
  /** Deterministic id so the scheduler can diff against what's already scheduled. */
  id: string;
  habitId: string;
  date: string;
  at: Date;
}

export const PLAN_PREFIX = 'plan:';
/** Android allows ~500 pending alarms per app; stay well below it. */
export const MAX_PLANNED = 250;

export function inQuietHours(minutes: number, settings: Settings): boolean {
  if (!settings.quietEnabled) return false;
  const s = parseTime(settings.quietStart);
  const e = parseTime(settings.quietEnd);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export function reminderTimes(r: Reminder): number[] {
  if (r.kind === 'fixed') return [parseTime(r.time)];
  const start = parseTime(r.start);
  const end = parseTime(r.end);
  const step = Math.max(5, r.everyMin);
  const out: number[] = [];
  for (let m = start; m <= end; m += step) out.push(m);
  return out;
}

/** Should the habit still nag you on `date`, given what has already been logged? */
function wantsReminder(habit: Habit, index: EntryIndex, date: string): boolean {
  if (habit.archived || date < habit.startDate) return false;
  if (habit.kind === 'avoid') return true;
  const e = getEntry(index, habit.id, date);
  if (e?.skipped || isComplete(habit, e)) return false;
  if (habit.schedule.type === 'perWeek') {
    return weekCount(habit, index, date) < habit.schedule.times;
  }
  return isScheduled(habit, date);
}

/**
 * Every reminder that should fire in the next `days` days, soonest first.
 * Reminders for habits already done that day, or that fall in quiet hours, are left out.
 */
export function planNotifications(
  habits: Habit[],
  index: EntryIndex,
  settings: Settings,
  now: Date,
  days = 7,
): PlannedNotification[] {
  const today = todayKey(now);
  const out: PlannedNotification[] = [];
  for (const habit of habits) {
    if (habit.archived || habit.reminders.length === 0) continue;
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      // Weekly quota met this week -> nothing for the rest of the week.
      if (!wantsReminder(habit, index, date)) continue;
      const minutes = new Set<number>();
      for (const r of habit.reminders) for (const m of reminderTimes(r)) minutes.add(m);
      for (const m of minutes) {
        if (inQuietHours(m, settings)) continue;
        const at = atTime(date, m);
        if (at.getTime() <= now.getTime()) continue;
        out.push({ id: `${PLAN_PREFIX}${habit.id}:${at.getTime()}`, habitId: habit.id, date, at });
      }
    }
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, MAX_PLANNED);
}

