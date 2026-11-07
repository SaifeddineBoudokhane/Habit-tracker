import { addDays, diffDays, weekStart, weekday } from '../dates';

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
