import type { Entry, EntryIndex, Habit } from '../types';

export function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Workout',
    emoji: '💪',
    color: '#3b82f6',
    kind: 'check',
    target: 1,
    unit: '',
    schedule: { type: 'daily' },
    reminders: [],
    archived: false,
    sortOrder: 0,
    startDate: '2026-11-01',
    ...over,
  };
}

/** Build an index from shorthand: { '2026-11-02': 1, '2026-11-03': 'skip' } */
export function idx(habitId: string, days: Record<string, number | 'skip'>): EntryIndex {
  const m = new Map<string, Entry>();
  for (const [date, v] of Object.entries(days)) {
    m.set(date, { habitId, date, value: v === 'skip' ? 0 : v, skipped: v === 'skip' });
  }
  return new Map([[habitId, m]]);
}
