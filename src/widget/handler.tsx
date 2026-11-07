import type { WidgetInfo, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getWidgetInfo, requestWidgetUpdateById } from 'react-native-android-widget';

import { emptyEntry, tapped } from '@/data/actions';
import { getEntryRow, loadAll, patchSettings, putEntry } from '@/data/db';
import { todayKey } from '@/lib/dates';
import { syncReminders } from '@/notifications/scheduler';

import { buildWidgetData, type WidgetData } from './model';
import { HabitWidget, StreaksWidget, TodayWidget, WeekWidget } from './widgets';

/** Widget names must match app.json (react-native-android-widget plugin). */
export const WIDGETS = {
  today: 'Today',
  habit: 'Habit',
  streaks: 'Streaks',
  week: 'Week',
} as const;

/** Android picks the variant matching the phone's light/dark mode. */
export function renderFor(name: string, widgetId: number, data: WidgetData) {
  const both = (make: (dark: boolean) => React.JSX.Element) => ({ light: make(false), dark: make(true) });
  switch (name) {
    case WIDGETS.habit: {
      const card = data.habits.get(data.settings.widgetHabits?.[String(widgetId)] ?? '') ?? null;
      return both((dark) => <HabitWidget card={card} widgetId={widgetId} dark={dark} />);
    }
    case WIDGETS.streaks:
      return both((dark) => <StreaksWidget data={data} dark={dark} />);
    case WIDGETS.week:
      return both((dark) => <WeekWidget data={data} dark={dark} />);
    default:
      return both((dark) => <TodayWidget data={data} dark={dark} />);
  }
}

async function logTap(habitId: string) {
  const { habits } = await loadAll();
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  const today = todayKey();
  const e = (await getEntryRow(habit.id, today)) ?? emptyEntry(habit.id, today);
  await putEntry(tapped(habit, e));
}

/** Runs headlessly when Android asks a widget to draw, or when it's tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  const { widgetName, widgetId } = widgetInfo;
  if (widgetAction === 'WIDGET_DELETED') {
    if (widgetName === WIDGETS.habit) {
      const { settings } = await loadAll();
      const { [String(widgetId)]: _, ...rest } = settings.widgetHabits ?? {};
      await patchSettings({ widgetHabits: rest });
    }
    return;
  }
  if (widgetAction === 'WIDGET_ADDED' && widgetName === WIDGETS.habit) {
    // Placed from a habit's "Add to home screen" button: assign that habit.
    const { settings } = await loadAll();
    if (settings.pendingWidgetHabit && !settings.widgetHabits?.[String(widgetId)]) {
      await patchSettings({ widgetHabits: { ...settings.widgetHabits, [String(widgetId)]: settings.pendingWidgetHabit }, pendingWidgetHabit: '' });
    }
  }
  const tappedHabit = widgetAction === 'WIDGET_CLICK' && clickAction === 'TAP' && typeof clickActionData?.habitId === 'string';
  if (tappedHabit) await logTap(clickActionData!.habitId as string);

  const data = await buildWidgetData();
  renderWidget(renderFor(widgetName, widgetId, data));
  if (tappedHabit) {
    void refreshWidgets({ except: widgetInfo, data });
    void syncReminders().catch(() => {});
  }
}

/** Redraw every placed widget after data changed. Cheap no-op when none are placed. */
export async function refreshWidgets(opts: { except?: WidgetInfo; data?: WidgetData } = {}): Promise<void> {
  try {
    const data = opts.data ?? (await buildWidgetData());
    for (const name of Object.values(WIDGETS)) {
      const placed = await getWidgetInfo(name).catch(() => [] as WidgetInfo[]);
      for (const w of placed) {
        if (opts.except && opts.except.widgetName === name && opts.except.widgetId === w.widgetId) continue;
        await requestWidgetUpdateById({ widgetName: name, widgetId: w.widgetId, renderWidget: () => renderFor(name, w.widgetId, data) });
      }
    }
  } catch {
    // Not Android, or widgets unavailable.
  }
}

/** Kept for callers that only know "something changed". */
export const refreshWidget = () => refreshWidgets();

