import type { Exercise, Workout, WorkoutSet } from './types';

/** Estimated one-rep max (Epley). */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** A set counts once something was entered in it. */
export function isFilled(s: WorkoutSet): boolean {
  return s.reps > 0 || s.distance > 0 || s.durationSec > 0;
}

export function setVolume(s: WorkoutSet): number {
  return s.reps * s.weight;
}

export interface PR {
  label: string;
  value: string;
  date: string;
}

interface Ctx {
  sets: WorkoutSet[];
  workouts: Map<string, Workout>;
}

function filledSetsFor(exerciseId: string, { sets, workouts }: Ctx) {
  return sets.filter((s) => s.exerciseId === exerciseId && isFilled(s) && workouts.get(s.workoutId)?.finishedAt);
}

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export const fmtKg = (n: number) => `${round(n)} kg`;

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/** Minutes per km as "m:ss /km". */
export function formatPace(distanceKm: number, durationSec: number): string {
  if (distanceKm <= 0 || durationSec <= 0) return '–';
  return `${formatDuration(durationSec / distanceKm)} /km`;
}

/** Personal records for an exercise, based on finished workouts. */
export function personalRecords(exercise: Exercise, sets: WorkoutSet[], workouts: Workout[]): PR[] {
  const ctx: Ctx = { sets, workouts: new Map(workouts.map((w) => [w.id, w])) };
  const list = filledSetsFor(exercise.id, ctx);
  if (list.length === 0) return [];
  const dateOf = (s: WorkoutSet) => ctx.workouts.get(s.workoutId)!.date;
  const best = <T>(items: T[], score: (t: T) => number) =>
    items.reduce<T | null>((b, t) => (score(t) > (b ? score(b) : 0) ? t : b), null);

  // Per-session totals.
  const sessions = new Map<string, WorkoutSet[]>();
  for (const s of list) sessions.set(s.workoutId, [...(sessions.get(s.workoutId) ?? []), s]);
  const sessionList = [...sessions.entries()].map(([wid, ss]) => ({ date: ctx.workouts.get(wid)!.date, sets: ss }));

  const out: PR[] = [];
  if (exercise.kind === 'cardio') {
    const far = best(list, (s) => s.distance);
    if (far) out.push({ label: 'Longest distance', value: `${round(far.distance, 2)} km`, date: dateOf(far) });
    const long = best(list, (s) => s.durationSec);
    if (long) out.push({ label: 'Longest time', value: formatDuration(long.durationSec), date: dateOf(long) });
    const fast = best(
      list.filter((s) => s.distance > 0 && s.durationSec > 0),
      (s) => s.distance / s.durationSec,
    );
    if (fast) out.push({ label: 'Best pace', value: formatPace(fast.distance, fast.durationSec), date: dateOf(fast) });
    return out;
  }

  const reps = best(list, (s) => s.reps);
  if (reps) out.push({ label: 'Most reps (one set)', value: `${reps.reps}${reps.weight ? ` @ ${fmtKg(reps.weight)}` : ''}`, date: dateOf(reps) });
  const heavy = best(list, (s) => s.weight);
  if (heavy) out.push({ label: exercise.kind === 'bodyweight' ? 'Most added weight' : 'Heaviest weight', value: `${fmtKg(heavy.weight)} × ${heavy.reps}`, date: dateOf(heavy) });
  if (exercise.kind === 'strength') {
    const strong = best(list, (s) => e1rm(s.weight, s.reps));
    if (strong) out.push({ label: 'Best est. 1RM', value: fmtKg(e1rm(strong.weight, strong.reps)), date: dateOf(strong) });
    const vol = best(sessionList, (x) => x.sets.reduce((a, s) => a + setVolume(s), 0));
    if (vol) out.push({ label: 'Most volume (session)', value: fmtKg(vol.sets.reduce((a, s) => a + setVolume(s), 0)), date: vol.date });
  } else {
    const total = best(sessionList, (x) => x.sets.reduce((a, s) => a + s.reps, 0));
    if (total) out.push({ label: 'Most reps (session)', value: String(total.sets.reduce((a, s) => a + s.reps, 0)), date: total.date });
  }
  return out;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

/** One point per finished workout: best e1RM (strength), most reps (bodyweight), total km (cardio). */
export function progressSeries(exercise: Exercise, sets: WorkoutSet[], workouts: Workout[]): SeriesPoint[] {
  const ctx: Ctx = { sets, workouts: new Map(workouts.map((w) => [w.id, w])) };
  const byWorkout = new Map<string, number>();
  for (const s of filledSetsFor(exercise.id, ctx)) {
    const v =
      exercise.kind === 'cardio' ? s.distance : exercise.kind === 'bodyweight' ? s.reps : e1rm(s.weight, s.reps);
    const prev = byWorkout.get(s.workoutId) ?? 0;
    byWorkout.set(s.workoutId, exercise.kind === 'cardio' ? prev + v : Math.max(prev, v));
  }
  return [...byWorkout.entries()]
    .map(([wid, value]) => {
      const w = ctx.workouts.get(wid)!;
      return { date: w.date, value: round(value), t: w.startedAt };
    })
    .sort((a, b) => a.t - b.t)
    .map(({ date, value }) => ({ date, value }));
}

export function seriesLabel(exercise: Exercise): string {
  return exercise.kind === 'cardio' ? 'Distance (km)' : exercise.kind === 'bodyweight' ? 'Best set (reps)' : 'Est. 1RM (kg)';
}

/** Sets from the most recent earlier finished workout that included this exercise. */
export function previousSets(exerciseId: string, beforeWorkout: Workout, sets: WorkoutSet[], workouts: Workout[]): WorkoutSet[] {
  const candidates = workouts
    .filter((w) => w.id !== beforeWorkout.id && w.finishedAt && w.startedAt < beforeWorkout.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const w of candidates) {
    const ss = sets.filter((s) => s.workoutId === w.id && s.exerciseId === exerciseId && isFilled(s));
    if (ss.length) return ss.sort((a, b) => a.order - b.order);
  }
  return [];
}

export function describeSet(exercise: Exercise, s: WorkoutSet): string {
  if (exercise.kind === 'cardio') {
    const parts = [];
    if (s.distance) parts.push(`${round(s.distance, 2)} km`);
    if (s.durationSec) parts.push(formatDuration(s.durationSec));
    return parts.join(' in ') || '–';
  }
  if (exercise.kind === 'bodyweight') return s.weight ? `${s.reps} × +${round(s.weight)} kg` : `${s.reps} reps`;
  return `${round(s.weight)} kg × ${s.reps}`;
}

export interface WorkoutSummary {
  exercises: number;
  sets: number;
  volume: number;
  durationSec: number;
}

export function summarize(workout: Workout, sets: WorkoutSet[]): WorkoutSummary {
  const mine = sets.filter((s) => s.workoutId === workout.id && isFilled(s));
  return {
    exercises: new Set(mine.map((s) => s.exerciseId)).size,
    sets: mine.length,
    volume: mine.reduce((a, s) => a + setVolume(s), 0),
    durationSec: workout.finishedAt ? Math.round((workout.finishedAt - workout.startedAt) / 1000) : 0,
  };
}

export const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  { name: 'Bench Press', kind: 'strength' },
  { name: 'Squat', kind: 'strength' },
  { name: 'Deadlift', kind: 'strength' },
  { name: 'Overhead Press', kind: 'strength' },
  { name: 'Barbell Row', kind: 'strength' },
  { name: 'Lat Pulldown', kind: 'strength' },
  { name: 'Dumbbell Curl', kind: 'strength' },
  { name: 'Triceps Pushdown', kind: 'strength' },
  { name: 'Leg Press', kind: 'strength' },
  { name: 'Pull-up', kind: 'bodyweight' },
  { name: 'Push-up', kind: 'bodyweight' },
  { name: 'Dip', kind: 'bodyweight' },
  { name: 'Plank', kind: 'cardio' },
  { name: 'Running', kind: 'cardio' },
  { name: 'Cycling', kind: 'cardio' },
];
