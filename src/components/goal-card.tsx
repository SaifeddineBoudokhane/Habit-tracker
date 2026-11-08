import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { prettyDate } from '@/lib/dates';
import { goalProgress } from '@/lib/goals';
import type { Goal, Habit } from '@/lib/types';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function GoalCard({ goal, habit, showHabit }: { goal: Goal; habit: Habit; showHabit?: boolean }) {
  const c = useColors();
  const { index, today } = useStore();
  const p = goalProgress(goal, habit, index, today);
  const unit = goal.metric === 'value' ? habit.unit || (habit.kind === 'duration' ? 'min' : '') : 'days';

  const statusText = {
    upcoming: `Starts ${prettyDate(goal.start, today)}`,
    done: 'Goal reached',
    ahead: `On track, ${p.daysLeft} days left`,
    behind: `Behind: need ${fmt(Math.ceil(p.neededPerDay * 10) / 10)}/day, ${p.daysLeft} days left`,
    failed: 'Ended',
  }[p.status];
  const statusColor = p.status === 'done' || p.status === 'ahead' ? c.success : p.status === 'behind' ? c.danger : c.textSecondary;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/goal/edit', params: { habitId: habit.id, id: goal.id } })}
      style={{ gap: 6, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
          {showHabit ? `${habit.name}: ` : ''}
          {fmt(goal.target)} {unit} by {prettyDate(goal.end, today)}
        </Text>
        <Text style={{ color: c.text, fontWeight: '700' }}>
          {fmt(p.current)}/{fmt(goal.target)}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: c.muted, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${p.pct * 100}%`, height: 8, backgroundColor: habit.color, borderRadius: 4 }} />
        {p.status !== 'done' && p.status !== 'upcoming' && (
          <View
            style={{
              position: 'absolute',
              left: `${Math.min(100, (p.expectedNow / p.target) * 100)}%`,
              width: 2,
              height: 8,
              backgroundColor: c.text,
            }}
          />
        )}
      </View>
      <Text style={{ color: statusColor, fontSize: 12 }}>
        {statusText}
        {p.projected && p.status !== 'failed' ? `. At this pace: ${prettyDate(p.projected, today)}` : ''}
      </Text>
    </Pressable>
  );
}
