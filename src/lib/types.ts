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

export interface Habit {
  id: string;
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
}

export interface Settings {
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  skipsPerMonth: number;
  /** ISO timestamp of the last export, '' if never. */
  lastBackupAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  quietEnabled: true,
  quietStart: '22:30',
  quietEnd: '07:00',
  skipsPerMonth: 3,
  lastBackupAt: '',
};

/** habitId -> date key -> entry */
export type EntryIndex = Map<string, Map<string, Entry>>;
