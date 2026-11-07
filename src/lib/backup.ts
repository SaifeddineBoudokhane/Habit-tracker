import type { Entry, Habit, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

export interface Backup {
  app: 'habit-tracker';
  version: 1;
  exportedAt: string;
  habits: Habit[];
  entries: Entry[];
  settings: Settings;
}

export function makeBackup(habits: Habit[], entries: Entry[], settings: Settings, now = new Date()): Backup {
  return { app: 'habit-tracker', version: 1, exportedAt: now.toISOString(), habits, entries, settings };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse and validate a backup file. Throws with a readable message if it's not usable. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const b = raw as Partial<Backup>;
  if (!b || b.app !== 'habit-tracker') throw new Error('This is not a Habit Tracker backup.');
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${String(b.version)}`);
  if (!Array.isArray(b.habits) || !Array.isArray(b.entries)) throw new Error('Backup is missing data.');
  const ids = new Set<string>();
  for (const h of b.habits) {
    if (typeof h?.id !== 'string' || typeof h.name !== 'string' || !h.schedule || !DATE_RE.test(h.startDate))
      throw new Error('Backup contains an invalid habit.');
    h.reminders ??= [];
    ids.add(h.id);
  }
  const entries = b.entries.filter(
    (e) => ids.has(e?.habitId) && DATE_RE.test(e.date) && typeof e.value === 'number',
  );
  return {
    app: 'habit-tracker',
    version: 1,
    exportedAt: String(b.exportedAt ?? ''),
    habits: b.habits,
    entries: entries.map((e) => ({ ...e, skipped: !!e.skipped })),
    settings: { ...DEFAULT_SETTINGS, ...(b.settings ?? {}) },
  };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(habits: Habit[], entries: Entry[]): string {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const rows = [...entries].sort((a, b) => (a.date === b.date ? a.habitId.localeCompare(b.habitId) : a.date < b.date ? -1 : 1));
  const lines = ['date,habit,kind,value,unit,skipped'];
  for (const e of rows) {
    const h = byId.get(e.habitId);
    if (!h) continue;
    lines.push([e.date, h.name, h.kind, e.value, h.unit, e.skipped ? 'yes' : ''].map(csvCell).join(','));
  }
  return lines.join('\n');
}
