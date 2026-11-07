import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';

import type { Backup, BackupData } from '@/lib/backup';
import { setWeekStartDay, todayKey } from '@/lib/dates';
import type { Entry, EntryIndex, Exercise, Goal, Habit, Settings, Workout, WorkoutSet, WorkoutTemplate } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { handleNotificationResponse, registerCategories, setupNotifications, syncReminders } from '@/notifications/scheduler';
import { refreshWidget } from '@/widget/handler';

import { emptyEntry } from './actions';
import { runAutoBackup } from './auto-backup';
import * as db from './db';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

interface Store extends BackupData {
  ready: boolean;
  index: EntryIndex;
  today: string;
  entryFor(habitId: string, date: string): Entry;
  setEntry(e: Entry): Promise<void>;
  /** Add many entries in one go (e.g. back-filling days before the app was used). */
  addEntries(es: Entry[]): Promise<void>;
  /** Change an entry based on its latest value (safe for rapid repeated taps). */
  updateEntry(habitId: string, date: string, fn: (e: Entry) => Entry): Promise<void>;
  saveHabit(h: Habit): Promise<void>;
  removeHabit(id: string): Promise<void>;
  reorderHabits(ids: string[]): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  saveGoal(g: Goal): Promise<void>;
  removeGoal(id: string): Promise<void>;
  saveExercise(e: Exercise): Promise<void>;
  saveTemplate(t: WorkoutTemplate): Promise<void>;
  removeTemplate(id: string): Promise<void>;
  saveWorkout(w: Workout): Promise<void>;
  removeWorkout(id: string): Promise<void>;
  saveSet(s: WorkoutSet): Promise<void>;
  removeSet(id: string): Promise<void>;
  restore(b: Backup): Promise<void>;
  backupNow(): Promise<Partial<Settings> | null>;
  wipe(kind: db.WipeKind): Promise<void>;
  reload(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Replace-or-append by id. */
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [today, setToday] = useState(todayKey());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  const entriesRef = useRef<Entry[]>([]);
  const errorShown = useRef(false);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncReminders().catch((e) => console.warn('Reminder sync failed', e));
      void refreshWidget();
    }, 800);
  }, []);

  /** Merge settings changed outside React (e.g. by the automatic backup) into state. */
  const mergeSettings = useCallback((patch: Partial<Settings> | null) => {
    if (!patch) return;
    settingsRef.current = { ...settingsRef.current, ...patch };
    setSettings(settingsRef.current);
  }, []);

  const reload = useCallback(async () => {
    const data = await db.loadAll();
    setHabits(data.habits);
    entriesRef.current = data.entries;
    setEntries(data.entries);
    setSettings(data.settings);
    settingsRef.current = data.settings;
    setGoals(data.goals);
    setExercises(data.exercises.sort((a, b) => a.name.localeCompare(b.name)));
    setTemplates(data.templates);
    setWorkouts(data.workouts);
    setSets(data.sets);
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
      mergeSettings(await runAutoBackup().catch(() => null));
    })();
    // Foreground: pick up changes made by notification buttons, roll "today" over, refresh reminders.
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        reload()
          .then(scheduleSync)
          .then(() => runAutoBackup())
          .then(mergeSettings)
          .catch((e) => console.warn(e));
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
  }, [reload, scheduleSync, mergeSettings]);

  /**
   * Screens update immediately; the database write runs in the background (queued in order).
   * If a write fails, say so once and reload what is really stored.
   */
  const persist = useCallback(
    (write: Promise<void>): Promise<void> =>
      write.catch((e) => {
        console.warn('Save failed', e);
        if (!errorShown.current) {
          errorShown.current = true;
          Alert.alert('Couldn’t save', `Your last change may not have been saved.\n\n${e instanceof Error ? e.message : String(e)}`, [
            { text: 'OK', onPress: () => (errorShown.current = false) },
          ]);
        }
        reload().catch(() => {});
      }),
    [reload],
  );

  const index = useMemo(() => db.buildIndex(entries), [entries]);

  const entryFor = useCallback(
    (habitId: string, date: string) => index.get(habitId)?.get(date) ?? emptyEntry(habitId, date),
    [index],
  );

  const setEntry = useCallback(
    (e: Entry): Promise<void> => {
      const clean: Entry = { ...e, value: Math.max(0, Math.round(e.value * 100) / 100) };
      if (!clean.note?.trim()) delete clean.note;
      const rest = entriesRef.current.filter((x) => !(x.habitId === e.habitId && x.date === e.date));
      entriesRef.current = db.isEmptyEntry(clean) ? rest : [...rest, clean];
      setEntries(entriesRef.current);
      scheduleSync();
      return persist(db.putEntry(clean));
    },
    [scheduleSync, persist],
  );

  const addEntries = useCallback(
    (es: Entry[]): Promise<void> => {
      if (es.length === 0) return Promise.resolve();
      const keys = new Set(es.map((e) => `${e.habitId}|${e.date}`));
      entriesRef.current = [...entriesRef.current.filter((x) => !keys.has(`${x.habitId}|${x.date}`)), ...es];
      setEntries(entriesRef.current);
      scheduleSync();
      return persist(Promise.all(es.map((e) => db.putEntry(e))).then(() => {}));
    },
    [scheduleSync, persist],
  );

  const updateEntry = useCallback(
    (habitId: string, date: string, fn: (e: Entry) => Entry): Promise<void> => {
      const current = entriesRef.current.find((x) => x.habitId === habitId && x.date === date) ?? emptyEntry(habitId, date);
      return setEntry(fn(current));
    },
    [setEntry],
  );

  const saveHabit = useCallback(
    async (h: Habit) => {
      setHabits((prev) => upsert(prev, h));
      scheduleSync();
      return persist(db.saveHabit(h));
    },
    [scheduleSync, persist],
  );

  const removeHabit = useCallback(
    async (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
      entriesRef.current = entriesRef.current.filter((e) => e.habitId !== id);
      setEntries(entriesRef.current);
      setGoals((prev) => prev.filter((g) => g.habitId !== id));
      scheduleSync();
      return persist(db.deleteHabit(id));
    },
    [scheduleSync, persist],
  );

  const reorderHabits = useCallback(
    async (ids: string[]) => {
      const updated = habits
        .map((h) => ({ ...h, sortOrder: ids.indexOf(h.id) === -1 ? ids.length + h.sortOrder : ids.indexOf(h.id) }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setHabits(updated);
      scheduleSync();
      await Promise.all(updated.map((h) => persist(db.saveHabit(h))));
    },
    [habits, scheduleSync, persist],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      // Ref so rapid successive updates (e.g. timer start + stop) don't clobber each other.
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      if (patch.weekStartDay !== undefined) setWeekStartDay(next.weekStartDay);
      setSettings(next);
      if (patch.snoozeMinutes !== undefined) registerCategories(next.snoozeMinutes).catch(() => {});
      // Only settings that change which reminders fire need a reminder refresh.
      if (['quietEnabled', 'quietStart', 'quietEnd', 'weekStartDay'].some((k) => k in patch)) scheduleSync();
      return persist(db.patchSettings(patch));
    },
    [scheduleSync, persist],
  );

  const saveGoal = useCallback((g: Goal) => {
    setGoals((prev) => upsert(prev, g));
    return persist(db.putDoc('goals', g));
  }, [persist]);
  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    return persist(db.deleteDoc('goals', id));
  }, [persist]);

  const saveExercise = useCallback((e: Exercise) => {
    setExercises((prev) => upsert(prev, e).sort((a, b) => a.name.localeCompare(b.name)));
    return persist(db.putDoc('exercises', e));
  }, [persist]);

  const saveTemplate = useCallback((t: WorkoutTemplate) => {
    setTemplates((prev) => upsert(prev, t));
    return persist(db.putDoc('templates', t));
  }, [persist]);
  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    return persist(db.deleteDoc('templates', id));
  }, [persist]);

  const saveWorkout = useCallback((w: Workout) => {
    setWorkouts((prev) => upsert(prev, w));
    return persist(db.putDoc('workouts', w));
  }, [persist]);
  const removeWorkout = useCallback((id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    setSets((prev) => prev.filter((s) => s.workoutId !== id));
    return persist(db.deleteWorkout(id));
  }, [persist]);

  const saveSet = useCallback((s: WorkoutSet) => {
    setSets((prev) => upsert(prev, s));
    return persist(db.putSet(s));
  }, [persist]);
  const removeSet = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
    return persist(db.deleteSet(id));
  }, [persist]);

  const restore = useCallback(
    async (b: Backup) => {
      // Old backups have no exercise list: keep the current one so workouts still have exercises to pick.
      const data: BackupData = b.exercises.length ? b : { ...b, exercises };
      await db.replaceAll(data);
      await reload();
      scheduleSync();
    },
    [reload, scheduleSync, exercises],
  );

  const wipe = useCallback(
    async (kind: db.WipeKind) => {
      await db.wipe(kind);
      await reload();
      scheduleSync();
    },
    [reload, scheduleSync],
  );

  const backupNow = useCallback(async () => {
    const patch = await runAutoBackup(true);
    mergeSettings(patch);
    return patch;
  }, [mergeSettings]);

  const value: Store = {
    ready,
    habits,
    entries,
    settings,
    goals,
    exercises,
    templates,
    workouts,
    sets,
    index,
    today,
    entryFor,
    setEntry,
    addEntries,
    updateEntry,
    saveHabit,
    removeHabit,
    reorderHabits,
    updateSettings,
    saveGoal,
    removeGoal,
    saveExercise,
    saveTemplate,
    removeTemplate,
    saveWorkout,
    removeWorkout,
    saveSet,
    removeSet,
    restore,
    backupNow,
    wipe,
    reload,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
