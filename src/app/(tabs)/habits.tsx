import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { describeSchedule } from '@/lib/schedule';
import { computeStats } from '@/lib/streaks';
import type { Habit } from '@/lib/types';

export default function HabitsScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { habits, reorderHabits } = useStore();
  const [showArchived, setShowArchived] = useState(false);
  const [reordering, setReordering] = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => setReordering((r) => !r)} hitSlop={12} style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600' }}>{reordering ? 'Done' : 'Reorder'}</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={() => router.push('/habit/edit')} hitSlop={12} style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: c.accent, fontSize: 28, fontWeight: '400' }}>＋</Text>
        </Pressable>
      ),
    });
  }, [nav, c.accent, reordering]);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.list}>
      {active.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 32, gap: 16 }}>
          <Body muted>No habits yet.</Body>
          <Button title="New habit" onPress={() => router.push('/habit/edit')} />
        </View>
      )}
      {active.map((h, i) =>
        reordering ? (
          <View key={h.id} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ fontSize: 22 }}>{h.emoji}</Text>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }} numberOfLines={1}>
              {h.name}
            </Text>
            {[-1, 1].map((d) => (
              <Pressable
                key={d}
                disabled={i + d < 0 || i + d >= active.length}
                hitSlop={8}
                style={{ paddingHorizontal: 10, opacity: i + d < 0 || i + d >= active.length ? 0.3 : 1 }}
                onPress={() => {
                  const ids = active.map((x) => x.id);
                  [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
                  reorderHabits([...ids, ...archived.map((x) => x.id)]);
                }}>
                <Text style={{ color: c.text, fontSize: 22 }}>{d < 0 ? '↑' : '↓'}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <HabitCard key={h.id} habit={h} />
        ),
      )}
      {archived.length > 0 && (
        <>
          <Pressable onPress={() => setShowArchived((v) => !v)} style={{ paddingVertical: 12 }}>
            <Text style={{ color: c.textSecondary, fontWeight: '600' }}>
              {showArchived ? '▾' : '▸'} Archived ({archived.length})
            </Text>
          </Pressable>
          {showArchived && archived.map((h) => <HabitCard key={h.id} habit={h} />)}
        </>
      )}
    </ScrollView>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const c = useColors();
  const { index, today } = useStore();
  const st = computeStats(habit, index, today);
  const unit = st.unit === 'weeks' ? 'wk' : 'd';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
      style={({ pressed }) => [s.card, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[s.icon, { backgroundColor: habit.color + '26' }]}>
        <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>
          {habit.kind === 'avoid' ? 'Avoid' : describeSchedule(habit)}
          {habit.reminders.length > 0 ? ' · 🔔' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
          {habit.kind === 'avoid' ? '🛡️' : '🔥'} {st.current}
          {unit}
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          best {st.best}
          {unit}
          {st.rate30 !== null ? ` · ${Math.round(st.rate30 * 100)}%` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
