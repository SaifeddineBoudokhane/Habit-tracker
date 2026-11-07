import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { tapped } from '@/data/actions';
import { useStore } from '@/data/store';
import { useTicker } from '@/data/timers';
import { formatDuration } from '@/lib/workouts';
import { getEntry, isComplete, weekCount } from '@/lib/schedule';
import { computeStats } from '@/lib/streaks';
import type { Habit } from '@/lib/types';

import { ProgressRing } from './progress-ring';

export function HabitRow({ habit, date, onEdit }: { habit: Habit; date: string; onEdit: () => void }) {
  const c = useColors();
  const { index, updateEntry, today, settings } = useStore();
  const timerStart = habit.kind === 'duration' ? (settings.timers?.[habit.id] ?? null) : null;
  const now = useTicker(timerStart !== null);
  const entry = getEntry(index, habit.id, date);
  const done = isComplete(habit, entry);
  const stats = computeStats(habit, index, today);
  const value = entry?.value ?? 0;

  const parts: string[] = [];
  if (entry?.skipped) parts.push('Skipped');
  else if (habit.kind === 'count') parts.push(`${value} / ${habit.target} ${habit.unit}`.trim());
  else if (habit.kind === 'duration') parts.push(`${value} / ${habit.target} min`);
  if (habit.schedule.type === 'perWeek' && habit.kind !== 'avoid')
    parts.push(`${weekCount(habit, index, date)}/${habit.schedule.times} this week`);
  if (habit.kind === 'avoid') {
    parts.push(value >= 1 ? 'Slipped' : `${stats.current} ${stats.current === 1 ? 'day' : 'days'} clean`);
  } else if (stats.current > 0) {
    parts.push(`🔥 ${stats.current} ${stats.unit === 'weeks' ? 'wk' : stats.current === 1 ? 'day' : 'days'}`);
  }

  if (timerStart !== null) parts.unshift(`⏱ ${formatDuration((now - timerStart) / 1000)}`);

  const onTap = () => updateEntry(habit.id, date, (e) => tapped(habit, e));

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        row.wrap,
        { backgroundColor: c.card, borderColor: c.border, borderLeftWidth: 4, borderLeftColor: habit.color, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[row.icon, { backgroundColor: habit.color + '26' }]}>
        <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            row.name,
            { color: c.text },
            (done || entry?.skipped) && habit.kind !== 'avoid' && { color: c.textSecondary },
          ]}
          numberOfLines={1}>
          {habit.name}
        </Text>
        {parts.length > 0 && (
          <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{parts.join(' · ')}</Text>
        )}
      </View>
      <ActionButton habit={habit} value={value} done={done} skipped={!!entry?.skipped} onPress={onTap} />
    </Pressable>
  );
}

function ActionButton({
  habit,
  value,
  done,
  skipped,
  onPress,
}: {
  habit: Habit;
  value: number;
  done: boolean;
  skipped: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const hit = { top: 10, bottom: 10, left: 10, right: 10 };

  if (habit.kind === 'avoid') {
    const slipped = value >= 1;
    return (
      <Pressable
        onPress={onPress}
        hitSlop={hit}
        style={[row.slip, { borderColor: slipped ? c.danger : c.border, backgroundColor: slipped ? c.danger + '22' : 'transparent' }]}>
        <Text style={{ color: slipped ? c.danger : c.textSecondary, fontWeight: '600', fontSize: 13 }}>
          {slipped ? 'Slipped' : 'Slipped?'}
        </Text>
      </Pressable>
    );
  }

  if (habit.kind === 'check') {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={hit}
        style={[
          row.check,
          { borderColor: done ? habit.color : c.border, backgroundColor: done ? habit.color : 'transparent' },
        ]}>
        <Text style={{ color: done ? '#fff' : c.textSecondary, fontSize: 20, fontWeight: '700' }}>
          {skipped ? '–' : done ? '✓' : ''}
        </Text>
      </Pressable>
    );
  }

  const label = done ? '✓' : habit.kind === 'count' ? '+1' : `+${habit.target >= 30 ? 10 : 5}`;
  return (
    <Pressable onPress={onPress} hitSlop={hit}>
      <ProgressRing progress={value / habit.target} color={habit.color} track={c.muted} size={46} stroke={5}>
        <Text style={{ color: done ? habit.color : c.text, fontWeight: '700', fontSize: done ? 18 : 13 }}>{label}</Text>
      </ProgressRing>
    </Pressable>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  check: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  slip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
});
