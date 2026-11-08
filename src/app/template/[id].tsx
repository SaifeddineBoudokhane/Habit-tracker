import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { ExercisePicker } from '@/components/exercise-picker';
import { Body, Button, Card, IconButton, Input, Label } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { useWorkoutActions } from '@/data/workout-actions';

export default function TemplateScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { templates, exercises, saveTemplate, removeTemplate, workouts } = useStore();
  const { startWorkout } = useWorkoutActions();
  const [picking, setPicking] = useState(false);
  const t = templates.find((x) => x.id === id);
  if (!t) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  const exName = new Map(exercises.map((e) => [e.id, e.name]));

  const move = (i: number, d: number) => {
    const ids = [...t.exerciseIds];
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveTemplate({ ...t, exerciseIds: ids });
  };

  return (
    <KeyboardAwareScrollView bottomOffset={24} style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Label>Name</Label>
        <Input value={t.name} onChangeText={(name) => saveTemplate({ ...t, name })} />
      </Card>
      <Card>
        <Label>Exercises</Label>
        {t.exerciseIds.length === 0 && <Body muted>No exercises.</Body>}
        {t.exerciseIds.map((eid, i) => (
          <View key={eid} style={[s.row, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{exName.get(eid) ?? '?'}</Text>
            <IconButton icon="arrow_upward" label="Move up" color={c.textSecondary} onPress={() => move(i, -1)} disabled={i === 0} />
            <IconButton icon="arrow_downward" label="Move down" color={c.textSecondary} onPress={() => move(i, 1)} disabled={i === t.exerciseIds.length - 1} />
            <IconButton icon="close" label="Remove exercise" color={c.danger} onPress={() => saveTemplate({ ...t, exerciseIds: t.exerciseIds.filter((x) => x !== eid) })} />
          </View>
        ))}
        <Button title="Add exercise" icon="add" kind="secondary" style={{ marginTop: 10 }} onPress={() => setPicking(true)} />
      </Card>
      <Button
        title="Start this workout"
        onPress={() => {
          if (workouts.some((w) => w.finishedAt === null)) return Alert.alert('Workout in progress', 'Finish or discard the current workout first.');
          const wid = startWorkout(t);
          router.replace({ pathname: '/workout/[id]', params: { id: wid } });
        }}
      />
      <Button
        title="Delete template"
        kind="danger"
        onPress={() =>
          Alert.alert('Delete template?', 'Past workouts are kept.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                router.back();
                removeTemplate(t.id);
              },
            },
          ])
        }
      />
      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false);
          if (!t.exerciseIds.includes(e.id)) saveTemplate({ ...t, exerciseIds: [...t.exerciseIds, e.id] });
        }}
      />
    </KeyboardAwareScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
