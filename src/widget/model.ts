import type { HexColor } from 'react-native-android-widget';

import { buildIndex, loadAll } from '@/data/db';
import { addDays, todayKey, weekday } from '@/lib/dates';
import { habitIcon, type HabitIconName } from '@/lib/habit-icon';
import { encouragement, streakInfo, type Encouragement } from '@/lib/motivation';
import { getEntry, isComplete, isDueOn, isSlip } from '@/lib/schedule';
import { cellFor, type CellStatus } from '@/lib/stats';
import type { HabitGroup, Settings } from '@/lib/types';

const GROUP_ORDER: HabitGroup[] = ['morning', 'afternoon', 'evening', 'anytime'];
export const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#2563eb') as HexColor;

export interface TodayRow {
  id: string;
  icon: HabitIconName;
  name: string;
  /** Short progress text for count/duration habits ("3/8"), '' otherwise. */
  status: string;
  done: boolean;
  skipped: boolean;
  /** 0..1, drawn as a ring around the icon. */
  progress: number;
  /** Avoid habit that slipped today. */
  slipped: boolean;
  avoid: boolean;
  streak: number;
  color: HexColor;
  /** Avoid habits open the app instead of logging from the widget. */
  tappable: boolean;
}

export interface HabitCard {
  id: string;
  icon: HabitIconName;
  avoid: boolean;
  slipped: boolean;
  name: string;
  color: HexColor;
  done: boolean;
  /** 0..1 for the progress ring. */
  progress: number;
  status: string;
  streak: number;
  best: number;
  streakUnit: string;
  message: string;
  tappable: boolean;
}

export interface WeekRow {
  id: string;
  icon: HabitIconName;
  name: string;
  color: HexColor;
  cells: CellStatus[];
}

export interface WidgetData {
  rows: TodayRow[];
  done: number;
  total: number;
  message: Encouragement;
  topStreaks: { icon: HabitIconName; name: string; current: number; unit: string; color: HexColor; doneToday: boolean; avoid: boolean }[];
  /** e.g. "Sunday" */
  dayName: string;
  week: { labels: string[]; rows: WeekRow[] };
  habits: Map<string, HabitCard>;
  settings: Settings;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function buildWidgetData(): Promise<WidgetData> {
  const data = await loadAll();
  const index = buildIndex(data.entries);
  const today = todayKey();
  const active = data.habits.filter((h) => !h.archived);
  const info = new Map(streakInfo(active, index, today).map((i) => [i.habit.id, i]));

  const due = active
    .filter((h) => isDueOn(h, index, today))
    .sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.group ?? 'anytime') - GROUP_ORDER.indexOf(b.group ?? 'anytime') || a.sortOrder - b.sortOrder,
    );

  const rows: TodayRow[] = due.map((h) => {
    const e = getEntry(index, h.id, today);
    const value = e?.value ?? 0;
    const done = h.kind !== 'avoid' && (isComplete(h, e) || !!e?.skipped);
    const numeric = h.kind === 'count' || h.kind === 'duration';
    const slipped = isSlip(h, e);
    return {
      id: h.id,
      icon: habitIcon(h),
      name: h.name,
      status: numeric && !done ? `${value}/${h.target}` : h.kind === 'avoid' && !slipped ? `${info.get(h.id)?.current ?? 0}d` : '',
      done,
      skipped: !!e?.skipped,
      progress: h.kind === 'avoid' ? (slipped ? 0 : 1) : done ? 1 : numeric ? Math.min(1, value / Math.max(1, h.target)) : 0,
      slipped,
      avoid: h.kind === 'avoid',
      streak: h.kind === 'avoid' ? 0 : (info.get(h.id)?.current ?? 0),
      color: hex(h.color),
      tappable: h.kind !== 'avoid',
    };
  });
  const trackable = rows.filter((r) => r.tappable);

  const habits = new Map<string, HabitCard>();
  for (const h of active) {
    const e = getEntry(index, h.id, today);
    const i = info.get(h.id);
    const value = e?.value ?? 0;
    const done = h.kind !== 'avoid' && (isComplete(h, e) || !!e?.skipped);
    const slipped = isSlip(h, e);
    const current = i?.current ?? 0;
    const unit = i?.unit === 'weeks' ? 'wk' : current === 1 ? 'day' : 'days';
    let status: string;
    if (h.kind === 'avoid') status = slipped ? 'Slipped today' : `${current} days clean`;
    else if (e?.skipped) status = 'Rest day';
    else if (h.kind === 'check') status = done ? 'Done' : 'Tap to log';
    else status = done ? 'Done' : `${value} / ${h.target} ${h.kind === 'duration' ? 'min' : h.unit}`.trim();
    let message: string;
    if (h.kind === 'avoid') message = slipped ? 'Tomorrow is a new start.' : 'Stay strong.';
    else if (done) message = current > 1 ? 'Streak safe for today.' : 'Nice work!';
    else if (!i?.dueToday) message = 'Not due today.';
    else if (current > 0) message = `Don't break the ${current}-${i?.unit === 'weeks' ? 'week' : 'day'} streak!`;
    else message = 'Start a new streak today.';
    habits.set(h.id, {
      id: h.id,
      icon: habitIcon(h),
      avoid: h.kind === 'avoid',
      slipped,
      name: h.name,
      color: hex(h.color),
      done,
      progress: h.kind === 'avoid' ? (slipped ? 0 : 1) : h.kind === 'check' ? (done ? 1 : 0) : Math.min(1, value / Math.max(1, h.target)),
      status,
      streak: current,
      best: i?.best ?? 0,
      streakUnit: unit,
      message,
      tappable: h.kind !== 'avoid',
    });
  }

  const topStreaks = [...info.values()]
    .filter((i) => i.current > 0)
    .sort((a, b) => b.current - a.current)
    .slice(0, 4)
    .map((i) => ({
      icon: habitIcon(i.habit),
      avoid: i.habit.kind === 'avoid',
      name: i.habit.name,
      current: i.current,
      unit: i.unit === 'weeks' ? 'wk' : 'd',
      color: hex(i.habit.color),
      doneToday: i.doneToday,
    }));

  const days = Array.from({ length: 7 }, (_, k) => addDays(today, k - 6));
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const week = {
    labels: days.map((d) => letters[weekday(d)]),
    rows: active.slice(0, 8).map((h) => ({
      id: h.id,
      icon: habitIcon(h),
      name: h.name,
      color: hex(h.color),
      cells: days.map((d) => cellFor(h, index, d, today).status),
    })),
  };

  return {
    rows,
    done: trackable.filter((r) => r.done).length,
    total: trackable.length,
    message: encouragement(active, index, today),
    topStreaks,
    dayName: DAY_NAMES[weekday(today)],
    week,
    habits,
    settings: data.settings,
  };
}
