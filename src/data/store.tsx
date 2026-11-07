import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

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

  const index = useMemo(() => db.buildIndex(entries), [entries]);

  const entryFor = useCallback(
    (habitId: string, date: string) => index.get(habitId)?.get(date) ?? emptyEntry(habitId, date),
    [index],
  );

  const setEntry = useCallback(
    async (e: Entry) => {
      const clean: Entry = { ...e, value: Math.max(0, Math.round(e.value * 100) / 100) };
      if (!clean.note?.trim()) delete clean.note;
      setEntries((prev) => {
        const rest = prev.filter((x) => !(x.habitId === e.habitId && x.date === e.date));
        return db.isEmptyEntry(clean) ? rest : [...rest, clean];
      });
      await db.putEntry(clean);
      scheduleSync();
    },
    [scheduleSync],
  );

  const saveHabit = useCallback(
    async (h: Habit) => {
      setHabits((prev) => upsert(prev, h));
      await db.saveHabit(h);
      scheduleSync();
    },
    [scheduleSync],
  );

  const removeHabit = useCallback(
    async (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
      setEntries((prev) => prev.filter((e) => e.habitId !== id));
      setGoals((prev) => prev.filter((g) => g.habitId !== id));
      await db.deleteHabit(id);
      scheduleSync();
    },
    [scheduleSync],
  );

  const reorderHabits = useCallback(
    async (ids: string[]) => {
      const updated = habits
        .map((h) => ({ ...h, sortOrder: ids.indexOf(h.id) === -1 ? ids.length + h.sortOrder : ids.indexOf(h.id) }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setHabits(updated);
      for (const h of updated) await db.saveHabit(h);
      scheduleSync();
    },
    [habits, scheduleSync],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      // Ref so rapid successive updates (e.g. timer start + stop) don't clobber each other.
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      if (patch.weekStartDay !== undefined) setWeekStartDay(next.weekStartDay);
      setSettings(next);
      await db.patchSettings(patch);
      if (patch.snoozeMinutes !== undefined) registerCategories(next.snoozeMinutes).catch(() => {});
      scheduleSync();
    },
    [scheduleSync],
  );

  const saveGoal = useCallback(async (g: Goal) => {
    setGoals((prev) => upsert(prev, g));
    await db.putDoc('goals', g);
  }, []);
  const removeGoal = useCallback(async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await db.deleteDoc('goals', id);
  }, []);

  const saveExercise = useCallback(async (e: Exercise) => {
    setExercises((prev) => upsert(prev, e).sort((a, b) => a.name.localeCompare(b.name)));
    await db.putDoc('exercises', e);
  }, []);

  const saveTemplate = useCallback(async (t: WorkoutTemplate) => {
    setTemplates((prev) => upsert(prev, t));
    await db.putDoc('templates', t);
  }, []);
  const removeTemplate = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await db.deleteDoc('templates', id);
  }, []);

  const saveWorkout = useCallback(async (w: Workout) => {
    setWorkouts((prev) => upsert(prev, w));
    await db.putDoc('workouts', w);
  }, []);
  const removeWorkout = useCallback(async (id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    setSets((prev) => prev.filter((s) => s.workoutId !== id));
    await db.deleteWorkout(id);
  }, []);

  const saveSet = useCallback(async (s: WorkoutSet) => {
    setSets((prev) => upsert(prev, s));
    await db.putSet(s);
  }, []);
  const removeSet = useCallback(async (id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
    await db.deleteSet(id);
  }, []);

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
