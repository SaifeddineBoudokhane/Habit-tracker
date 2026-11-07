import { periodRate, weekdayStats, yearGrid } from '../stats';
import { habit, idx } from './helpers';

test('periodRate for daily habit ignores unfinished today and skips', () => {
  const h = habit();
  const i = idx('h1', { '2026-11-01': 1, '2026-11-02': 'skip', '2026-11-03': 1 });
  // Nov 1..4: 1 done, 2 skipped, 3 done, 4 = today (not done) -> 2/2
  expect(periodRate(h, i, '2026-11-01', '2026-11-04', '2026-11-04')).toBe(1);
  // Nov 1..5 with today = 6: day 4 and 5 missed -> 2/4
  expect(periodRate(h, i, '2026-11-01', '2026-11-05', '2026-11-06')).toBe(0.5);
});

test('periodRate for per-week habits uses the quota', () => {
  const h = habit({ schedule: { type: 'perWeek', times: 2 }, startDate: '2026-11-02' });
  const i = idx('h1', { '2026-11-02': 1, '2026-11-04': 1, '2026-11-09': 1 });
  // Week 1 met (1.0), week 2 had 1 of 2 (0.5)
  expect(periodRate(h, i, '2026-11-02', '2026-11-15', '2026-11-20')).toBeCloseTo(0.75);
});

test('weekdayStats', () => {
  const h = habit({ startDate: '2026-11-02' }); // Monday
  const i = idx('h1', { '2026-11-02': 1, '2026-11-09': 1, '2026-11-03': 1 });
  const s = weekdayStats(h, i, '2026-11-16');
  expect(s[1]).toEqual({ weekday: 1, due: 2, done: 2 });
  expect(s[2]).toEqual({ weekday: 2, due: 2, done: 1 });
});

test('yearGrid ends with the current week', () => {
  const h = habit();
  const i = idx('h1', { '2026-11-02': 1 });
  const g = yearGrid(h, i, '2026-11-04', 2);
  expect(g).toHaveLength(2);
  expect(g[1][0].date).toBe('2026-11-02');
  expect(g[1][0].status).toBe('done');
  expect(g[1][1].status).toBe('none');
  expect(g[1][3].status).toBe('future');
  expect(g[0][0].status).toBe('before');
});
