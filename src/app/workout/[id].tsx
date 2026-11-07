import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ExercisePicker } from '@/components/exercise-picker';
import { RestTimerBar } from '@/components/rest-timer-bar';
import { Body, Button, Card, DecimalInput, Input } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { restTimer } from '@/data/rest-timer';
import { newId, useStore } from '@/data/store';
import { blankSet, useWorkoutActions } from '@/data/workout-actions';
import type { Exercise, Workout, WorkoutSet } from '@/lib/types';
import { describeSet, formatDuration, previousSets, summarize } from '@/lib/workouts';

export default function WorkoutScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { workouts, sets, exercises, saveWorkout, saveSet, removeSet, removeWorkout, saveTemplate, templates, settings } = store;
  const { finishWorkout, setsForExercise } = useWorkoutActions();
  const workout = workouts.find((w) => w.id === id);
  const [picking, setPicking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const active = !!workout && workout.finishedAt === null;

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  useLayoutEffect(() => {
    nav.setOptions({ title: active ? `⏱ ${formatDuration((now - (workout?.startedAt ?? now)) / 1000)}` : 'Workout' });
  }, [nav, active, now, workout?.startedAt]);

  if (!workout) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  const mine = sets.filter((s) => s.workoutId === workout.id).sort((a, b) => a.order - b.order);
  const exerciseOrder: string[] = [];
  for (const s of mine) if (!exerciseOrder.includes(s.exerciseId)) exerciseOrder.push(s.exerciseId);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const nextOrder = mine.length ? mine[mine.length - 1].order + 1 : 0;
  const summary = summarize(workout, sets);

  const update = (patch: Partial<Workout>) => saveWorkout({ ...workout, ...patch });

  const addExercise = async (e: Exercise) => {
    setPicking(false);
    for (const s of setsForExercise(workout, e.id, nextOrder)) await saveSet(s);
  };

  const finish = async () => {
    const ticked = await finishWorkout(workout);
    const exIds = exerciseOrder.filter((eid) => sets.some((s) => s.workoutId === workout.id && s.exerciseId === eid && (s.reps || s.distance || s.durationSec)));
    const template = templates.find((t) => t.id === workout.templateId);
    const changed = template && template.exerciseIds.join() !== exIds.join();
    const msg = ticked ? `Nice work! “${ticked}” is ticked for today.` : 'Nice work!';
    if (exIds.length && (!template || changed)) {
      Alert.alert('Workout saved', `${msg}\n\n${template ? 'Update the template with today’s exercises?' : 'Save this as a template to reuse it?'}`, [
        { text: 'No thanks', style: 'cancel', onPress: () => router.back() },
        {
          text: template ? 'Update template' : 'Save template',
          onPress: async () => {
            const t = template ? { ...template, exerciseIds: exIds } : { id: newId(), name: workout.name, exerciseIds: exIds };
            await saveTemplate(t);
            if (!template) await saveWorkout({ ...workout, finishedAt: Date.now(), templateId: t.id });
            router.back();
          },
        },
      ]);
    } else {
      Alert.alert('Workout saved', msg, [{ text: 'OK', onPress: () => router.back() }]);
    }
  };

  const discard = () =>
    Alert.alert(active ? 'Discard workout?' : 'Delete workout?', 'This removes the workout and all its sets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: active ? 'Discard' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (active) restTimer.stop();
          router.back();
          await removeWorkout(workout.id);
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 10 }}>
          <Input value={workout.name} onChangeText={(name) => update({ name })} placeholder="Workout name" style={{ fontSize: 18, fontWeight: '700' }} />
          <View style={s.inline}>
            <DateField value={workout.date} onChange={(date) => update({ date })} />
            <Body muted>
              {summary.sets} sets{summary.volume ? ` · ${Math.round(summary.volume)} kg volume` : ''}
              {!active && summary.durationSec ? ` · ${formatDuration(summary.durationSec)}` : ''}
            </Body>
          </View>
        </Card>

        {exerciseOrder.map((exId) => {
          const ex = exById.get(exId);
          if (!ex) return null;
          return (
            <ExerciseBlock
              key={exId}
              exercise={ex}
              workout={workout}
              sets={mine.filter((x) => x.exerciseId === exId)}
              previous={previousSets(exId, workout, sets, workouts)}
              onSetChange={saveSet}
              onSetDelete={removeSet}
              onSetDone={(st) => {
                saveSet(st);
                if (st.done && active && ex.kind !== 'cardio' && settings.restSeconds > 0) restTimer.start(settings.restSeconds);
              }}
              onAddSet={() => {
                const last = mine.filter((x) => x.exerciseId === exId).pop();
                saveSet(blankSet(workout.id, exId, nextOrder, last));
              }}
              onRemove={() =>
                Alert.alert(`Remove ${ex.name}?`, 'Its sets in this workout will be deleted.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => mine.filter((x) => x.exerciseId === exId).forEach((x) => removeSet(x.id)),
                  },
                ])
              }
            />
          );
        })}

        <Button title="+ Add exercise" kind="secondary" onPress={() => setPicking(true)} />
        <Input value={workout.note} onChangeText={(note) => update({ note })} placeholder="Workout note (optional)" multiline />
        {active && <Button title="Finish workout" onPress={finish} />}
        <Button title={active ? 'Discard workout' : 'Delete workout'} kind="danger" onPress={discard} />
      </ScrollView>
      <RestTimerBar />
      <ExercisePicker visible={picking} onPick={addExercise} onClose={() => setPicking(false)} />
    </KeyboardAvoidingView>
  );
}

