import type { Entry, Exercise, Goal, Habit, Settings, Workout, WorkoutSet, WorkoutTemplate } from './types';
import { DEFAULT_SETTINGS } from './types';

export interface BackupData {
  habits: Habit[];
  entries: Entry[];
  settings: Settings;
  goals: Goal[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  workouts: Workout[];
  sets: WorkoutSet[];
}

export interface Backup extends BackupData {
  app: 'habit-tracker';
  version: 2;
  exportedAt: string;
}

export function makeBackup(data: BackupData, now = new Date()): Backup {
  // Running timers are device state, not worth restoring.
  return { app: 'habit-tracker', version: 2, exportedAt: now.toISOString(), ...data, settings: { ...data.settings, timers: {} } };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Parse and validate a backup file (v1 or v2). Throws with a readable message if it's not usable. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const b = raw as Partial<Backup> & { version?: number };
  if (!b || b.app !== 'habit-tracker') throw new Error('This is not a Habit Tracker backup.');
  const version = b.version as number | undefined;
  if (version !== 1 && version !== 2) throw new Error(`Unsupported backup version: ${String(b.version)}`);
  if (!Array.isArray(b.habits) || !Array.isArray(b.entries)) throw new Error('Backup is missing data.');

  const ids = new Set<string>();
  for (const h of b.habits) {
    if (typeof h?.id !== 'string' || typeof h.name !== 'string' || !h.schedule || !DATE_RE.test(h.startDate))
      throw new Error('Backup contains an invalid habit.');
    h.reminders ??= [];
    ids.add(h.id);
  }
  const entries = b.entries
    .filter((e) => ids.has(e?.habitId) && DATE_RE.test(e.date) && typeof e.value === 'number')
    .map((e) => ({ ...e, skipped: !!e.skipped }));

  const exercises = arr<Exercise>(b.exercises).filter((x) => typeof x?.id === 'string' && typeof x.name === 'string');
  const exIds = new Set(exercises.map((x) => x.id));
  const workouts = arr<Workout>(b.workouts).filter((w) => typeof w?.id === 'string' && DATE_RE.test(w.date));
  const wIds = new Set(workouts.map((w) => w.id));
  const sets = arr<WorkoutSet>(b.sets).filter((s) => wIds.has(s?.workoutId) && exIds.has(s.exerciseId));
  const templates = arr<WorkoutTemplate>(b.templates)
    .filter((t) => typeof t?.id === 'string')
    .map((t) => ({ ...t, exerciseIds: arr<string>(t.exerciseIds).filter((id) => exIds.has(id)) }));
  const goals = arr<Goal>(b.goals).filter((g) => ids.has(g?.habitId) && DATE_RE.test(g.start) && DATE_RE.test(g.end));

  return {
    app: 'habit-tracker',
    version: 2,
    exportedAt: String(b.exportedAt ?? ''),
    habits: b.habits,
    entries,
    settings: { ...DEFAULT_SETTINGS, ...(b.settings ?? {}), timers: {} },
    goals,
    exercises,
    templates,
    workouts,
    sets,
  };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(habits: Habit[], entries: Entry[]): string {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const rows = [...entries].sort((a, b) =>
    a.date === b.date ? a.habitId.localeCompare(b.habitId) : a.date < b.date ? -1 : 1,
  );
  const lines = ['date,habit,kind,value,unit,skipped,note'];
  for (const e of rows) {
    const h = byId.get(e.habitId);
    if (!h) continue;
    lines.push([e.date, h.name, h.kind, e.value, h.unit, e.skipped ? 'yes' : '', e.note ?? ''].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function workoutsToCsv(workouts: Workout[], sets: WorkoutSet[], exercises: Exercise[]): string {
  const ex = new Map(exercises.map((e) => [e.id, e]));
  const wk = new Map(workouts.map((w) => [w.id, w]));
  const lines = ['date,workout,exercise,set,reps,weight_kg,distance_km,duration_s'];
  const rows = sets
    .filter((s) => wk.has(s.workoutId) && ex.has(s.exerciseId))
    .sort((a, b) => wk.get(a.workoutId)!.startedAt - wk.get(b.workoutId)!.startedAt || a.order - b.order);
  for (const s of rows) {
    const w = wk.get(s.workoutId)!;
    lines.push(
      [w.date, w.name, ex.get(s.exerciseId)!.name, s.order + 1, s.reps, s.weight, s.distance, s.durationSec]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
