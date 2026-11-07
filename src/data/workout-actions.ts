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
  const { exercises, workouts, sets, saveWorkout, saveSet, removeSet, settings, habits, updateEntry, today } = store;

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

  /** Creates the workout and returns its id right away; saving continues in the background. */
  const startWorkout = useCallback(
    (template?: WorkoutTemplate): string => {
      const w: Workout = {
        id: newId(),
        date: today,
        name: template?.name ?? 'Workout',
        templateId: template?.id ?? null,
        note: '',
        startedAt: Date.now(),
        finishedAt: null,
      };
      saveWorkout(w);
      let order = 0;
      for (const exId of template?.exerciseIds ?? []) {
        const list = setsForExercise(w, exId, order);
        order += list.length;
        for (const s of list) saveSet(s);
      }
      return w.id;
    },
    [today, saveWorkout, saveSet, setsForExercise],
  );

  /** Ends the workout: drops empty sets and ticks the linked habit. Returns the habit name ticked, if any. */
  const finishWorkout = useCallback(
    (w: Workout): string | null => {
      restTimer.stop();
      const finishedAt = Date.now();
      for (const s of sets.filter((x) => x.workoutId === w.id && !isFilled(x))) removeSet(s.id);
      saveWorkout({ ...w, finishedAt });
      const habit = habits.find((h) => h.id === settings.workoutHabitId && !h.archived);
      if (!habit) return null;
      const minutes = Math.max(1, Math.round((finishedAt - w.startedAt) / 60_000));
      updateEntry(habit.id, w.date, (e) =>
        habit.kind === 'duration'
          ? { ...e, skipped: false, value: e.value + minutes }
          : habit.kind === 'count'
            ? plusOne(habit, e)
            : markDone(habit, e),
      );
      return habit.kind === 'avoid' ? null : habit.name;
    },
    [sets, removeSet, saveWorkout, habits, settings.workoutHabitId, updateEntry],
  );

  return { startWorkout, finishWorkout, setsForExercise };
}
