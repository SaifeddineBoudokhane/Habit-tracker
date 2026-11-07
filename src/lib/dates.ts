/** Date helpers working on local-time date keys ("YYYY-MM-DD"). */

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parts(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** Local midnight of the given key. */
export function fromKey(key: string): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): string {
  return toKey(now);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = parts(key);
  // Noon avoids DST edge cases.
  return toKey(new Date(y, m - 1, d + n, 12));
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function weekday(key: string): number {
  return fromKey(key).getDay();
}

/** Monday of the week containing key. */
export function weekStart(key: string): string {
  const wd = weekday(key);
  return addDays(key, -((wd + 6) % 7));
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

export function minKey(a: string, b: string): string {
  return a < b ? a : b;
}

/** "HH:MM" -> minutes since midnight. */
export function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

/** Local Date for a date key plus minutes since midnight. */
export function atTime(key: string, minutes: number): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayShort(i: number): string {
  return WEEKDAY_SHORT[i];
}

export function prettyDate(key: string, today: string): string {
  const diff = diffDays(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const d = fromKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function monthLabel(key: string): string {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
