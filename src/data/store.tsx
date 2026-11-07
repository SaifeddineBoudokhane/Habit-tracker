import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { todayKey } from '@/lib/dates';
import type { Backup } from '@/lib/backup';
import type { Entry, EntryIndex, Habit, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { handleNotificationResponse, setupNotifications, syncReminders } from '@/notifications/scheduler';

import * as db from './db';
import { emptyEntry } from './actions';

interface Store {
  ready: boolean;
  habits: Habit[];
  entries: Entry[];
  index: EntryIndex;
  settings: Settings;
  today: string;
  entryFor(habitId: string, date: string): Entry;
  setEntry(e: Entry): Promise<void>;
  saveHabit(h: Habit): Promise<void>;
  removeHabit(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  restore(b: Backup): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState(todayKey());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncReminders().catch((e) => console.warn('Reminder sync failed', e));
    }, 800);
  }, []);

  const reload = useCallback(async () => {
    const data = await db.loadAll();
    setHabits(data.habits);
    setEntries(data.entries);
    setSettings(data.settings);
    setToday(todayKey());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await reload();
      if (!alive) return;
      setReady(true);
      await setupNotifications().catch((e) => console.warn('Notification setup failed', e));
      scheduleSync();
    })();
    // Foreground: pick up changes made by notification buttons, roll "today" over, refresh reminders.
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload().then(scheduleSync);
    });
    const respSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response)
        .then((changed) => {
          if (changed) return reload();
        })
        .catch((e) => console.warn(e));
    });
    // Midnight roll-over while the app stays open.
    const tick = setInterval(() => setToday(todayKey()), 60_000);
    return () => {
      alive = false;
      appSub.remove();
      respSub.remove();
      clearInterval(tick);
    };
  }, [reload, scheduleSync]);

  const index = useMemo(() => db.buildIndex(entries), [entries]);

  const entryFor = useCallback(
    (habitId: string, date: string) => index.get(habitId)?.get(date) ?? emptyEntry(habitId, date),
    [index],
  );

  const setEntry = useCallback(
    async (e: Entry) => {
      const clean = { ...e, value: Math.max(0, Math.round(e.value * 100) / 100) };
      setEntries((prev) => {
        const rest = prev.filter((x) => !(x.habitId === e.habitId && x.date === e.date));
        return clean.value > 0 || clean.skipped ? [...rest, clean] : rest;
      });
      await db.putEntry(clean);
      scheduleSync();
    },
    [scheduleSync],
  );

  const saveHabit = useCallback(
    async (h: Habit) => {
      setHabits((prev) => {
        const i = prev.findIndex((x) => x.id === h.id);
        if (i === -1) return [...prev, h];
        const next = [...prev];
        next[i] = h;
        return next;
      });
      await db.saveHabit(h);
      scheduleSync();
    },
    [scheduleSync],
  );

  const removeHabit = useCallback(
    async (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
      setEntries((prev) => prev.filter((e) => e.habitId !== id));
      await db.deleteHabit(id);
      scheduleSync();
    },
    [scheduleSync],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await db.saveSettings(next);
      scheduleSync();
    },
    [settings, scheduleSync],
  );

  const restore = useCallback(
    async (b: Backup) => {
      await db.replaceAll(b.habits, b.entries, b.settings);
      await reload();
      scheduleSync();
    },
    [reload, scheduleSync],
  );

  const value: Store = {
    ready,
    habits,
    entries,
    index,
    settings,
    today,
    entryFor,
    setEntry,
    saveHabit,
    removeHabit,
    updateSettings,
    restore,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
