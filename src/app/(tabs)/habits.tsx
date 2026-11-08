import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, EmptyState, HabitIconTile, IconButton } from '@/components/ui';
import { radius, space, type as typo, useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { habitIcon } from '@/lib/habit-icon';
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
        <Pressable onPress={() => setReordering((r) => !r)} hitSlop={12} style={{ paddingHorizontal: 16 }} accessibilityRole="button">
          <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600' }}>{reordering ? 'Done' : 'Reorder'}</Text>
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ paddingHorizontal: 8 }}>
          <IconButton icon="add" label="New habit" color={c.accent} onPress={() => router.push('/habit/edit')} size={44} />
        </View>
      ),
    });
  }, [nav, c.accent, reordering]);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
      {active.length === 0 && (
        <EmptyState
          icon="habits"
          title="No habits yet"
          body="Habits you add show up here with their streaks."
          action={<Button title="New habit" icon="add" onPress={() => router.push('/habit/edit')} />}
        />
      )}
      {active.map((h, i) =>
        reordering ? (
          <View key={h.id} style={[s.card, { backgroundColor: c.card }]}>
            <HabitIconTile icon={habitIcon(h)} color={h.color} size={36} />
            <Text style={[typo.rowTitle, { color: c.text, flex: 1 }]} numberOfLines={1}>
              {h.name}
            </Text>
            {[-1, 1].map((d) => (
              <IconButton
                key={d}
                icon={d < 0 ? 'arrow_upward' : 'arrow_downward'}
                label={d < 0 ? `Move ${h.name} up` : `Move ${h.name} down`}
                disabled={i + d < 0 || i + d >= active.length}
                onPress={() => {
                  const ids = active.map((x) => x.id);
                  [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
                  reorderHabits([...ids, ...archived.map((x) => x.id)]);
                }}
              />
            ))}
          </View>
        ) : (
          <HabitCard key={h.id} habit={h} />
        ),
      )}
      {archived.length > 0 && (
        <>
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={showArchived ? 'keyboard_arrow_down' : 'keyboard_arrow_right'} size={20} color={c.textSecondary} />
            <Text style={[typo.section, { color: c.textSecondary }]}>Archived ({archived.length})</Text>
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
  const unit = st.unit === 'weeks' ? 'w' : 'd';
  const avoid = habit.kind === 'avoid';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
      style={({ pressed }) => [s.card, { backgroundColor: pressed ? c.muted : c.card, opacity: habit.archived ? 0.6 : 1 }]}>
      <HabitIconTile icon={habitIcon(habit)} color={habit.color} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[typo.rowTitle, { color: c.text }]} numberOfLines={1}>
          {habit.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[typo.subhead, { color: c.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
            {avoid ? 'Avoid' : describeSchedule(habit)}
          </Text>
          {habit.reminders.length > 0 && <Icon name="notifications" size={14} color={c.textSecondary} />}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Icon
            name={avoid ? 'shield-fill' : 'streak-fill'}
            size={18}
            color={st.current > 0 ? (avoid ? habit.color : '#f97316') : c.border}
          />
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, fontVariant: ['tabular-nums'] }}>
            {st.current}
            {unit}
          </Text>
        </View>
        <Text style={[typo.caption, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
          Best {st.best}
          {unit}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    minHeight: 68,
  },
});
