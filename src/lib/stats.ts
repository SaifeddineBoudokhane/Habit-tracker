import { addDays, weekStart, weekday } from './dates';
import { getEntry, isComplete, isScheduled, isSlip } from './schedule';
import type { EntryIndex, Habit } from './types';

/** Is `date` a day the habit could have been done (used as the denominator for rates)? */
function trackable(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  if (habit.kind === 'avoid' || habit.schedule.type === 'perWeek') return true;
  return isScheduled(habit, date);
}

function success(habit: Habit, index: EntryIndex, date: string): boolean {
  const e = getEntry(index, habit.id, date);
  return habit.kind === 'avoid' ? !isSlip(habit, e) : isComplete(habit, e);
}

/**
 * Completion rate between two dates (inclusive), or null if there's nothing to measure.
 * Skipped days are left out. Today only counts once it's done, so an unfinished today doesn't drag it down.
 * "X per week" habits are measured against the weekly quota.
 */
export function periodRate(habit: Habit, index: EntryIndex, from: string, to: string, today: string): number | null {
  const end = to < today ? to : today;
  const start = from > habit.startDate ? from : habit.startDate;
  if (start > end) return null;

  if (habit.kind !== 'avoid' && habit.schedule.type === 'perWeek') {
    const times = habit.schedule.times;
    let sum = 0;
    let weeks = 0;
    for (let w = weekStart(start); w <= end; w = addDays(w, 7)) {
      let count = 0;
      let days = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(w, i);
        if (d < start || d > end) continue;
        days++;
        const e = getEntry(index, habit.id, d);
        if (e?.skipped || isComplete(habit, e)) count++;
      }
      const isCurrent = w === weekStart(today);
      // A partial week only counts against a proportional share of the quota.
      const quota = isCurrent ? Math.max(count, Math.min(times, Math.ceil((times * days) / 7))) : (times * days) / 7;
      if (quota <= 0) continue;
      sum += Math.min(1, count / quota) * (days / 7);
      weeks += days / 7;
    }
    return weeks > 0 ? sum / weeks : null;
  }

  let due = 0;
  let done = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!trackable(habit, d)) continue;
    const e = getEntry(index, habit.id, d);
    if (e?.skipped) continue;
    const ok = success(habit, index, d);
    if (d === today && !ok && habit.kind !== 'avoid') continue;
    due++;
    if (ok) done++;
  }
  return due ? done / due : null;
}

export interface WeekdayStat {
  weekday: number;
  due: number;
  done: number;
}

/** Per weekday (0 = Sunday): how often the habit was due and done, since it started. */
export function weekdayStats(habit: Habit, index: EntryIndex, today: string): WeekdayStat[] {
  const out: WeekdayStat[] = Array.from({ length: 7 }, (_, i) => ({ weekday: i, due: 0, done: 0 }));
  for (let d = habit.startDate; d < today; d = addDays(d, 1)) {
    if (!trackable(habit, d)) continue;
    if (getEntry(index, habit.id, d)?.skipped) continue;
    const s = out[weekday(d)];
    s.due++;
    if (success(habit, index, d)) s.done++;
  }
  return out;
}

export type CellStatus = 'future' | 'before' | 'off' | 'none' | 'partial' | 'done' | 'skip' | 'slip';

export interface YearCell {
  date: string;
  status: CellStatus;
  /** 0..1 fill for partial count/duration days. */
  ratio: number;
}

export function cellFor(habit: Habit, index: EntryIndex, date: string, today: string): YearCell {
  const e = getEntry(index, habit.id, date);
  if (date > today) return { date, status: 'future', ratio: 0 };
  if (habit.kind === 'avoid') {
    if (isSlip(habit, e)) return { date, status: 'slip', ratio: 1 };
    return { date, status: date < habit.startDate ? 'before' : 'done', ratio: 1 };
  }
  if (e?.skipped) return { date, status: 'skip', ratio: 0 };
  if (isComplete(habit, e)) return { date, status: 'done', ratio: 1 };
  if (e && e.value > 0) return { date, status: 'partial', ratio: Math.min(1, e.value / Math.max(1, habit.target)) };
  if (date < habit.startDate) return { date, status: 'before', ratio: 0 };
  if (habit.schedule.type !== 'perWeek' && !isScheduled(habit, date)) return { date, status: 'off', ratio: 0 };
  return { date, status: 'none', ratio: 0 };
}

/** GitHub-style grid: `weeks` columns of Mon..Sun, the last column holding today. */
export function yearGrid(habit: Habit, index: EntryIndex, today: string, weeks = 53): YearCell[][] {
  const lastMonday = weekStart(today);
  const first = addDays(lastMonday, -7 * (weeks - 1));
  const cols: YearCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: YearCell[] = [];
    for (let i = 0; i < 7; i++) col.push(cellFor(habit, index, addDays(first, w * 7 + i), today));
    cols.push(col);
  }
  return cols;
}

/** Number of days in [from, to] the habit was completed. */
export function daysDone(habit: Habit, index: EntryIndex, from: string, to: string): number {
  let n = 0;
  for (const e of index.get(habit.id)?.values() ?? []) {
    if (e.date >= from && e.date <= to && isComplete(habit, e)) n++;
  }
  return n;
}

export function valueSum(habitId: string, index: EntryIndex, from: string, to: string): number {
  let n = 0;
  for (const e of index.get(habitId)?.values() ?? []) {
    if (e.date >= from && e.date <= to && !e.skipped) n += e.value;
  }
  return n;
}