function ExerciseBlock({
  exercise,
  workout,
  sets,
  previous,
  onSetChange,
  onSetDelete,
  onSetDone,
  onAddSet,
  onRemove,
}: {
  exercise: Exercise;
  workout: Workout;
  sets: WorkoutSet[];
  previous: WorkoutSet[];
  onSetChange: (s: WorkoutSet) => void;
  onSetDelete: (id: string) => void;
  onSetDone: (s: WorkoutSet) => void;
  onAddSet: () => void;
  onRemove: () => void;
}) {
  const c = useColors();
  const cols =
    exercise.kind === 'cardio'
      ? (['distance', 'minutes'] as const)
      : exercise.kind === 'bodyweight'
        ? (['reps', 'weight'] as const)
        : (['weight', 'reps'] as const);
  const header = { weight: exercise.kind === 'bodyweight' ? '+kg' : 'kg', reps: 'reps', distance: 'km', minutes: 'min' };

  return (
    <Card style={{ gap: 6 }}>
      <View style={s.exHeader}>
        <Pressable onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })} style={{ flex: 1 }}>
          <Text style={{ color: c.accent, fontSize: 17, fontWeight: '700' }}>{exercise.name}</Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Text style={{ color: c.textSecondary, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      <View style={s.setRow}>
        <Text style={[s.colSet, s.head, { color: c.textSecondary }]}>Set</Text>
        <Text style={[s.colPrev, s.head, { color: c.textSecondary }]}>Previous</Text>
        {cols.map((k) => (
          <Text key={k} style={[s.colIn, s.head, { color: c.textSecondary }]}>
            {header[k]}
          </Text>
        ))}
        <Text style={[s.colDone, s.head, { color: c.textSecondary }]}>✓</Text>
      </View>
      {sets.map((st, i) => (
        <Pressable
          key={st.id}
          onLongPress={() =>
            Alert.alert('Delete set?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onSetDelete(st.id) },
            ])
          }
          style={[s.setRow, st.done && { backgroundColor: c.success + '1f', borderRadius: 8 }]}>
          <Text style={[s.colSet, { color: c.text, fontWeight: '600' }]}>{i + 1}</Text>
          <Text style={[s.colPrev, { color: c.textSecondary, fontSize: 12 }]} numberOfLines={1}>
            {previous[i] ? describeSet(exercise, previous[i]) : '–'}
          </Text>
          {cols.map((k) => (
            <View key={k} style={s.colIn}>
              <DecimalInput
                key={`${k}-${st.done}`}
                integer={k === 'reps'}
                value={k === 'minutes' ? Math.round((st.durationSec / 60) * 100) / 100 : st[k]}
                placeholder={previous[i] ? String(k === 'minutes' ? Math.round(previous[i].durationSec / 60) : previous[i][k]) : '0'}
                onChange={(n) => onSetChange(k === 'minutes' ? { ...st, durationSec: Math.round(n * 60) } : { ...st, [k]: n })}
              />
            </View>
          ))}
          <Pressable
            onPress={() => {
              // Ticking an empty set copies the placeholder (= what you did last time).
              const prev = previous[i];
              const empty = !st.reps && !st.distance && !st.durationSec;
              const filled = !st.done && empty && prev ? { ...st, reps: prev.reps, weight: prev.weight, distance: prev.distance, durationSec: prev.durationSec } : st;
              onSetDone({ ...filled, done: !st.done });
            }}
            hitSlop={6}
            style={[s.colDone, s.check, { borderColor: st.done ? c.success : c.border, backgroundColor: st.done ? c.success : 'transparent' }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{st.done ? '✓' : ''}</Text>
          </Pressable>
        </Pressable>
      ))}
      <Pressable onPress={onAddSet} style={{ paddingVertical: 8, alignItems: 'center' }}>
        <Text style={{ color: c.accent, fontWeight: '600' }}>+ Add set</Text>
      </Pressable>
      {workout.finishedAt === null && sets.length > 0 && (
        <Text style={{ color: c.textSecondary, fontSize: 11, textAlign: 'center' }}>Long-press a set to delete it</Text>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  exHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  head: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  colSet: { width: 28, textAlign: 'center' },
  colPrev: { flex: 1.3, textAlign: 'center' },
  colIn: { flex: 1 },
  colDone: { width: 34, textAlign: 'center' },
  check: { height: 34, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
