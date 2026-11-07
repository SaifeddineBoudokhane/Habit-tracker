import type { Entry, Habit } from '@/lib/types';

/** Pure helpers that compute the next entry for a user action. */

export function emptyEntry(habitId: string, date: string): Entry {
  return { habitId, date, value: 0, skipped: false };
}

/** How much one tap adds for count/duration habits. */
export function stepOf(habit: Habit): number {
  if (habit.step && habit.step > 0) return habit.step;
  if (habit.kind === 'duration') return habit.target >= 30 ? 10 : 5;
  return 1;
}

/** Undo one tap's worth (never below zero). */
export function minusStep(habit: Habit, e: Entry): Entry {
  return { ...e, skipped: false, value: Math.max(0, e.value - stepOf(habit)) };
}

/** Tap on the main button: toggle for check/avoid, +step for count/duration. */
export function tapped(habit: Habit, e: Entry): Entry {
  switch (habit.kind) {
    case 'check':
    case 'avoid':
      return { ...e, skipped: false, value: e.value >= 1 ? 0 : 1 };
    case 'count':
    case 'duration':
      return { ...e, skipped: false, value: e.value + stepOf(habit) };
  }
}

export function markDone(habit: Habit, e: Entry): Entry {
  return { ...e, skipped: false, value: Math.max(e.value, habit.kind === 'check' ? 1 : habit.target) };
}

export function plusOne(habit: Habit, e: Entry): Entry {
  return habit.kind === 'check' ? markDone(habit, e) : tapped(habit, e);
}

/** @deprecated use stepOf */
export const durationStep = stepOf;
