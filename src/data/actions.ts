import type { Entry, Habit } from '@/lib/types';

/** Pure helpers that compute the next entry for a user action. */

export function emptyEntry(habitId: string, date: string): Entry {
  return { habitId, date, value: 0, skipped: false };
}

/** Tap on the main button: toggle for check/avoid, +1 for count, +step for duration. */
export function tapped(habit: Habit, e: Entry): Entry {
  switch (habit.kind) {
    case 'check':
    case 'avoid':
      return { ...e, skipped: false, value: e.value >= 1 ? 0 : 1 };
    case 'count':
      return { ...e, skipped: false, value: e.value + 1 };
    case 'duration':
      return { ...e, skipped: false, value: e.value + durationStep(habit) };
  }
}

export function markDone(habit: Habit, e: Entry): Entry {
  return { ...e, skipped: false, value: Math.max(e.value, habit.kind === 'check' ? 1 : habit.target) };
}

export function plusOne(habit: Habit, e: Entry): Entry {
  return habit.kind === 'check' ? markDone(habit, e) : tapped(habit, e);
}

export function durationStep(habit: Habit): number {
  return habit.target >= 30 ? 10 : 5;
}
