import { addDays, diffDays } from './dates';
import { getEntry, isSlip } from './schedule';
import { daysDone, valueSum } from './stats';
import type { EntryIndex, Goal, Habit } from './types';

export type GoalStatus = 'upcoming' | 'done' | 'ahead' | 'behind' | 'failed';

export interface GoalProgress {
  current: number;
  target: number;
  /** 0..1 */
  pct: number;
  /** Where you'd need to be today to finish exactly on the deadline. */
  expectedNow: number;
  status: GoalStatus;
  daysLeft: number;
  /** Projected finish date at the current pace (null if no pace yet or already done). */
  projected: string | null;
  /** Needed per day from now on to hit the target. */
  neededPerDay: number;
}

export function goalCurrent(goal: Goal, habit: Habit, index: EntryIndex, today: string): number {
  const to = goal.end < today ? goal.end : today;
  if (goal.start > to) return 0;
  if (goal.metric === 'value') return valueSum(habit.id, index, goal.start, to);
  if (habit.kind === 'avoid') {
    let clean = 0;
    for (let d = goal.start; d <= to; d = addDays(d, 1)) {
      if (d >= habit.startDate && !isSlip(habit, getEntry(index, habit.id, d))) clean++;
    }
    return clean;
  }
  return daysDone(habit, index, goal.start, to);
}

export function goalProgress(goal: Goal, habit: Habit, index: EntryIndex, today: string): GoalProgress {
  const current = goalCurrent(goal, habit, index, today);
  const target = Math.max(1, goal.target);
  const total = diffDays(goal.start, goal.end) + 1;
  const elapsed = Math.max(0, Math.min(total, diffDays(goal.start, today) + 1));
  const expectedNow = (target * elapsed) / total;
  const daysLeft = Math.max(0, diffDays(today, goal.end));
  const remainingDays = goal.end >= today ? daysLeft + 1 : 0;

  let status: GoalStatus;
  if (current >= target) status = 'done';
  else if (today < goal.start) status = 'upcoming';
  else if (today > goal.end) status = 'failed';
  else status = current + 1e-9 >= expectedNow * 0.95 ? 'ahead' : 'behind';

  let projected: string | null = null;
  if (status !== 'done' && elapsed > 0 && current > 0) {
    const perDay = current / elapsed;
    projected = addDays(goal.start, Math.ceil(target / perDay) - 1);
  }
  return {
    current,
    target,
    pct: Math.min(1, current / target),
    expectedNow,
    status,
    daysLeft,
    projected,
    neededPerDay: remainingDays > 0 ? Math.max(0, target - current) / remainingDays : 0,
  };
}
