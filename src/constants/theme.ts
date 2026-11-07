import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#111214',
    textSecondary: '#62666d',
    background: '#f4f5f7',
    card: '#ffffff',
    border: '#e3e5e8',
    accent: '#2563eb',
    accentText: '#ffffff',
    danger: '#dc2626',
    success: '#16a34a',
    muted: '#eceef1',
  },
  dark: {
    text: '#f2f3f5',
    textSecondary: '#a0a4ab',
    background: '#0d0e10',
    card: '#1a1b1f',
    border: '#2a2c31',
    accent: '#4f8bff',
    accentText: '#ffffff',
    danger: '#f87171',
    success: '#4ade80',
    muted: '#26282d',
  },
};

export type Palette = typeof Colors.light;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}

/** Habit colors to pick from. */
/** Habit colors to pick from (any #RRGGBB can also be typed in). */
export const HABIT_COLORS = [
  '#ef4444', // red
  '#f43f5e', // rose
  '#ec4899', // pink
  '#d946ef', // fuchsia
  '#a855f7', // purple
  '#8b5cf6', // violet
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#22c55e', // green
  '#84cc16', // lime
  '#eab308', // yellow
  '#f59e0b', // amber
  '#f97316', // orange
  '#a16207', // brown
  '#64748b', // slate
  '#111827', // near black
];

export const isHexColor = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** Best-guess emoji for a habit name (used until you pick one yourself). */
const EMOJI_RULES: [RegExp, string][] = [
  [/water|drink|hydrat/i, '💧'],
  [/read|book/i, '📖'],
  [/run|jog/i, '🏃'],
  [/walk|steps/i, '🚶'],
  [/gym|workout|lift|push.?up|pull.?up|squat|train|exercise/i, '💪'],
  [/meditat|breath|mindful/i, '🧘'],
  [/sleep|bed/i, '😴'],
  [/teeth|floss/i, '🦷'],
  [/vitamin|pill|medic/i, '💊'],
  [/smok|cigar/i, '🚭'],
  [/sugar|sweet|candy/i, '🍬'],
  [/phone|social|scroll|screen/i, '📵'],
  [/write|journal/i, '✍️'],
  [/guitar|piano|music|practice/i, '🎸'],
  [/clean|tidy/i, '🧹'],
  [/eat|veg|fruit|diet|salad/i, '🥗'],
  [/bike|cycl/i, '🚴'],
  [/swim/i, '🏊'],
  [/stretch|yoga/i, '🤸'],
  [/study|learn|course/i, '🎓'],
  [/pray/i, '🤲'],
];

export function guessEmoji(name: string): string | null {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e;
  return null;
}

export const EMOJI_SUGGESTIONS = ['💪', '🏃', '💧', '📖', '🧘', '🥗', '😴', '🦷', '💊', '🚭', '🍬', '📵', '✍️', '🎸', '🧹', '🚶'];
