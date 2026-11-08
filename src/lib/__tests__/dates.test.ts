import { addDays, diffDays, setDayEndHour, setWeekStartDay, todayKey, weekStart, weekday } from '../dates';

test('addDays crosses months and years', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('diffDays', () => {
  expect(diffDays('2026-11-01', '2026-11-08')).toBe(7);
  expect(diffDays('2026-11-08', '2026-11-01')).toBe(-7);
});

test('weekStart is Monday', () => {
  expect(weekday('2026-11-02')).toBe(1);
  expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday belongs to the week before
  expect(weekStart('2026-11-02')).toBe('2026-11-02');
  expect(weekStart('2026-11-05')).toBe('2026-11-02');
});

test('weekStart follows the configured first day', () => {
  try {
    setWeekStartDay(0);
    expect(weekStart('2026-11-08')).toBe('2026-11-08'); // Sunday starts its own week
    expect(weekStart('2026-11-07')).toBe('2026-11-01');
    setWeekStartDay(6);
    expect(weekStart('2026-11-07')).toBe('2026-11-07'); // Saturday
    expect(weekStart('2026-11-06')).toBe('2026-10-31');
  } finally {
    setWeekStartDay(1);
  }
});

describe('day end hour', () => {
  afterEach(() => setDayEndHour(0));

  it('rolls over at midnight by default', () => {
    expect(todayKey(new Date(2026, 10, 8, 0, 30))).toBe('2026-11-08');
  });

  it('keeps counting the previous day until the chosen hour', () => {
    setDayEndHour(3);
    expect(todayKey(new Date(2026, 10, 8, 2, 59))).toBe('2026-11-07');
    expect(todayKey(new Date(2026, 10, 8, 3, 0))).toBe('2026-11-08');
    expect(todayKey(new Date(2026, 10, 8, 23, 0))).toBe('2026-11-08');
  });
});
