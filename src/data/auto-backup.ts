import { Directory, File } from 'expo-file-system';

import { makeBackup } from '@/lib/backup';
import type { Settings } from '@/lib/types';

import { loadAll, patchSettings } from './db';

const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const LATEST = 'habit-tracker-latest';

/** Lets you pick a folder (e.g. Documents or Downloads). Files there survive uninstalling the app. */
export async function pickBackupFolder(): Promise<string> {
  const dir = await Directory.pickDirectoryAsync();
  return dir.uri;
}

/** Human-readable folder name from a content:// tree URI. */
export function folderLabel(uri: string): string {
  if (!uri) return '';
  const last = decodeURIComponent(uri).split('/').pop() ?? uri;
  return last.replace(/^primary:/, 'Internal storage/');
}

function writeNamed(dir: Directory, base: string, json: string): Promise<void> {
  const existing = dir
    .list()
    .find((f): f is File => f instanceof File && (f.name === `${base}.json` || f.name === base));
  const file = existing ?? dir.createFile(`${base}.json`, 'application/json');
  return file.write(json);
}

/**
 * Writes `habit-tracker-latest.json` and a per-month copy (`habit-tracker-2026-11.json`) to the chosen folder.
 * Runs at most about once a day unless forced. Returns the settings it changed, or null if it didn't run.
 */
export async function runAutoBackup(force = false): Promise<Partial<Settings> | null> {
  const data = await loadAll();
  const s = data.settings;
  if (!s.autoBackupDir) return null;
  if (!force && s.lastAutoBackupAt && Date.now() - Date.parse(s.lastAutoBackupAt) < MIN_INTERVAL_MS) return null;
  let patch: Partial<Settings>;
  try {
    const now = new Date();
    const json = JSON.stringify(makeBackup(data, now));
    const dir = new Directory(s.autoBackupDir);
    await writeNamed(dir, LATEST, json);
    await writeNamed(dir, `habit-tracker-${now.toISOString().slice(0, 7)}`, json);
    patch = { lastAutoBackupAt: now.toISOString(), autoBackupError: '' };
  } catch (e) {
    patch = { autoBackupError: e instanceof Error ? e.message : String(e) };
  }
  await patchSettings(patch);
  return patch;
}
