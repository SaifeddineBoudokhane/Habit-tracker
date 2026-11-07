import type { Exercise, Workout, WorkoutSet } from '../types';
import { e1rm, formatDuration, formatPace, personalRecords, previousSets, progressSeries, summarize } from '../workouts';

const squat: Exercise = { id: 'sq', name: 'Squat', kind: 'strength' };
const run: Exercise = { id: 'run', name: 'Running', kind: 'cardio' };

const w = (id: string, date: string, t: number, finished = true): Workout => ({
  id, date, name: '', templateId: null, note: '', startedAt: t, finishedAt: finished ? t + 3600_000 : null,
});
let n = 0;
const set = (workoutId: string, exerciseId: string, over: Partial<WorkoutSet>): WorkoutSet => ({
  id: `s${n++}`, workoutId, exerciseId, order: n, reps: 0, weight: 0, distance: 0, durationSec: 0, done: true, ...over,
});

const workouts = [w('a', '2026-11-01', 1000), w('b', '2026-11-03', 2000), w('c', '2026-11-05', 3000, false)];
const sets = [
  set('a', 'sq', { reps: 5, weight: 100 }),
  set('a', 'sq', { reps: 5, weight: 100 }),
  set('b', 'sq', { reps: 3, weight: 110 }),
  set('b', 'sq', { reps: 8, weight: 80 }),
  set('c', 'sq', { reps: 1, weight: 200 }), // unfinished workout: ignored
  set('a', 'run', { distance: 5, durationSec: 1500 }),
  set('b', 'run', { distance: 10, durationSec: 3300 }),
];

test('e1rm', () => {
  expect(e1rm(100, 1)).toBe(100);
  expect(e1rm(100, 5)).toBeCloseTo(116.67, 1);
  expect(e1rm(0, 5)).toBe(0);
});

test('strength PRs ignore unfinished workouts', () => {
  const prs = Object.fromEntries(personalRecords(squat, sets, workouts).map((p) => [p.label, p]));
  expect(prs['Heaviest weight'].value).toBe('110 kg × 3');
  expect(prs['Most reps (one set)'].value).toBe('8 @ 80 kg');
  expect(prs['Best est. 1RM'].value).toBe('121 kg'); // 110×3 = 121 beats 100×5 = 116.7
});

test('cardio PRs', () => {
  const prs = Object.fromEntries(personalRecords(run, sets, workouts).map((p) => [p.label, p.value]));
  expect(prs['Longest distance']).toBe('10 km');
  expect(prs['Best pace']).toBe('5:00 /km');
});

test('progress series is ordered and per workout', () => {
  expect(progressSeries(squat, sets, workouts).map((p) => p.date)).toEqual(['2026-11-01', '2026-11-03']);
  expect(progressSeries(run, sets, workouts).map((p) => p.value)).toEqual([5, 10]);
});

test('previous sets come from the last finished workout', () => {
  const prev = previousSets('sq', workouts[2], sets, workouts);
  expect(prev.map((s) => s.weight)).toEqual([110, 80]);
});

test('summary and formatting', () => {
  expect(summarize(workouts[0], sets)).toEqual({ exercises: 2, sets: 3, volume: 1000, durationSec: 3600 });
  expect(formatDuration(65)).toBe('1:05');
  expect(formatDuration(3725)).toBe('1:02:05');
  expect(formatPace(10, 3300)).toBe('5:30 /km');
});
