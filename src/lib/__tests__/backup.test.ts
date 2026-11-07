import { entriesToCsv, makeBackup, parseBackup, workoutsToCsv } from '../backup';
import { DEFAULT_SETTINGS } from '../types';
import { habit } from './helpers';

const empty = { goals: [], exercises: [], templates: [], workouts: [], sets: [] };

test('round trip', () => {
  const b = makeBackup({
    habits: [habit()],
    entries: [{ habitId: 'h1', date: '2026-11-02', value: 1, skipped: false, note: 'hi' }],
    settings: { ...DEFAULT_SETTINGS, timers: { h1: 5 } },
    ...empty,
    exercises: [{ id: 'e1', name: 'Squat', kind: 'strength' }],
    workouts: [{ id: 'w1', date: '2026-11-02', name: 'Legs', templateId: null, note: '', startedAt: 1, finishedAt: 2 }],
    sets: [{ id: 's1', workoutId: 'w1', exerciseId: 'e1', order: 0, reps: 5, weight: 100, distance: 0, durationSec: 0, done: true }],
  });
  const parsed = parseBackup(JSON.stringify(b));
  expect(parsed.habits).toHaveLength(1);
  expect(parsed.entries[0].note).toBe('hi');
  expect(parsed.sets).toHaveLength(1);
  expect(parsed.settings.timers).toEqual({});
});

test('reads v1 backups', () => {
  const v1 = { app: 'habit-tracker', version: 1, habits: [habit()], entries: [], settings: {} };
  const parsed = parseBackup(JSON.stringify(v1));
  expect(parsed.version).toBe(2);
  expect(parsed.workouts).toEqual([]);
  expect(parsed.settings.restSeconds).toBe(90);
});

test('rejects garbage', () => {
  expect(() => parseBackup('nope')).toThrow('not valid JSON');
  expect(() => parseBackup('{"app":"other"}')).toThrow('not a Habit Tracker backup');
});

test('drops orphans', () => {
  const b = makeBackup({
    habits: [habit()],
    entries: [{ habitId: 'zzz', date: '2026-11-02', value: 1, skipped: false }],
    settings: DEFAULT_SETTINGS,
    ...empty,
    sets: [{ id: 's1', workoutId: 'nope', exerciseId: 'e1', order: 0, reps: 5, weight: 100, distance: 0, durationSec: 0, done: true }],
  });
  const parsed = parseBackup(JSON.stringify(b));
  expect(parsed.entries).toHaveLength(0);
  expect(parsed.sets).toHaveLength(0);
});

test('csv escapes', () => {
  const csv = entriesToCsv([habit({ name: 'Read, a lot' })], [{ habitId: 'h1', date: '2026-11-02', value: 1, skipped: false }]);
  expect(csv.split('\n')[1]).toBe('2026-11-02,"Read, a lot",check,1,,,');
});

test('workout csv', () => {
  const csv = workoutsToCsv(
    [{ id: 'w1', date: '2026-11-02', name: 'Legs', templateId: null, note: '', startedAt: 1, finishedAt: 2 }],
    [{ id: 's1', workoutId: 'w1', exerciseId: 'e1', order: 0, reps: 5, weight: 100, distance: 0, durationSec: 0, done: true }],
    [{ id: 'e1', name: 'Squat', kind: 'strength' }],
  );
  expect(csv.split('\n')[1]).toBe('2026-11-02,Legs,Squat,1,5,100,0,0');
});
