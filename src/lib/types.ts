export type HabitKind = 'check' | 'count' | 'duration' | 'avoid';

/** 0 = Sunday ... 6 = Saturday (same as Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: Weekday[] }
  | { type: 'perWeek'; times: number }
  | { type: 'everyN'; n: number };

export type Reminder =
  | { id: string; kind: 'fixed'; time: string }
  | { id: string; kind: 'interval'; everyMin: number; start: string; end: string };

export type HabitGroup = 'anytime' | 'morning' | 'afternoon' | 'evening';

export interface Habit {
  id: string;
  /** Section on the Today screen. Missing = 'anytime'. */
  group?: HabitGroup;
  name: string;
  emoji: string;
  color: string;
  kind: HabitKind;
  /** Daily target for count/duration habits (minutes for duration). 1 for check/avoid. */
  target: number;
  unit: string;
  schedule: Schedule;
  reminders: Reminder[];
  archived: boolean;
  sortOrder: number;
  /** Date key (YYYY-MM-DD) of the first tracked day. */
  startDate: string;
}

/**
 * One row per habit per day.
 * - check: value 1 = done
 * - count / duration: value accumulates, complete when value >= target
 * - avoid: value >= 1 means "slipped" that day
 * `skipped` marks a rest/sick day that neither extends nor breaks a streak.
 */
export interface Entry {
  habitId: string;
  date: string;
  value: number;
  skipped: boolean;
  /** Optional note, e.g. "felt weak, slept 5h". */
  note?: string;
}

export interface Settings {
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  skipsPerMonth: number;
  /** ISO timestamp of the last export, '' if never. */
  lastBackupAt: string;
  /** Require fingerprint / screen lock to open the app. */
  appLock: boolean;
  /** Default rest between sets, in seconds. */
  restSeconds: number;
  /** Habit ticked automatically when a workout is finished ('' = none). */
  workoutHabitId: string;
  /** Running duration timers: habitId -> start timestamp (ms). */
  timers: Record<string, number>;
  /** First day of the week for weekly quotas and stats: 1 = Monday, 0 = Sunday, 6 = Saturday. */
  weekStartDay: 0 | 1 | 6;
  /** Snooze length for the notification button, in minutes. */
  snoozeMinutes: number;
  /** Folder (Android content URI) for automatic backups, '' = off. */
  autoBackupDir: string;
  /** ISO time of the last successful automatic backup. */
  lastAutoBackupAt: string;
  /** Error message of the last failed automatic backup, '' if it worked. */
  autoBackupError: string;
  /** Single-habit widgets: widgetId -> habitId. */
  widgetHabits: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  quietEnabled: true,
  quietStart: '22:30',
  quietEnd: '07:00',
  skipsPerMonth: 3,
  lastBackupAt: '',
  appLock: false,
  restSeconds: 90,
  workoutHabitId: '',
  timers: {},
  weekStartDay: 1,
  snoozeMinutes: 15,
  autoBackupDir: '',
  lastAutoBackupAt: '',
  autoBackupError: '',
  widgetHabits: {},
};

/** habitId -> date key -> entry */
export type EntryIndex = Map<string, Map<string, Entry>>;

/**
 * A target total for a habit over a period, e.g. "Workout 150 times in 2026" (metric 'days')
 * or "Run 100 km this month" (metric 'value', summing logged values).
 */
export interface Goal {
  id: string;
  habitId: string;
  metric: 'days' | 'value';
  target: number;
  start: string;
  end: string;
}

export type ExerciseKind = 'strength' | 'bodyweight' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  archived?: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface Workout {
  id: string;
  date: string;
  name: string;
  templateId: string | null;
  note: string;
  startedAt: number;
  /** null while the workout is in progress. */
  finishedAt: number | null;
}

/** strength: reps × weight (kg); bodyweight: reps (+ optional added weight); cardio: distance (km) + duration (s). */
export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  /** Order within the workout. */
  order: number;
  reps: number;
  weight: number;
  distance: number;
  durationSec: number;
  done: boolean;
}
