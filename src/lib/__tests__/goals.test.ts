import { goalProgress } from '../goals';
import type { Goal } from '../types';
import { habit, idx } from './helpers';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g',
  habitId: 'h1',
  metric: 'days',
  target: 10,
  start: '2026-11-01',
  end: '2026-11-10',
  ...over,
});

test('on track and projection', () => {
  const h = habit();
  const i = idx('h1', { '2026-11-01': 1, '2026-11-02': 1, '2026-11-03': 1, '2026-11-04': 1 });
  const p = goalProgress(goal(), h, i, '2026-11-04');
  expect(p.current).toBe(4);
  expect(p.status).toBe('ahead');
  expect(p.projected).toBe('2026-11-10');
  expect(p.neededPerDay).toBeCloseTo(6 / 7); // 6 left over Nov 4..10 (today counts)
});

test('behind', () => {
  const h = habit();
  const i = idx('h1', { '2026-11-01': 1 });
  const p = goalProgress(goal(), h, i, '2026-11-06');
  expect(p.status).toBe('behind');
  expect(p.projected).toBe('2026-12-30'); // 1 per 6 days -> day 60
  expect(p.daysLeft).toBe(4);
});

test('value goal sums logged values', () => {
  const h = habit({ kind: 'count', target: 5, unit: 'km' });
  const i = idx('h1', { '2026-11-01': 3, '2026-11-05': 7.5, '2026-11-20': 100 });
  const p = goalProgress(goal({ metric: 'value', target: 20 }), h, i, '2026-11-15');
  expect(p.current).toBe(10.5);
  expect(p.status).toBe('failed');
});

test('done', () => {
  const h = habit({ kind: 'count', target: 5 });
  const i = idx('h1', { '2026-11-01': 30 });
  expect(goalProgress(goal({ metric: 'value', target: 20 }), h, i, '2026-11-02').status).toBe('done');
});
