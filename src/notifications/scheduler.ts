import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { emptyEntry, markDone, plusOne } from '@/data/actions';
import { buildIndex, claimOnce, getEntryRow, loadAll, putEntry } from '@/data/db';
import { PLAN_PREFIX, planNotifications } from '@/lib/reminders';
import type { Habit } from '@/lib/types';

export const CHANNEL_ID = 'reminders';
export const NOTIFICATION_TASK = 'habit-notification-action';
export const REFRESH_TASK = 'habit-reminder-refresh';

export const ACTION_DONE = 'done';
export const ACTION_PLUS1 = 'plus1';
export const ACTION_SNOOZE = 'snooze';
const SNOOZE_MIN = 15;

let setupDone = false;

/** Channel, categories and background tasks. Safe to call many times. */
export async function setupNotifications(): Promise<void> {
  if (setupDone) return;
  setupDone = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Habit reminders',
      // eslint-disable-next-line import/namespace -- exported via `export *`, the rule can't follow it
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  const bg = { opensAppToForeground: false };
  const snooze = { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MIN}m`, options: bg };
  await Promise.all([
    Notifications.setNotificationCategoryAsync('habit-check', [
      { identifier: ACTION_DONE, buttonTitle: 'Done ✓', options: bg },
      snooze,
    ]),
    Notifications.setNotificationCategoryAsync('habit-count', [
      { identifier: ACTION_PLUS1, buttonTitle: '+1', options: bg },
      { identifier: ACTION_DONE, buttonTitle: 'Done ✓', options: bg },
      snooze,
    ]),
    Notifications.setNotificationCategoryAsync('habit-duration', [
      { identifier: ACTION_DONE, buttonTitle: 'Done ✓', options: bg },
      snooze,
    ]),
  ]);
  try {
    await Notifications.registerTaskAsync(NOTIFICATION_TASK);
    await BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 6 * 60 });
  } catch (e) {
    console.warn('Background task registration failed', e);
  }
}

export async function ensurePermission(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

function contentFor(habit: Habit, date: string, snoozed = false): Notifications.NotificationContentInput {
  const body =
    habit.kind === 'avoid'
      ? 'Stay strong 💪'
      : habit.kind === 'count'
        ? `Goal: ${habit.target} ${habit.unit}`.trim()
        : habit.kind === 'duration'
          ? `Goal: ${habit.target} min`
          : 'Time to do it';
  return {
    title: `${habit.emoji} ${habit.name}`,
    body: snoozed ? `${body} (snoozed)` : body,
    data: { habitId: habit.id, date },
    categoryIdentifier: habit.kind === 'avoid' ? undefined : `habit-${habit.kind}`,
    sound: true,
  };
}

let syncing: Promise<void> | null = null;
let again = false;

/**
 * Makes the OS-scheduled notifications match the plan for the next 7 days.
 * Diffs by id so only changes are sent to the OS.
 */
export function syncReminders(): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function syncOnce() {
  const { habits, entries, settings } = await loadAll();
  const byId = new Map(habits.map((h) => [h.id, h]));
  const plan = planNotifications(habits, buildIndex(entries), settings, new Date());
  const wanted = new Map(plan.map((p) => [p.id, p]));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Set<string>();
  for (const n of scheduled) {
    const id = n.identifier;
    if (!id.startsWith(PLAN_PREFIX)) continue;
    if (wanted.has(id)) existing.add(id);
    else await Notifications.cancelScheduledNotificationAsync(id);
  }
  for (const p of plan) {
    if (existing.has(p.id)) continue;
    const habit = byId.get(p.habitId)!;
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: contentFor(habit, p.date),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL_ID },
    });
  }
}

/** Apply a notification button press (Done / +1 / Snooze). Returns true if data changed. */
export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<boolean> {
  const action = response.actionIdentifier;
  if (![ACTION_DONE, ACTION_PLUS1, ACTION_SNOOZE].includes(action)) return false;
  const req = response.notification.request;
  if (!(await claimOnce(`${req.identifier}|${action}|${response.notification.date}`))) return false;
  const data = req.content.data as { habitId?: string; date?: string } | undefined;
  await Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
  if (!data?.habitId || !data.date) return false;
  const { habits } = await loadAll();
  const habit = habits.find((h) => h.id === data.habitId);
  if (!habit) return false;

  if (action === ACTION_SNOOZE) {
    await Notifications.scheduleNotificationAsync({
      identifier: `snooze:${habit.id}:${Date.now()}`,
      content: contentFor(habit, data.date, true),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: SNOOZE_MIN * 60,
        channelId: CHANNEL_ID,
      },
    });
    return false;
  }
  const current = (await getEntryRow(habit.id, data.date)) ?? emptyEntry(habit.id, data.date);
  await putEntry(action === ACTION_DONE ? markDone(habit, current) : plusOne(habit, current));
  await syncReminders();
  return true;
}
