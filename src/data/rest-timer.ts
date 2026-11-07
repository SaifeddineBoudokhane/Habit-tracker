import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';

import { CHANNEL_ID } from '@/notifications/scheduler';

/**
 * Rest timer between sets. Lives outside React so it survives navigating between screens,
 * and schedules a notification so it still alerts you with the screen off.
 */
const NOTIF_ID = 'rest-timer';
let endsAt: number | null = null;
let total = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function schedule() {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_ID).catch(() => {});
  if (endsAt === null) return;
  const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: { title: '⏱️ Rest is over', body: 'Time for the next set.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL_ID },
  }).catch(() => {});
}

export const restTimer = {
  start(seconds: number) {
    total = seconds;
    endsAt = Date.now() + seconds * 1000;
    emit();
    void schedule();
  },
  add(seconds: number) {
    if (endsAt === null) return;
    endsAt = Math.max(Date.now() + 1000, endsAt + seconds * 1000);
    total = Math.max(1, total + seconds);
    emit();
    void schedule();
  },
  stop() {
    endsAt = null;
    emit();
    void Notifications.cancelScheduledNotificationAsync(NOTIF_ID).catch(() => {});
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useRestTimer(): { endsAt: number | null; total: number } {
  const e = useSyncExternalStore(subscribe, () => endsAt);
  return { endsAt: e, total };
}
