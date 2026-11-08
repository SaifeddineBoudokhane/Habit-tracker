import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type UiIconName } from '@/components/icon';
import { Body, Button, Card, Label, NavRow, SectionHeader } from '@/components/ui';
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
        <NavRow
          icon="play_arrow"
          title={`Resume “${activeWorkout.name}”`}
          subtitle={`Started ${formatDuration((now - activeWorkout.startedAt) / 1000)} ago`}
          onPress={() => router.push({ pathname: '/workout/[id]', params: { id: activeWorkout.id } })}
        />
      ) : (
        <Button title="Start empty workout" icon="play_arrow" onPress={() => start()} />
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
              accessibilityRole="button"
              accessibilityLabel={`Start ${t.name}`}
              accessibilityHint="Long-press to delete the template"
              style={({ pressed }) => [s.startBtn, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
              <Icon name="play_arrow" size={18} color={c.accentText} />
              <Text style={{ color: c.accentText, fontWeight: '700' }}>Start</Text>
            </Pressable>
          </View>
        ))}
        <Button
          title="New template"
          icon="add"
          kind="secondary"
          style={{ marginTop: 10 }}
          onPress={() => {
            const id = newId();
            saveTemplate({ id, name: 'New template', exerciseIds: [] });
            router.push({ pathname: '/template/[id]', params: { id } });
          }}
        />
      </Card>

      <NavRow icon="trophy" iconColor="#eab308" title="Exercises & records" subtitle="Personal bests and progress charts" onPress={() => router.push('/exercises')} />

      <SectionHeader title="History" icon="history" />
      {history.length === 0 && <Body muted>No workouts yet.</Body>}
      {history.map((w) => {
        const sum = summarize(w, sets);
        const names = [...new Set(sets.filter((x) => x.workoutId === w.id).map((x) => exName.get(x.exerciseId)))].filter(Boolean);
        return (
          <Pressable key={w.id} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{w.name}</Text>
                <Text style={{ color: c.textSecondary }}>{prettyDate(w.date, today)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                <WorkoutFact icon="timer" text={formatDuration(sum.durationSec)} />
                <WorkoutFact icon="check" text={`${sum.sets} sets`} />
                {sum.volume > 0 && <WorkoutFact icon="workouts" text={`${Math.round(sum.volume)} kg`} />}
              </View>
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

function WorkoutFact({ icon, text }: { icon: UiIconName; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={15} color={c.textSecondary} />
      <Text style={{ color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingLeft: 12, paddingRight: 16, borderRadius: 999 },
});
