import { addDays, diffDays, minKey, weekStart } from './dates';
import { getEntry, isComplete, isScheduled, isSlip } from './schedule';
import type { EntryIndex, Habit } from './types';

export interface HabitStats {
  current: number;
  best: number;
  unit: 'days' | 'weeks';
  /** Number of days the habit was completed (avoid: number of slips). */
  totalDone: number;
  /** Sum of logged values (e.g. total glasses of water). */
  totalValue: number;
  /** 0..1 completion rate over the last 30 days, null if nothing to measure yet. */
  rate30: number | null;
}

function firstDay(habit: Habit, index: EntryIndex): string {
  let first = habit.startDate;
  for (const d of index.get(habit.id)?.keys() ?? []) first = minKey(first, d);
  return first;
}

function totals(habit: Habit, index: EntryIndex) {
  let totalDone = 0;
  let totalValue = 0;
  for (const e of index.get(habit.id)?.values() ?? []) {
    if (e.skipped) continue;
    totalValue += e.value;
    if (habit.kind === 'avoid' ? isSlip(habit, e) : isComplete(habit, e)) totalDone++;
  }
  return { totalDone, totalValue };
}

export function computeStats(habit: Habit, index: EntryIndex, today: string): HabitStats {
  const { totalDone, totalValue } = totals(habit, index);
  if (habit.kind === 'avoid') return { ...avoidStats(habit, index, today), totalDone, totalValue };
  if (habit.schedule.type === 'perWeek')
    return { ...weeklyStats(habit, index, today, habit.schedule.times), totalDone, totalValue };
  return { ...dailyStats(habit, index, today), totalDone, totalValue };
}

/** Streak over scheduled days. Skipped days pass through; today never breaks a streak. */
function dailyStats(habit: Habit, index: EntryIndex, today: string) {
  const start = firstDay(habit, index);
  // Days before startDate count only if they were logged (back-filled).
  const scheduled = (d: string) =>
    d >= habit.startDate ? isScheduled(habit, d) : !!getEntry(index, habit.id, d);
  let run = 0;
  let best = 0;
  let due = 0;
  let done = 0;
  const rateFrom = addDays(today, -29);
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!scheduled(d)) continue;
    const e = getEntry(index, habit.id, d);
    const complete = isComplete(habit, e);
    if (complete) run++;
    else if (!e?.skipped && d !== today) run = 0;
    best = Math.max(best, run);
    if (d >= rateFrom && !e?.skipped && (d !== today || complete)) {
      due++;
      if (complete) done++;
    }
  }
  return { current: run, best, unit: 'days' as const, rate30: due ? done / due : null };
}

/** Streak in weeks for "X times per week" habits. The current and first weeks never break it. */
function weeklyStats(habit: Habit, index: EntryIndex, today: string, times: number) {
  const firstWeek = weekStart(firstDay(habit, index));
  const thisWeek = weekStart(today);
  let run = 0;
  let best = 0;
  let ratioSum = 0;
  let ratioWeeks = 0;
  for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const e = getEntry(index, habit.id, addDays(w, i));
      if (e?.skipped || isComplete(habit, e)) count++;
    }
    const met = count >= times;
    if (met) run++;
    else if (w !== thisWeek && w !== firstWeek) run = 0;
    best = Math.max(best, run);
    // Rate over the last 4 finished weeks.
    if (w !== thisWeek && diffDays(w, thisWeek) <= 28) {
      ratioSum += Math.min(1, count / times);
      ratioWeeks++;
    }
  }
  return { current: run, best, unit: 'weeks' as const, rate30: ratioWeeks ? ratioSum / ratioWeeks : null };
}

/** For avoid habits: the streak is days since the last slip. */
function avoidStats(habit: Habit, index: EntryIndex, today: string) {
  const start = firstDay(habit, index);
  const slips = [...(index.get(habit.id)?.values() ?? [])]
    .filter((e) => isSlip(habit, e) && e.date <= today)
    .map((e) => e.date)
    .sort();
  let best = 0;
  let prev = start;
  for (const s of slips) {
    best = Math.max(best, diffDays(prev, s));
    prev = s;
  }
  const current = diffDays(prev, today);
  best = Math.max(best, current);
  const rateFrom = addDays(today, -29) > start ? addDays(today, -29) : start;
  const span = diffDays(rateFrom, today) + 1;
  const slipDays = slips.filter((s) => s >= rateFrom).length;
  return { current, best, unit: 'days' as const, rate30: span > 0 ? (span - slipDays) / span : null };
}
