"use no memo";
// Widget components must stay plain functions: the React Compiler rewrites them into hook calls,
// which react-native-android-widget cannot render ("Invalid Hook Call" -> "Error rendering widget").

import type { WidgetInfo, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getWidgetInfo, requestWidgetUpdateById } from 'react-native-android-widget';

import { emptyEntry, tapped } from '@/data/actions';
import { getEntryRow, loadAll, patchSettings, putEntry } from '@/data/db';
import { todayKey } from '@/lib/dates';
import { syncReminders } from '@/notifications/scheduler';

import { buildWidgetData, type WidgetData } from './model';
import { HabitWidget, StreaksWidget, TodayWidget, WeekWidget, type Size } from './widgets';

/** Widget names must match app.json (react-native-android-widget plugin). */
export const WIDGETS = {
  today: 'Today',
  habit: 'Habit',
  streaks: 'Streaks',
  week: 'Week',
} as const;

/** Sizes from app.json (targetCellWidth x targetCellHeight), used when Android doesn't report one. */
export const DEFAULT_SIZES: Record<string, Size> = {
  [WIDGETS.today]: { width: 320, height: 150 },
  [WIDGETS.habit]: { width: 150, height: 150 },
  [WIDGETS.streaks]: { width: 320, height: 150 },
  [WIDGETS.week]: { width: 320, height: 170 },
};

const sizeOf = (name: string, s?: Partial<Size>): Size => {
  const d = DEFAULT_SIZES[name] ?? DEFAULT_SIZES[WIDGETS.today];
  return { width: s?.width || d.width, height: s?.height || d.height };
};

/** Android picks the variant matching the phone's light/dark mode. Layouts adapt to the widget's size. */
export function renderFor(name: string, widgetId: number, data: WidgetData, reported?: Partial<Size>) {
  const size = sizeOf(name, reported);
  const both = (make: (dark: boolean) => React.JSX.Element) => ({ light: make(false), dark: make(true) });
  switch (name) {
    case WIDGETS.habit: {
      const card = data.habits.get(data.settings.widgetHabits?.[String(widgetId)] ?? '') ?? null;
      return both((dark) => <HabitWidget card={card} widgetId={widgetId} dark={dark} size={size} />);
    }
    case WIDGETS.streaks:
      return both((dark) => <StreaksWidget data={data} dark={dark} size={size} />);
    case WIDGETS.week:
      return both((dark) => <WeekWidget data={data} dark={dark} size={size} />);
    default:
      return both((dark) => <TodayWidget data={data} dark={dark} size={size} />);
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
  renderWidget(renderFor(widgetName, widgetId, data, widgetInfo));
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
        await requestWidgetUpdateById({ widgetName: name, widgetId: w.widgetId, renderWidget: () => renderFor(name, w.widgetId, data, w) });
      }
    }
  } catch {
    // Not Android, or widgets unavailable.
  }
}

/** Kept for callers that only know "something changed". */
export const refreshWidget = () => refreshWidgets();
