import { addDays, diffDays, monthKey, weekStart, weekday } from './dates';
import type { Entry, EntryIndex, Habit } from './types';

export function getEntry(index: EntryIndex, habitId: string, date: string): Entry | undefined {
  return index.get(habitId)?.get(date);
}

/** Is this habit something you should do on `date` (ignoring weekly quotas)? */
export function isScheduled(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  const s = habit.schedule;
  switch (s.type) {
    case 'daily':
    case 'perWeek':
      return true;
    case 'weekdays':
      return s.days.includes(weekday(date) as never);
    case 'everyN':
      return diffDays(habit.startDate, date) % Math.max(1, s.n) === 0;
  }
}

/** Did the entry fulfil the habit for that day? (Not meaningful for avoid habits.) */
export function isComplete(habit: Habit, entry: Entry | undefined): boolean {
  if (!entry || entry.skipped) return false;
  if (habit.kind === 'avoid') return entry.value < 1;
  if (habit.kind === 'check') return entry.value >= 1;
  return entry.value >= habit.target;
}

export function isSlip(habit: Habit, entry: Entry | undefined): boolean {
  return habit.kind === 'avoid' && !!entry && entry.value >= 1;
}

/** Completed (or skipped) days in the Mon–Sun week containing `date`. */
export function weekCount(habit: Habit, index: EntryIndex, date: string): number {
  const start = weekStart(date);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const e = getEntry(index, habit.id, d);
    if (e?.skipped || isComplete(habit, e)) n++;
  }
  return n;
}

/** Should the habit show up on the Today list for `date`? */
export function isDueOn(habit: Habit, index: EntryIndex, date: string): boolean {
  if (habit.archived || date < habit.startDate) return false;
  if (habit.kind === 'avoid') return true;
  if (habit.schedule.type === 'perWeek') {
    const e = getEntry(index, habit.id, date);
    // Keep showing it on days you logged it, otherwise hide once the week is done.
    if (e && (e.value > 0 || e.skipped)) return true;
    return weekCount(habit, index, date) < habit.schedule.times;
  }
  return isScheduled(habit, date);
}

export function skipsInMonth(habitId: string, index: EntryIndex, date: string): number {
  const m = monthKey(date);
  let n = 0;
  for (const e of index.get(habitId)?.values() ?? []) {
    if (e.skipped && monthKey(e.date) === m) n++;
  }
  return n;
}

export function describeSchedule(habit: Habit): string {
  const s = habit.schedule;
  switch (s.type) {
    case 'daily':
      return 'Every day';
    case 'perWeek':
      return `${s.times}× per week`;
    case 'everyN':
      return s.n === 1 ? 'Every day' : `Every ${s.n} days`;
    case 'weekdays': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const sorted = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      return sorted.map((d) => names[d]).join(' ');
    }
  }
}

/**
 * Days in [from, to] to mark done when you say you've kept the habit since an earlier start date.
 * Only scheduled days with nothing logged; "X per week" fills the first X free days of each week.
 * Avoid habits need nothing: days without a slip already count as clean.
 */
export function backfillDays(habit: Habit, index: EntryIndex, from: string, to: string): string[] {
  if (habit.kind === 'avoid' || from > to) return [];
  const out: string[] = [];
  const free = (d: string) => !getEntry(index, habit.id, d);
  if (habit.schedule.type === 'perWeek') {
    const times = habit.schedule.times;
    for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
      let count = weekCount(habit, index, w);
      for (let i = 0; i < 7 && count < times; i++) {
        const d = addDays(w, i);
        if (d < from || d > to || !free(d)) continue;
        out.push(d);
        count++;
      }
    }
    return out;
  }
  for (let d = from; d <= to; d = addDays(d, 1)) if (isScheduled(habit, d) && free(d)) out.push(d);
  return out;
}

/** Done / due for the habits that count toward a day (avoid habits don't). Skipped counts as done. */
export function dayProgress(habits: Habit[], index: EntryIndex, date: string): { done: number; total: number } {
  const due = habits.filter((h) => !h.archived && h.startDate <= date && h.kind !== 'avoid' && isDueOn(h, index, date));
  const done = due.filter((h) => {
    const e = getEntry(index, h.id, date);
    return isComplete(h, e) || !!e?.skipped;
  }).length;
  return { done, total: due.length };
}
