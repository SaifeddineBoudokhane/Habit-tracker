import { computeStats } from '../streaks';
import { habit, idx } from './helpers';

describe('daily habits', () => {
  test('counts consecutive days and today does not break it', () => {
    const h = habit();
    const i = idx('h1', { '2026-11-01': 1, '2026-11-02': 1, '2026-11-03': 1 });
    expect(computeStats(h, i, '2026-11-04').current).toBe(3);
    expect(computeStats(h, i, '2026-11-05').current).toBe(0);
    expect(computeStats(h, i, '2026-11-05').best).toBe(3);
  });

  test('skipped days neither break nor extend', () => {
    const h = habit();
    const i = idx('h1', { '2026-11-01': 1, '2026-11-02': 'skip', '2026-11-03': 1 });
    expect(computeStats(h, i, '2026-11-03').current).toBe(2);
  });

  test('count habit needs target', () => {
    const h = habit({ kind: 'count', target: 8 });
    const i = idx('h1', { '2026-11-01': 8, '2026-11-02': 5, '2026-11-03': 9 });
    const s = computeStats(h, i, '2026-11-03');
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
    expect(s.totalValue).toBe(22);
    expect(s.totalDone).toBe(2);
  });

  test('back-filled days before startDate are counted', () => {
    const h = habit({ startDate: '2026-11-03' });
    const i = idx('h1', { '2026-10-31': 1, '2026-11-01': 1, '2026-11-02': 1, '2026-11-03': 1 });
    expect(computeStats(h, i, '2026-11-03').current).toBe(4);
  });
});

describe('weekday habits', () => {
  test('unscheduled days do not break the streak', () => {
    // Mon/Wed/Fri. Nov 2 = Mon.
    const h = habit({ schedule: { type: 'weekdays', days: [1, 3, 5] }, startDate: '2026-11-02' });
    const i = idx('h1', { '2026-11-02': 1, '2026-11-04': 1, '2026-11-06': 1 });
    expect(computeStats(h, i, '2026-11-08').current).toBe(3);
    // Missing Monday the 9th breaks it once Tuesday arrives.
    expect(computeStats(h, i, '2026-11-10').current).toBe(0);
  });
});

describe('every N days', () => {
  test('only every 2nd day counts', () => {
    const h = habit({ schedule: { type: 'everyN', n: 2 } });
    const i = idx('h1', { '2026-11-01': 1, '2026-11-03': 1, '2026-11-05': 1 });
    expect(computeStats(h, i, '2026-11-06').current).toBe(3);
  });
});

describe('per-week habits', () => {
  test('streak counts weeks that met the quota', () => {
    const h = habit({ schedule: { type: 'perWeek', times: 3 }, startDate: '2026-11-02' });
    const i = idx('h1', {
      '2026-11-02': 1, '2026-11-04': 1, '2026-11-06': 1, // week 1 met
      '2026-11-09': 1, '2026-11-10': 1, '2026-11-13': 1, // week 2 met
      '2026-11-16': 1, // week 3 in progress
    });
    const s = computeStats(h, i, '2026-11-17');
    expect(s.unit).toBe('weeks');
    expect(s.current).toBe(2);
  });

  test('a missed full week resets', () => {
    const h = habit({ schedule: { type: 'perWeek', times: 3 }, startDate: '2026-11-02' });
    const i = idx('h1', { '2026-11-02': 1, '2026-11-04': 1, '2026-11-06': 1, '2026-11-09': 1 });
    expect(computeStats(h, i, '2026-11-17').current).toBe(0);
    expect(computeStats(h, i, '2026-11-17').best).toBe(1);
  });
});

describe('avoid habits', () => {
  test('streak is days since last slip', () => {
    const h = habit({ kind: 'avoid' });
    expect(computeStats(h, idx('h1', {}), '2026-11-11').current).toBe(10);
    const i = idx('h1', { '2026-11-05': 1 });
    const s = computeStats(h, i, '2026-11-11');
    expect(s.current).toBe(6);
    expect(s.best).toBe(6);
    expect(s.totalDone).toBe(1);
  });
});
