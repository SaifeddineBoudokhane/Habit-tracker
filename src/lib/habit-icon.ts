import { HABIT_ICONS } from '@/constants/icons';

import type { Habit } from './types';

export type HabitIconName = keyof typeof HABIT_ICONS;

export const HABIT_ICON_NAMES = Object.keys(HABIT_ICONS) as HabitIconName[];
export const DEFAULT_HABIT_ICON: HabitIconName = 'check_circle';

export const isHabitIcon = (v: unknown): v is HabitIconName => typeof v === 'string' && v in HABIT_ICONS;

/** Best-guess icon for a habit name (used until you pick one yourself). */
const NAME_RULES: [RegExp, HabitIconName][] = [
  [/water|hydrat/i, 'water_drop'],
  [/drink|juice|tea\b/i, 'local_drink'],
  [/coffee|caffeine/i, 'local_cafe'],
  [/smok|cigar|vape/i, 'smoke_free'],
  [/alcohol|beer|wine|booze/i, 'no_drinks'],
  [/sugar|sweet|candy|snack|junk/i, 'cookie'],
  [/phone|social|scroll|screen|instagram|tiktok/i, 'mobile_off'],
  [/study|course|homework|revis/i, 'auto_stories'],
  [/read|book/i, 'menu_book'],
  [/run|jog|sprint/i, 'directions_run'],
  [/steps/i, 'steps'],
  [/walk/i, 'directions_walk'],
  [/hike|hiking/i, 'hiking'],
  [/stretch|yoga|mobility/i, 'sports_gymnastics'],
  [/gym|workout|lift|push.?up|pull.?up|squat|train|exercise|abs\b/i, 'fitness_center'],
  [/meditat|breath|mindful/i, 'self_improvement'],
  [/sleep|bed\b|nap/i, 'bedtime'],
  [/teeth|floss|brush.*teeth/i, 'dentistry'],
  [/vitamin|supplement|creatine/i, 'pill'],
  [/pill|medic/i, 'medication'],
  [/journal|diary|gratitude/i, 'edit_note'],
  [/write|writing|blog/i, 'ink_pen'],
  [/piano|keyboard/i, 'piano'],
  [/guitar|music|sing|practice/i, 'music_note'],
  [/clean|tidy|chore|laundry|dishes/i, 'cleaning_services'],
  [/cook|meal prep/i, 'restaurant'],
  [/eat|veg|fruit|diet|salad|protein/i, 'nutrition'],
  [/bike|cycl/i, 'pedal_bike'],
  [/swim/i, 'pool'],
  [/football|soccer|tennis|basket|sport/i, 'sports_soccer'],
  [/language|spanish|french|english|arabic|german|duolingo/i, 'translate'],
  [/code|program|leetcode/i, 'code'],
  [/draw|paint|art\b|sketch/i, 'palette'],
  [/learn|school|class/i, 'school'],
  [/pray|quran|bible|church|mosque/i, 'volunteer_activism'],
  [/save|money|budget|spend/i, 'savings'],
  [/work|job|email/i, 'work'],
  [/plant|garden/i, 'potted_plant'],
  [/sun|outside|outdoor/i, 'sunny'],
  [/focus|deep work/i, 'target'],
];

export function guessIcon(name: string): HabitIconName | null {
  for (const [re, icon] of NAME_RULES) if (re.test(name)) return icon;
  return null;
}

/** Emojis the app used to suggest, mapped to their icon (habits created before icons existed). */
const EMOJI_MAP: Record<string, HabitIconName> = {
  '💪': 'fitness_center',
  '🏋️': 'fitness_center',
  '🏃': 'directions_run',
  '💧': 'water_drop',
  '📖': 'menu_book',
  '📚': 'auto_stories',
  '🧘': 'self_improvement',
  '🥗': 'nutrition',
  '😴': 'bedtime',
  '🦷': 'dentistry',
  '💊': 'pill',
  '🚭': 'smoke_free',
  '🍬': 'cookie',
  '📵': 'mobile_off',
  '✍️': 'edit_note',
  '🎸': 'music_note',
  '🎹': 'piano',
  '🧹': 'cleaning_services',
  '🚶': 'directions_walk',
  '🚴': 'pedal_bike',
  '🏊': 'pool',
  '🤸': 'sports_gymnastics',
  '🎓': 'school',
  '🤲': 'volunteer_activism',
  '☕': 'local_cafe',
  '💰': 'savings',
  '🌱': 'potted_plant',
  '❤️': 'favorite',
  '🎯': 'target',
  '✅': 'check_circle',
};

// Emoji may or may not carry the U+FE0F presentation selector ("✍️" vs "✍"): compare without it.
const bare = (e: string) => e.replace(/️/g, '');
const EMOJI_LOOKUP = new Map(Object.entries(EMOJI_MAP).map(([e, icon]) => [bare(e), icon]));

/** The icon to show for a habit: the one picked, else a guess from the old emoji or the name. */
export function habitIcon(h: Pick<Habit, 'name'> & { icon?: string; emoji?: string }): HabitIconName {
  if (isHabitIcon(h.icon)) return h.icon;
  const fromEmoji = h.emoji ? EMOJI_LOOKUP.get(bare(h.emoji)) : undefined;
  if (fromEmoji && fromEmoji !== DEFAULT_HABIT_ICON) return fromEmoji;
  return guessIcon(h.name) ?? fromEmoji ?? DEFAULT_HABIT_ICON;
}

/** A Material path as a standalone SVG string (widgets draw SVG, not React views). */
export function svgPath(d: string, color: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -960 960 960"><path fill="${color}" d="${d}"/></svg>`;
}
