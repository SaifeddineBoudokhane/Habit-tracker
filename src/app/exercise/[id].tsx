import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { KIND_LABEL } from '@/components/exercise-picker';
import { LineChart } from '@/components/line-chart';
import { Body, Button, Card, Input, Label } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { prettyDate } from '@/lib/dates';
import { describeSet, isFilled, personalRecords, progressSeries, seriesLabel } from '@/lib/workouts';

export default function ExerciseScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exercises, sets, workouts, saveExercise, today } = useStore();
  const exercise = exercises.find((e) => e.id === id);

  useLayoutEffect(() => {
    nav.setOptions({ title: exercise?.name ?? '' });
  }, [nav, exercise?.name]);

  if (!exercise) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  const prs = personalRecords(exercise, sets, workouts);
  const series = progressSeries(exercise, sets, workouts);
  const finished = workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt);
  const history = finished
    .map((w) => ({ w, ss: sets.filter((s) => s.workoutId === w.id && s.exerciseId === exercise.id && isFilled(s)).sort((a, b) => a.order - b.order) }))
    .filter((x) => x.ss.length)
    .slice(0, 20);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 6 }}>
        <Input value={exercise.name} onChangeText={(name) => saveExercise({ ...exercise, name })} />
        <Body muted>{KIND_LABEL[exercise.kind]}</Body>
      </Card>

      <Card>
        <Label>Personal records</Label>
        {prs.length === 0 && <Body muted>No finished sets yet.</Body>}
        {prs.map((p) => (
          <View key={p.label} style={[s.prRow, { borderColor: c.border }]}>
            <Body>{p.label}</Body>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{p.value}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 11 }}>{prettyDate(p.date, today)}</Text>
            </View>
          </View>
        ))}
      </Card>

      {series.length > 1 && (
        <Card>
          <Label>{seriesLabel(exercise)}</Label>
          <LineChart points={series} color={c.accent} />
        </Card>
      )}

      <Card>
        <Label>History</Label>
        {history.length === 0 && <Body muted>Nothing logged yet.</Body>}
        {history.map(({ w, ss }) => (
          <Pressable key={w.id} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} style={{ paddingVertical: 8 }}>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>
              {prettyDate(w.date, today)} · {w.name}
            </Text>
            <Body>{ss.map((x) => describeSet(exercise, x)).join(',  ')}</Body>
          </Pressable>
        ))}
      </Card>

      <Button
        title="Archive exercise"
        kind="secondary"
        onPress={() => {
          saveExercise({ ...exercise, archived: true });
          router.back();
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
