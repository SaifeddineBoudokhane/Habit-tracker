import { useCallback, useEffect, useState } from 'react';

import { toKey } from '@/lib/dates';

import { useStore } from './store';

/** Built-in timer for duration habits. Stored in settings so it survives closing the app. */
export function useHabitTimer(habitId: string) {
  const { settings, updateSettings, entryFor, setEntry } = useStore();
  const startedAt = settings.timers?.[habitId] ?? null;

  const start = useCallback(() => updateSettings({ timers: { ...settings.timers, [habitId]: Date.now() } }), [settings.timers, habitId, updateSettings]);

  /** Stops the timer and adds the elapsed minutes (at least 1) to the day it was started. */
  const stop = useCallback(async () => {
    if (startedAt === null) return 0;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    const { [habitId]: _, ...rest } = settings.timers;
    await updateSettings({ timers: rest });
    const e = entryFor(habitId, toKey(new Date(startedAt)));
    await setEntry({ ...e, skipped: false, value: e.value + minutes });
    return minutes;
  }, [startedAt, habitId, settings.timers, updateSettings, entryFor, setEntry]);

  return { startedAt, start, stop };
}

/** Re-renders every second while `active`, returning the current time. */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
