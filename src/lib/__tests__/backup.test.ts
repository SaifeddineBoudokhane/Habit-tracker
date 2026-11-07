import { entriesToCsv, makeBackup, parseBackup } from '../backup';
import { DEFAULT_SETTINGS } from '../types';
import { habit } from './helpers';

test('round trip', () => {
  const b = makeBackup([habit()], [{ habitId: 'h1', date: '2026-11-02', value: 1, skipped: false }], DEFAULT_SETTINGS);
  const parsed = parseBackup(JSON.stringify(b));
  expect(parsed.habits).toHaveLength(1);
  expect(parsed.entries).toHaveLength(1);
});

test('rejects garbage', () => {
  expect(() => parseBackup('nope')).toThrow('not valid JSON');
  expect(() => parseBackup('{"app":"other"}')).toThrow('not a Habit Tracker backup');
});

test('drops entries for unknown habits', () => {
  const b = makeBackup([habit()], [{ habitId: 'zzz', date: '2026-11-02', value: 1, skipped: false }], DEFAULT_SETTINGS);
  expect(parseBackup(JSON.stringify(b)).entries).toHaveLength(0);
});

test('csv escapes', () => {
  const csv = entriesToCsv([habit({ name: 'Read, a lot' })], [{ habitId: 'h1', date: '2026-11-02', value: 1, skipped: false }]);
  expect(csv.split('\n')[1]).toBe('2026-11-02,"Read, a lot",check,1,,');
});
