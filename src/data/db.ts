import * as SQLite from 'expo-sqlite';

import type { BackupData } from '@/lib/backup';
import type { Entry, Exercise, Goal, Habit, Settings, Workout, WorkoutSet, WorkoutTemplate } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { DEFAULT_EXERCISES } from '@/lib/workouts';

/**
 * One shared connection. Used by the UI and by background tasks
 * (notification actions, daily reminder refresh), so it is not tied to React.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= open();
  return dbPromise;
}

async function open() {
  const db = await SQLite.openDatabaseAsync('habits.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS entries (
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (habit_id, date)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  await migrate(db);
  return db;
}

/** Schema changes after the first release, applied once each (tracked with PRAGMA user_version). */
async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 2) {
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(entries)');
    await db.withTransactionAsync(async () => {
      if (!cols.some((c) => c.name === 'note')) await db.execAsync('ALTER TABLE entries ADD COLUMN note TEXT');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sets (
          id TEXT PRIMARY KEY NOT NULL,
          workout_id TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sets_workout ON sets (workout_id);
      `);
      for (const [i, ex] of DEFAULT_EXERCISES.entries()) {
        const e: Exercise = { id: `default-${i}`, ...ex };
        await db.runAsync('INSERT OR IGNORE INTO exercises (id, data) VALUES (?, ?)', e.id, JSON.stringify(e));
      }
      await db.execAsync('PRAGMA user_version = 2');
    });
  }
}

export type DocTable = 'goals' | 'exercises' | 'templates' | 'workouts';

async function listDocs<T>(db: SQLite.SQLiteDatabase, table: DocTable): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${table}`);
  return rows.map((r) => JSON.parse(r.data) as T);
}

export async function putDoc(table: DocTable, doc: { id: string }): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`, doc.id, JSON.stringify(doc));
}

export async function deleteDoc(table: DocTable, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
}

export async function putSet(s: WorkoutSet): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO sets (id, workout_id, data) VALUES (?, ?, ?)', s.id, s.workoutId, JSON.stringify(s));
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sets WHERE id = ?', id);
}

export async function deleteWorkout(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sets WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
}

type EntryRow = { habit_id: string; date: string; value: number; skipped: number; note: string | null };

const toEntry = (r: EntryRow): Entry => ({
  habitId: r.habit_id,
  date: r.date,
  value: r.value,
  skipped: !!r.skipped,
  ...(r.note ? { note: r.note } : {}),
});

export async function loadAll(): Promise<BackupData> {
  const db = await getDb();
  const habitRows = await db.getAllAsync<{ data: string }>('SELECT data FROM habits ORDER BY sort_order');
  const entryRows = await db.getAllAsync<EntryRow>('SELECT * FROM entries');
  const settingRows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings');
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const r of settingRows) {
    try {
      (settings as unknown as Record<string, unknown>)[r.key] = JSON.parse(r.value);
    } catch {
      // ignore corrupt setting, keep default
    }
  }
  const setRows = await db.getAllAsync<{ data: string }>('SELECT data FROM sets');
  return {
    habits: habitRows.map((r) => JSON.parse(r.data) as Habit),
    entries: entryRows.map(toEntry),
    settings,
    goals: await listDocs<Goal>(db, 'goals'),
    exercises: await listDocs<Exercise>(db, 'exercises'),
    templates: await listDocs<WorkoutTemplate>(db, 'templates'),
    workouts: await listDocs<Workout>(db, 'workouts'),
    sets: setRows.map((r) => JSON.parse(r.data) as WorkoutSet),
  };
}

export async function saveHabit(h: Habit): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO habits (id, data, sort_order) VALUES (?, ?, ?)',
    h.id,
    JSON.stringify(h),
    h.sortOrder,
  );
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM entries WHERE habit_id = ?', id);
    await db.runAsync("DELETE FROM goals WHERE json_extract(data, '$.habitId') = ?", id);
    await db.runAsync('DELETE FROM habits WHERE id = ?', id);
  });
}

export async function getEntryRow(habitId: string, date: string): Promise<Entry | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE habit_id = ? AND date = ?', habitId, date);
  return r ? toEntry(r) : null;
}

export function isEmptyEntry(e: Entry): boolean {
  return e.value <= 0 && !e.skipped && !e.note;
}

/** Writes the entry, or deletes it when it holds nothing. */
export async function putEntry(e: Entry): Promise<void> {
  const db = await getDb();
  if (isEmptyEntry(e)) {
    await db.runAsync('DELETE FROM entries WHERE habit_id = ? AND date = ?', e.habitId, e.date);
    return;
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO entries (habit_id, date, value, skipped, note) VALUES (?, ?, ?, ?, ?)',
    e.habitId,
    e.date,
    e.value,
    e.skipped ? 1 : 0,
    e.note || null,
  );
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [k, v] of Object.entries(s)) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', k, JSON.stringify(v));
    }
  });
}

export async function replaceAll(data: BackupData): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const t of ['entries', 'habits', 'goals', 'exercises', 'templates', 'workouts', 'sets']) {
      await tx.runAsync(`DELETE FROM ${t}`);
    }
    for (const h of data.habits) {
      await tx.runAsync('INSERT INTO habits (id, data, sort_order) VALUES (?, ?, ?)', h.id, JSON.stringify(h), h.sortOrder);
    }
    for (const e of data.entries) {
      await tx.runAsync(
        'INSERT OR REPLACE INTO entries (habit_id, date, value, skipped, note) VALUES (?, ?, ?, ?, ?)',
        e.habitId,
        e.date,
        e.value,
        e.skipped ? 1 : 0,
        e.note || null,
      );
    }
    const docs: [DocTable, { id: string }[]][] = [
      ['goals', data.goals],
      ['exercises', data.exercises],
      ['templates', data.templates],
      ['workouts', data.workouts],
    ];
    for (const [table, list] of docs) {
      for (const d of list) await tx.runAsync(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`, d.id, JSON.stringify(d));
    }
    for (const st of data.sets) {
      await tx.runAsync('INSERT OR REPLACE INTO sets (id, workout_id, data) VALUES (?, ?, ?)', st.id, st.workoutId, JSON.stringify(st));
    }
    for (const [k, v] of Object.entries(data.settings)) {
      await tx.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', k, JSON.stringify(v));
    }
  });
}

export function buildIndex(entries: Entry[]) {
  const index = new Map<string, Map<string, Entry>>();
  for (const e of entries) {
    let m = index.get(e.habitId);
    if (!m) index.set(e.habitId, (m = new Map()));
    m.set(e.date, e);
  }
  return index;
}

/**
 * Returns true the first time a key is claimed. Notification action taps can be delivered
 * to both the background task and the foreground listener; this makes sure they apply once.
 */
export async function claimOnce(key: string): Promise<boolean> {
  const db = await getDb();
  await db.execAsync('CREATE TABLE IF NOT EXISTS handled (key TEXT PRIMARY KEY NOT NULL, at INTEGER NOT NULL)');
  const now = Date.now();
  await db.runAsync('DELETE FROM handled WHERE at < ?', now - 7 * 86_400_000);
  const r = await db.runAsync('INSERT OR IGNORE INTO handled (key, at) VALUES (?, ?)', key, now);
  return r.changes === 1;
}
