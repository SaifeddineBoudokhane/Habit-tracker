import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Body, Button, Card, Label, NumberInput, Segmented } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { newId, useStore } from '@/data/store';
import { addDays, toKey } from '@/lib/dates';
import type { Goal } from '@/lib/types';

type Preset = 'month' | 'year' | 'd30' | 'd90' | 'custom';

function presetRange(p: Preset, today: string): [string, string] {
  const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  switch (p) {
    case 'month':
      return [toKey(d), toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    case 'year':
      return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`];
    case 'd90':
      return [today, addDays(today, 89)];
    default:
      return [today, addDays(today, 29)];
  }
}

export default function GoalEditScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { habitId, id } = useLocalSearchParams<{ habitId: string; id?: string }>();
  const { habits, goals, saveGoal, removeGoal, today } = useStore();
  const habit = habits.find((h) => h.id === habitId);
  const existing = goals.find((g) => g.id === id);
  const numeric = habit?.kind === 'count' || habit?.kind === 'duration';

  const [metric, setMetric] = useState<Goal['metric']>(existing?.metric ?? (numeric ? 'value' : 'days'));
  const [target, setTarget] = useState(existing?.target ?? 20);
  const [preset, setPreset] = useState<Preset>(existing ? 'custom' : 'month');
  const [range, setRange] = useState<[string, string]>(existing ? [existing.start, existing.end] : presetRange('month', today));

  useLayoutEffect(() => {
    nav.setOptions({ title: existing ? 'Edit goal' : 'New goal' });
  }, [nav, existing]);

  if (!habit) return null;
  const unit = metric === 'value' ? habit.unit || (habit.kind === 'duration' ? 'minutes' : 'total') : habit.kind === 'avoid' ? 'clean days' : 'days done';

  const save = () => {
    if (range[1] < range[0]) return Alert.alert('Check dates', 'The end date is before the start date.');
    saveGoal({ id: existing?.id ?? newId(), habitId: habit.id, metric, target, start: range[0], end: range[1] });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Body muted>
        {habit.emoji} {habit.name}
      </Body>
      {numeric && (
        <Card>
          <Label>Count</Label>
          <Segmented
            options={[
              { value: 'value', label: `Total ${habit.unit || (habit.kind === 'duration' ? 'minutes' : 'amount')}` },
              { value: 'days', label: 'Days goal met' },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </Card>
      )}
      <Card>
        <Label>Target</Label>
        <View style={s.inline}>
          <NumberInput value={target} onChange={setTarget} />
          <Body>{unit}</Body>
        </View>
      </Card>
      <Card>
        <Label>Period</Label>
        <Segmented
          options={[
            { value: 'month', label: 'This month' },
            { value: 'year', label: 'This year' },
            { value: 'd30', label: 'Next 30 days' },
            { value: 'd90', label: 'Next 90 days' },
            { value: 'custom', label: 'Custom' },
          ]}
          value={preset}
          onChange={(p) => {
            setPreset(p);
            if (p !== 'custom') setRange(presetRange(p, today));
          }}
        />
        <View style={[s.inline, { marginTop: 12 }]}>
          <DateField value={range[0]} onChange={(v) => { setPreset('custom'); setRange([v, range[1]]); }} />
          <Body>to</Body>
          <DateField value={range[1]} onChange={(v) => { setPreset('custom'); setRange([range[0], v]); }} />
        </View>
      </Card>
      <Button title={existing ? 'Save goal' : 'Create goal'} onPress={save} />
      {existing && (
        <Button
          title="Delete goal"
          kind="danger"
          onPress={() => {
            removeGoal(existing.id);
            router.back();
          }}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
