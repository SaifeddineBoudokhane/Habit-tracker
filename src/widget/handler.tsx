import type { HexColor, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { emptyEntry, tapped } from '@/data/actions';
import { buildIndex, getEntryRow, loadAll, putEntry } from '@/data/db';
import { todayKey } from '@/lib/dates';
import { getEntry, isComplete, isDueOn, isSlip } from '@/lib/schedule';
import type { HabitGroup } from '@/lib/types';
import { syncReminders } from '@/notifications/scheduler';

import { TodayWidget, type WidgetModel } from './today-widget';

export const WIDGET_NAME = 'Today';
const GROUP_ORDER: HabitGroup[] = ['morning', 'afternoon', 'evening', 'anytime'];

async function buildModel(): Promise<WidgetModel> {
  const { habits, entries } = await loadAll();
  const index = buildIndex(entries);
  const today = todayKey();
  const due = habits
    .filter((h) => isDueOn(h, index, today))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group ?? 'anytime') - GROUP_ORDER.indexOf(b.group ?? 'anytime') || a.sortOrder - b.sortOrder);
  const rows = due.map((h) => {
    const e = getEntry(index, h.id, today);
    const done = h.kind === 'avoid' ? false : isComplete(h, e) || !!e?.skipped;
    let status = done ? '✓' : '○';
    if (e?.skipped) status = 'skip';
    else if (h.kind === 'count' || h.kind === 'duration') status = done ? '✓' : `${e?.value ?? 0}/${h.target}`;
    else if (h.kind === 'avoid') status = isSlip(h, e) ? 'slipped' : '🛡️';
    return {
      id: h.id,
      emoji: h.emoji,
      name: h.name,
      status,
      done,
      color: (/^#[0-9a-f]{6}$/i.test(h.color) ? h.color : '#2563eb') as HexColor,
      tappable: h.kind !== 'avoid',
    };
  });
  const trackable = rows.filter((r) => r.tappable);
  return { rows, done: trackable.filter((r) => r.done).length, total: trackable.length };
}

/** Android picks the variant matching the phone's light/dark mode. */
function render(model: WidgetModel) {
  return { light: <TodayWidget model={model} dark={false} />, dark: <TodayWidget model={model} dark /> };
}

/** Runs headlessly when Android asks the widget to draw or when a row is tapped. */
export async function widgetTaskHandler({ widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TAP' && typeof clickActionData?.habitId === 'string') {
    const { habits } = await loadAll();
    const habit = habits.find((h) => h.id === clickActionData.habitId);
    if (habit) {
      const today = todayKey();
      const e = (await getEntryRow(habit.id, today)) ?? emptyEntry(habit.id, today);
      await putEntry(tapped(habit, e));
      await syncReminders().catch(() => {});
    }
  }
  renderWidget(render(await buildModel()));
}

/** Redraw the widget after data changed inside the app. Safe to call often; no-op without a widget. */
export async function refreshWidget(): Promise<void> {
  try {
    const model = await buildModel();
    await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => render(model) });
  } catch {
    // No widget placed, or not Android.
  }
}
