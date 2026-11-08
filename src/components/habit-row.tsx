import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, tint, type as typo, useColors } from '@/constants/theme';
import { minusStep, stepOf, tapped } from '@/data/actions';
import { useStore } from '@/data/store';
import { useTicker } from '@/data/timers';
import { habitIcon } from '@/lib/habit-icon';
import { formatDuration } from '@/lib/workouts';
import { getEntry, isComplete, weekCount } from '@/lib/schedule';
import { computeStats } from '@/lib/streaks';
import type { Habit } from '@/lib/types';

import { Icon, type UiIconName } from './icon';
import { ProgressRing } from './progress-ring';
import { HabitIconTile } from './ui';

type Meta = { text: string; icon?: UiIconName; color?: string };

export function HabitRow({ habit, date, onEdit }: { habit: Habit; date: string; onEdit: () => void }) {
  const c = useColors();
  const { index, updateEntry, today, settings } = useStore();
  const timerStart = habit.kind === 'duration' ? (settings.timers?.[habit.id] ?? null) : null;
  const now = useTicker(timerStart !== null);
  const entry = getEntry(index, habit.id, date);
  const done = isComplete(habit, entry);
  const stats = computeStats(habit, index, today);
  const value = entry?.value ?? 0;

  const meta: Meta[] = [];
  if (timerStart !== null) meta.push({ icon: 'timer', text: formatDuration((now - timerStart) / 1000), color: habit.color });
  if (entry?.skipped) meta.push({ icon: 'skip_next', text: 'Skipped' });
  else if (habit.kind === 'count') meta.push({ text: `${value} / ${habit.target} ${habit.unit}`.trim() });
  else if (habit.kind === 'duration') meta.push({ text: `${value} / ${habit.target} min` });
  if (habit.schedule.type === 'perWeek' && habit.kind !== 'avoid')
    meta.push({ icon: 'event_repeat', text: `${weekCount(habit, index, date)}/${habit.schedule.times} this week` });
  if (habit.kind === 'avoid') {
    meta.push(
      value >= 1
        ? { text: 'Slipped today', color: c.danger }
        : { icon: 'shield', text: `${stats.current} ${stats.current === 1 ? 'day' : 'days'} clean` },
    );
  } else if (stats.current > 0) {
    meta.push({
      icon: 'streak',
      text: `${stats.current} ${stats.unit === 'weeks' ? (stats.current === 1 ? 'week' : 'weeks') : stats.current === 1 ? 'day' : 'days'}`,
      color: '#f97316',
    });
  }

  const onTap = () => updateEntry(habit.id, date, (e) => tapped(habit, e));
  const settled = (done || !!entry?.skipped) && habit.kind !== 'avoid';

  return (
    <Pressable
      onPress={onEdit}
      accessibilityHint="Opens details to log an exact value, skip or add a note"
      style={({ pressed }) => [row.wrap, { backgroundColor: pressed ? c.muted : c.card }]}>
      <HabitIconTile icon={habitIcon(habit)} color={habit.color} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[typo.rowTitle, { color: settled ? c.textSecondary : c.text }]} numberOfLines={1}>
          {habit.name}
        </Text>
        {meta.length > 0 && (
          <View style={row.meta}>
            {meta.map((m, i) => (
              <View key={i} style={row.metaItem}>
                {m.icon && <Icon name={m.icon} size={14} color={m.color ?? c.textSecondary} />}
                <Text style={[typo.subhead, { color: m.color && !m.icon ? m.color : c.textSecondary, fontVariant: ['tabular-nums'] }]}>{m.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <ActionButton
        habit={habit}
        value={value}
        done={done}
        skipped={!!entry?.skipped}
        onPress={onTap}
        onMinus={() => updateEntry(habit.id, date, (e) => minusStep(habit, e))}
        onLongPress={onEdit}
      />
    </Pressable>
  );
}

function ActionButton({
  habit,
  value,
  done,
  skipped,
  onPress,
  onMinus,
  onLongPress,
}: {
  habit: Habit;
  value: number;
  done: boolean;
  skipped: boolean;
  onPress: () => void;
  onMinus: () => void;
  onLongPress: () => void;
}) {
  const c = useColors();
  const hit = { top: 10, bottom: 10, left: 10, right: 10 };

  if (habit.kind === 'avoid') {
    const slipped = value >= 1;
    return (
      <Pressable
        onPress={onPress}
        hitSlop={hit}
        accessibilityRole="button"
        accessibilityLabel={slipped ? 'Undo slip' : 'Log a slip'}
        style={[row.slip, { backgroundColor: slipped ? tint(c.danger, 0.14) : c.muted }]}>
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
        testID={`check-${habit.id}`}
        accessibilityRole="checkbox"
        accessibilityLabel={habit.name}
        accessibilityState={{ checked: done }}
        style={[
          row.check,
          done
            ? { backgroundColor: habit.color, borderColor: habit.color }
            : skipped
              ? { backgroundColor: c.muted, borderColor: c.muted }
              : { borderColor: tint(habit.color, 0.55) },
        ]}>
        {done && <Icon name="check" size={26} color="#fff" />}
        {skipped && !done && <Icon name="skip_next" size={22} color={c.textSecondary} />}
      </Pressable>
    );
  }

  const step = stepOf(habit);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {value > 0 && (
        <Pressable
          onPress={onMinus}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 4 }}
          testID={`minus-${habit.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Minus ${step}`}
          style={({ pressed }) => [row.minus, { backgroundColor: pressed ? c.border : c.muted }]}>
          <Icon name="remove" size={18} color={c.text} />
        </Pressable>
      )}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        hitSlop={hit}
        testID={`plus-${habit.id}`}
        accessibilityRole="button"
        accessibilityLabel={done ? `${habit.name} done` : `Plus ${step}`}>
        <ProgressRing progress={value / habit.target} color={habit.color} track={tint(habit.color, 0.18)} size={48} stroke={5}>
          {done ? (
            <View style={[row.ringDone, { backgroundColor: habit.color }]}>
              <Icon name="check" size={22} color="#fff" />
            </View>
          ) : (
            <Text style={{ color: habit.color, fontWeight: '700', fontSize: step >= 100 ? 11 : 14 }}>{`+${step}`}</Text>
          )}
        </ProgressRing>
      </Pressable>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: space.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    minHeight: 72,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  check: { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  slip: { borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 12 },
  minus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ringDone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
