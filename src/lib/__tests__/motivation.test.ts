import { encouragement } from '../motivation';
import type { EntryIndex } from '../types';
import { habit, idx } from './helpers';

const merge = (...xs: EntryIndex[]): EntryIndex => new Map(xs.flatMap((x) => [...x]));

test('no habits', () => {
  expect(encouragement([], new Map(), '2026-11-05').title).toBe('Start a habit');
});

test('streak at risk names the longest one', () => {
  const a = habit({ id: 'a', name: 'Workout' });
  const b = habit({ id: 'b', name: 'Read' });
  const i = merge(
    idx('a', { '2026-11-02': 1, '2026-11-03': 1, '2026-11-04': 1 }),
    idx('b', { '2026-11-04': 1 }),
  );
  const m = encouragement([a, b], i, '2026-11-05');
  expect(m.title).toBe('Keep your 3-day streak');
  expect(m.body).toContain('Workout');
  expect(m.body).toContain('+1 more');
});

test('all done', () => {
  const a = habit({ id: 'a' });
  const m = encouragement([a], idx('a', { '2026-11-04': 1, '2026-11-05': 1 }), '2026-11-05');
  expect(m.title).toBe('All done today');
});

test('milestone beats everything', () => {
  const a = habit({ id: 'a', startDate: '2026-10-01' });
  const seven: Record<string, number> = {
    '2026-10-30': 1, '2026-10-31': 1, '2026-11-01': 1, '2026-11-02': 1, '2026-11-03': 1, '2026-11-04': 1, '2026-11-05': 1,
  };
  const m = encouragement([a], idx('a', seven), '2026-11-05');
  expect(m.title).toBe('7-day streak!');
});

test('fresh start when nothing logged', () => {
  expect(encouragement([habit()], new Map(), '2026-11-05').title).toBe('Fresh start');
});
