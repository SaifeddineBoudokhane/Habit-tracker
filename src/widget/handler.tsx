import type { HexColor, WidgetInfo, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getWidgetInfo, requestWidgetUpdate, requestWidgetUpdateById } from 'react-native-android-widget';

import { emptyEntry, tapped } from '@/data/actions';
import { buildIndex, getEntryRow, loadAll, patchSettings, putEntry } from '@/data/db';
import { todayKey } from '@/lib/dates';
import { getEntry, isComplete, isDueOn, isSlip } from '@/lib/schedule';
import { computeStats } from '@/lib/streaks';
import type { Habit, HabitGroup } from '@/lib/types';
import { syncReminders } from '@/notifications/scheduler';

import { HabitWidget, type HabitWidgetModel } from './habit-widget';
import { TodayWidget, type WidgetModel } from './today-widget';

/** List of today's habits. */
export const TODAY_WIDGET = 'Today';
/** One chosen habit per widget; you can place as many as you like. */
export const HABIT_WIDGET = 'Habit';
const GROUP_ORDER: HabitGroup[] = ['morning', 'afternoon', 'evening', 'anytime'];

const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#2563eb') as HexColor;

function statusOf(h: Habit, index: ReturnType<typeof buildIndex>, today: string) {
  const e = getEntry(index, h.id, today);
  const done = h.kind === 'avoid' ? false : isComplete(h, e) || !!e?.skipped;
  let status = done ? '✓' : '○';
  if (e?.skipped) status = 'skip';
  else if (h.kind === 'count' || h.kind === 'duration') status = done ? '✓' : `${e?.value ?? 0}/${h.target}`;
  else if (h.kind === 'avoid') status = isSlip(h, e) ? 'slipped' : '🛡️';
  return { done, status };
}

async function buildTodayModel(): Promise<WidgetModel> {
  const data = await loadAll();
  const index = buildIndex(data.entries);
  const today = todayKey();
  const due = data.habits
    .filter((h) => isDueOn(h, index, today))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group ?? 'anytime') - GROUP_ORDER.indexOf(b.group ?? 'anytime') || a.sortOrder - b.sortOrder);
  const rows = due.map((h) => ({
    id: h.id,
    emoji: h.emoji,
    name: h.name,
    ...statusOf(h, index, today),
    color: hex(h.color),
    tappable: h.kind !== 'avoid',
  }));
  const trackable = rows.filter((r) => r.tappable);
  return { rows, done: trackable.filter((r) => r.done).length, total: trackable.length };
}

export async function buildHabitModel(habitId: string | undefined): Promise<HabitWidgetModel> {
  const data = await loadAll();
  const habit = data.habits.find((h) => h.id === habitId && !h.archived);
  if (!habit) return { habitId: null, emoji: '', name: '', status: '', sub: '', done: false, color: '#2563eb', tappable: false };
  const index = buildIndex(data.entries);
  const today = todayKey();
  const { done, status } = statusOf(habit, index, today);
  const st = computeStats(habit, index, today);
  const unit = habit.kind === 'count' ? habit.unit : habit.kind === 'duration' ? 'min' : '';
  let text = status;
  if (habit.kind === 'check') text = done ? 'Done ✓' : 'Tap to log';
  else if (habit.kind === 'avoid') text = isSlip(habit, getEntry(index, habit.id, today)) ? 'Slipped' : `${st.current} days clean`;
  else if (!done) text = `${status} ${unit}`.trim();
  const sub =
    habit.kind === 'avoid' ? '' : st.current > 0 ? `🔥 ${st.current} ${st.unit === 'weeks' ? 'wk' : st.current === 1 ? 'day' : 'days'}` : '';
  return { habitId: habit.id, emoji: habit.emoji, name: habit.name, status: text, sub, done, color: hex(habit.color), tappable: habit.kind !== 'avoid' };
}

/** Android picks the variant matching the phone's light/dark mode. */
function renderToday(model: WidgetModel) {
  return { light: <TodayWidget model={model} dark={false} />, dark: <TodayWidget model={model} dark /> };
}

export function renderHabit(model: HabitWidgetModel) {
  return { light: <HabitWidget model={model} dark={false} />, dark: <HabitWidget model={model} dark /> };
}

async function habitIdFor(widgetId: number): Promise<string | undefined> {
  const { settings } = await loadAll();
  return settings.widgetHabits?.[String(widgetId)];
}

/** Runs headlessly when Android asks a widget to draw or when it is tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') {
    if (widgetInfo.widgetName === HABIT_WIDGET) {
      const { settings } = await loadAll();
      const { [String(widgetInfo.widgetId)]: _, ...rest } = settings.widgetHabits ?? {};
      await patchSettings({ widgetHabits: rest });
    }
    return;
  }
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TAP' && typeof clickActionData?.habitId === 'string') {
    const { habits } = await loadAll();
    const habit = habits.find((h) => h.id === clickActionData.habitId);
    if (habit) {
      const today = todayKey();
      const e = (await getEntryRow(habit.id, today)) ?? emptyEntry(habit.id, today);
      await putEntry(tapped(habit, e));
      await syncReminders().catch(() => {});
      // Keep the other widgets in step with this tap.
      void refreshWidget({ except: widgetInfo });
    }
  }
  if (widgetInfo.widgetName === HABIT_WIDGET) {
    renderWidget(renderHabit(await buildHabitModel(await habitIdFor(widgetInfo.widgetId))));
  } else {
    renderWidget(renderToday(await buildTodayModel()));
  }
}

/** Redraw all widgets after data changed. Safe to call often; no-op when none are placed. */
export async function refreshWidget(opts: { except?: WidgetInfo } = {}): Promise<void> {
  try {
    const today = await buildTodayModel();
    await requestWidgetUpdate({ widgetName: TODAY_WIDGET, renderWidget: () => renderToday(today) });
  } catch {
    // No widget placed, or not Android.
  }
  try {
    const { settings } = await loadAll();
    for (const w of await getWidgetInfo(HABIT_WIDGET)) {
      if (opts.except?.widgetName === HABIT_WIDGET && opts.except.widgetId === w.widgetId) continue;
      const model = await buildHabitModel(settings.widgetHabits?.[String(w.widgetId)]);
      await requestWidgetUpdateById({ widgetName: HABIT_WIDGET, widgetId: w.widgetId, renderWidget: () => renderHabit(model) });
    }
  } catch {
    // ignore
  }
}
