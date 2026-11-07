import { isDueOn, skipsInMonth } from '../schedule';
import { habit, idx } from './helpers';

test('per-week habit disappears from Today once the quota is met', () => {
  const h = habit({ schedule: { type: 'perWeek', times: 2 }, startDate: '2026-11-02' });
  const i = idx('h1', { '2026-11-02': 1, '2026-11-03': 1 });
  expect(isDueOn(h, i, '2026-11-03')).toBe(true); // logged that day, keep showing
  expect(isDueOn(h, i, '2026-11-04')).toBe(false);
  expect(isDueOn(h, i, '2026-11-09')).toBe(true); // new week
});

test('weekday habit is only due on its days', () => {
  const h = habit({ schedule: { type: 'weekdays', days: [1] } });
  expect(isDueOn(h, new Map(), '2026-11-02')).toBe(true);
  expect(isDueOn(h, new Map(), '2026-11-03')).toBe(false);
});

test('archived and not-yet-started habits are never due', () => {
  expect(isDueOn(habit({ archived: true }), new Map(), '2026-11-02')).toBe(false);
  expect(isDueOn(habit(), new Map(), '2026-10-31')).toBe(false);
});

test('skipsInMonth', () => {
  const i = idx('h1', { '2026-10-30': 'skip', '2026-11-02': 'skip', '2026-11-03': 'skip', '2026-11-04': 1 });
  expect(skipsInMonth('h1', i, '2026-11-20')).toBe(2);
});

test('custom step for count habits', () => {
  const { tapped, minusStep, stepOf } = jest.requireActual('../../data/actions') as typeof import('../../data/actions');
  const h = habit({ kind: 'count', target: 100, step: 10 });
  const e = { habitId: 'h1', date: '2026-11-02', value: 0, skipped: false };
  expect(stepOf(h)).toBe(10);
  expect(tapped(h, e).value).toBe(10);
  expect(minusStep(h, { ...e, value: 5 }).value).toBe(0);
  expect(stepOf(habit({ kind: 'count' }))).toBe(1);
  expect(stepOf(habit({ kind: 'duration', target: 30 }))).toBe(10);
});

describe('backfillDays', () => {
  const { backfillDays } = jest.requireActual('../schedule') as typeof import('../schedule');

  test('daily: every free day in range, keeps what was already logged', () => {
    const h = habit({ startDate: '2026-10-28' });
    const i = idx('h1', { '2026-10-29': 'skip', '2026-10-30': 1 });
    expect(backfillDays(h, i, '2026-10-28', '2026-10-31')).toEqual(['2026-10-28', '2026-10-31']);
  });

  test('specific weekdays only', () => {
    const h = habit({ startDate: '2026-10-26', schedule: { type: 'weekdays', days: [1, 3] } });
    expect(backfillDays(h, new Map(), '2026-10-26', '2026-11-01')).toEqual(['2026-10-26', '2026-10-28']);
  });

  test('per week: fills only up to the quota', () => {
    const h = habit({ startDate: '2026-10-26', schedule: { type: 'perWeek', times: 2 } });
    const i = idx('h1', { '2026-10-27': 1 });
    expect(backfillDays(h, i, '2026-10-26', '2026-11-01')).toEqual(['2026-10-26']);
  });

  test('avoid habits need no entries', () => {
    const h = habit({ kind: 'avoid', startDate: '2026-10-01' });
    expect(backfillDays(h, new Map(), '2026-10-01', '2026-10-31')).toEqual([]);
  });
});
