import * as SQLite from 'expo-sqlite';

import type { Entry, Habit, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

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
  return db;
}

type EntryRow = { habit_id: string; date: string; value: number; skipped: number };

export async function loadAll(): Promise<{ habits: Habit[]; entries: Entry[]; settings: Settings }> {
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
  return {
    habits: habitRows.map((r) => JSON.parse(r.data) as Habit),
    entries: entryRows.map((r) => ({ habitId: r.habit_id, date: r.date, value: r.value, skipped: !!r.skipped })),
    settings,
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
    await db.runAsync('DELETE FROM habits WHERE id = ?', id);
  });
}

export async function getEntryRow(habitId: string, date: string): Promise<Entry | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE habit_id = ? AND date = ?', habitId, date);
  return r ? { habitId: r.habit_id, date: r.date, value: r.value, skipped: !!r.skipped } : null;
}

/** Writes the entry, or deletes it when it holds nothing. */
export async function putEntry(e: Entry): Promise<void> {
  const db = await getDb();
  if (e.value <= 0 && !e.skipped) {
    await db.runAsync('DELETE FROM entries WHERE habit_id = ? AND date = ?', e.habitId, e.date);
    return;
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO entries (habit_id, date, value, skipped) VALUES (?, ?, ?, ?)',
    e.habitId,
    e.date,
    e.value,
    e.skipped ? 1 : 0,
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

export async function replaceAll(habits: Habit[], entries: Entry[], settings: Settings): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM entries');
    await tx.runAsync('DELETE FROM habits');
    for (const h of habits) {
      await tx.runAsync('INSERT INTO habits (id, data, sort_order) VALUES (?, ?, ?)', h.id, JSON.stringify(h), h.sortOrder);
    }
    for (const e of entries) {
      await tx.runAsync(
        'INSERT OR REPLACE INTO entries (habit_id, date, value, skipped) VALUES (?, ?, ?, ?)',
        e.habitId,
        e.date,
        e.value,
        e.skipped ? 1 : 0,
      );
    }
    for (const [k, v] of Object.entries(settings)) {
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
