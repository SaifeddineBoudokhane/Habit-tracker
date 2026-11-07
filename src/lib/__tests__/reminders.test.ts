import { inQuietHours, planNotifications, reminderTimes } from '../reminders';
import { DEFAULT_SETTINGS } from '../types';
import { habit, idx } from './helpers';

const settings = { ...DEFAULT_SETTINGS, quietEnabled: true, quietStart: '22:00', quietEnd: '07:00' };

test('quiet hours wrap past midnight', () => {
  expect(inQuietHours(23 * 60, settings)).toBe(true);
  expect(inQuietHours(6 * 60 + 59, settings)).toBe(true);
  expect(inQuietHours(7 * 60, settings)).toBe(false);
  expect(inQuietHours(12 * 60, { ...settings, quietEnabled: false })).toBe(false);
});

test('interval reminder expands to slots', () => {
  expect(reminderTimes({ id: 'r', kind: 'interval', everyMin: 60, start: '09:00', end: '12:00' })).toEqual([
    540, 600, 660, 720,
  ]);
});

test('water every hour: only future slots, none in quiet hours', () => {
  const water = habit({
    id: 'w',
    kind: 'count',
    target: 8,
    reminders: [{ id: 'r', kind: 'interval', everyMin: 60, start: '06:00', end: '23:00' }],
  });
  const now = new Date(2026, 10, 7, 14, 30);
  const plan = planNotifications([water], new Map(), settings, now, 1);
  expect(plan.map((p) => p.at.getHours())).toEqual([15, 16, 17, 18, 19, 20, 21]);
});

test('no reminders for a habit already done today', () => {
  const h = habit({ reminders: [{ id: 'r', kind: 'fixed', time: '20:00' }] });
  const now = new Date(2026, 10, 7, 8, 0);
  const done = idx('h1', { '2026-11-07': 1 });
  const plan = planNotifications([h], done, settings, now, 2);
  expect(plan.map((p) => p.date)).toEqual(['2026-11-08']);
});

test('weekly quota met stops reminders for the rest of the week', () => {
  const h = habit({
    schedule: { type: 'perWeek', times: 2 },
    reminders: [{ id: 'r', kind: 'fixed', time: '18:00' }],
  });
  const now = new Date(2026, 10, 4, 8, 0); // Wed
  const i = idx('h1', { '2026-11-02': 1, '2026-11-03': 1 });
  const plan = planNotifications([h], i, settings, now, 7);
  // Wed..Sun skipped, Mon 9th and Tue 10th are a new week.
  expect(plan.map((p) => p.date)).toEqual(['2026-11-09', '2026-11-10']);
});

test('ids are stable', () => {
  const h = habit({ reminders: [{ id: 'r', kind: 'fixed', time: '20:00' }] });
  const now = new Date(2026, 10, 7, 8, 0);
  const a = planNotifications([h], new Map(), settings, now, 1);
  const b = planNotifications([h], new Map(), settings, new Date(2026, 10, 7, 9, 0), 1);
  expect(a[0].id).toBe(b[0].id);
});
