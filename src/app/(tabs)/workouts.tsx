import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Label } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { newId, useStore } from '@/data/store';
import { useWorkoutActions } from '@/data/workout-actions';
import { prettyDate } from '@/lib/dates';
import type { WorkoutTemplate } from '@/lib/types';
import { formatDuration, summarize } from '@/lib/workouts';

export default function WorkoutsScreen() {
  const c = useColors();
  const { workouts, sets, templates, exercises, today, removeTemplate, saveTemplate } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const { startWorkout } = useWorkoutActions();
  const activeWorkout = workouts.find((w) => w.finishedAt === null);
  const history = workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt).slice(0, 50);
  const exName = new Map(exercises.map((e) => [e.id, e.name]));

  const start = (t?: WorkoutTemplate) => {
    if (activeWorkout) {
      return Alert.alert('Workout in progress', 'Finish or discard the current workout first.', [
        { text: 'OK', style: 'cancel' },
        { text: 'Open it', onPress: () => router.push({ pathname: '/workout/[id]', params: { id: activeWorkout.id } }) },
      ]);
    }
    const id = startWorkout(t);
    router.push({ pathname: '/workout/[id]', params: { id } });
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {activeWorkout ? (
        <Pressable onPress={() => router.push({ pathname: '/workout/[id]', params: { id: activeWorkout.id } })}>
          <Card style={{ borderColor: c.accent, borderWidth: 1.5 }}>
            <Text style={{ color: c.accent, fontWeight: '700', fontSize: 16 }}>▶ Resume “{activeWorkout.name}”</Text>
            <Body muted>Started {formatDuration((now - activeWorkout.startedAt) / 1000)} ago</Body>
          </Card>
        </Pressable>
      ) : (
        <Button title="Start empty workout" onPress={() => start()} />
      )}

      <Card>
        <Label>Templates</Label>
        {templates.length === 0 && <Body muted>Finish a workout and save it as a template (e.g. Push / Pull / Legs).</Body>}
        {templates.map((t) => (
          <View key={t.id} style={[s.templateRow, { borderColor: c.border }]}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/template/[id]', params: { id: t.id } })}>
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>{t.name}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }} numberOfLines={1}>
                {t.exerciseIds.map((id) => exName.get(id)).filter(Boolean).join(', ') || 'No exercises'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => start(t)}
              onLongPress={() =>
                Alert.alert(`Delete template “${t.name}”?`, 'Past workouts are kept.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => removeTemplate(t.id) },
                ])
              }
              style={[s.startBtn, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.accentText, fontWeight: '700' }}>Start</Text>
            </Pressable>
          </View>
        ))}
        <Button
          title="+ New template"
          kind="secondary"
          style={{ marginTop: 10 }}
          onPress={() => {
            const id = newId();
            saveTemplate({ id, name: 'New template', exerciseIds: [] });
            router.push({ pathname: '/template/[id]', params: { id } });
          }}
        />
      </Card>

      <Pressable onPress={() => router.push('/exercises')}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>🏆 Exercises & personal records</Text>
          <Text style={{ color: c.textSecondary, fontSize: 18 }}>›</Text>
        </Card>
      </Pressable>

      <Label>History</Label>
      {history.length === 0 && <Body muted>No workouts yet.</Body>}
      {history.map((w) => {
        const sum = summarize(w, sets);
        const names = [...new Set(sets.filter((x) => x.workoutId === w.id).map((x) => exName.get(x.exerciseId)))].filter(Boolean);
        return (
          <Pressable key={w.id} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{w.name}</Text>
                <Text style={{ color: c.textSecondary }}>{prettyDate(w.date, today)}</Text>
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>
                {formatDuration(sum.durationSec)} · {sum.sets} sets{sum.volume ? ` · ${Math.round(sum.volume)} kg` : ''}
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {names.join(', ')}
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  startBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
});
