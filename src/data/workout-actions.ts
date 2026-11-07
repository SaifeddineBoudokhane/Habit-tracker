import { useCallback } from 'react';

import { isFilled, previousSets } from '@/lib/workouts';
import type { Workout, WorkoutSet, WorkoutTemplate } from '@/lib/types';

import { markDone, plusOne } from './actions';
import { restTimer } from './rest-timer';
import { newId, useStore } from './store';

export function blankSet(workoutId: string, exerciseId: string, order: number, from?: WorkoutSet): WorkoutSet {
  return {
    id: newId(),
    workoutId,
    exerciseId,
    order,
    reps: from?.reps ?? 0,
    weight: from?.weight ?? 0,
    distance: from?.distance ?? 0,
    durationSec: from?.durationSec ?? 0,
    done: false,
  };
}

export function useWorkoutActions() {
  const store = useStore();
  const { exercises, workouts, sets, saveWorkout, saveSet, removeSet, settings, habits, entryFor, setEntry, today } = store;

  /** Sets for an exercise added to a workout: same as last time, or empty ones. */
  const setsForExercise = useCallback(
    (workout: Workout, exerciseId: string, startOrder: number): WorkoutSet[] => {
      const prev = previousSets(exerciseId, workout, sets, workouts);
      const kind = exercises.find((e) => e.id === exerciseId)?.kind;
      if (prev.length) return prev.map((p, i) => blankSet(workout.id, exerciseId, startOrder + i, p));
      const n = kind === 'cardio' ? 1 : 3;
      return Array.from({ length: n }, (_, i) => blankSet(workout.id, exerciseId, startOrder + i));
    },
    [sets, workouts, exercises],
  );

  const startWorkout = useCallback(
    async (template?: WorkoutTemplate): Promise<string> => {
      const w: Workout = {
        id: newId(),
        date: today,
        name: template?.name ?? 'Workout',
        templateId: template?.id ?? null,
        note: '',
        startedAt: Date.now(),
        finishedAt: null,
      };
      await saveWorkout(w);
      let order = 0;
      for (const exId of template?.exerciseIds ?? []) {
        const list = setsForExercise(w, exId, order);
        order += list.length;
        for (const s of list) await saveSet(s);
      }
      return w.id;
    },
    [today, saveWorkout, saveSet, setsForExercise],
  );

  /** Ends the workout: drops empty sets and ticks the linked habit. Returns the habit name ticked, if any. */
  const finishWorkout = useCallback(
    async (w: Workout): Promise<string | null> => {
      restTimer.stop();
      const finishedAt = Date.now();
      for (const s of sets.filter((x) => x.workoutId === w.id && !isFilled(x))) await removeSet(s.id);
      await saveWorkout({ ...w, finishedAt });
      const habit = habits.find((h) => h.id === settings.workoutHabitId && !h.archived);
      if (!habit) return null;
      const e = entryFor(habit.id, w.date);
      if (habit.kind === 'duration') {
        const minutes = Math.max(1, Math.round((finishedAt - w.startedAt) / 60_000));
        await setEntry({ ...e, skipped: false, value: e.value + minutes });
      } else if (habit.kind === 'count') {
        await setEntry(plusOne(habit, e));
      } else if (habit.kind === 'check') {
        await setEntry(markDone(habit, e));
      }
      return habit.name;
    },
    [sets, removeSet, saveWorkout, habits, settings.workoutHabitId, entryFor, setEntry],
  );

  return { startWorkout, finishWorkout, setsForExercise };
}
