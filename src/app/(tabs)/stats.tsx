import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoalCard } from '@/components/goal-card';
import { Icon } from '@/components/icon';
import { Body, Card, HabitIconTile, Label } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { addDays, weekStart } from '@/lib/dates';
import { goalProgress } from '@/lib/goals';
import { habitIcon } from '@/lib/habit-icon';
import { periodRate } from '@/lib/stats';
import { computeStats } from '@/lib/streaks';
import { summarize } from '@/lib/workouts';

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export default function StatsScreen() {
  const c = useColors();
  const { habits, index, today, goals, workouts, sets } = useStore();
  const active = habits.filter((h) => !h.archived);
  const rows = active.map((h) => ({
    habit: h,
    d7: periodRate(h, index, addDays(today, -6), today, today),
    d30: periodRate(h, index, addDays(today, -29), today, today),
    streak: computeStats(h, index, today),
  }));
  const week = avg(active.map((h) => periodRate(h, index, weekStart(today), today, today)));
  const month = avg(rows.map((r) => r.d30));
  const allTime = avg(active.map((h) => periodRate(h, index, '0000-01-01', today, today)));

  const habitById = new Map(habits.map((h) => [h.id, h]));
  const activeGoals = goals
    .filter((g) => habitById.get(g.habitId) && g.end >= today)
    .sort((a, b) => (a.end < b.end ? -1 : 1));
  const reached = goals.filter((g) => {
    const h = habitById.get(g.habitId);
    return h && g.end < today && goalProgress(g, h, index, today).status === 'done';
  }).length;

  const finished = workouts.filter((w) => w.finishedAt);
  const thisWeek = finished.filter((w) => w.date >= weekStart(today));
  const thisMonth = finished.filter((w) => w.date.slice(0, 7) === today.slice(0, 7));
  const monthVolume = thisMonth.reduce((a, w) => a + summarize(w, sets).volume, 0);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Label>Overall completion</Label>
        <View style={s.three}>
          <Big value={pct(week)} label="This week" />
          <Big value={pct(month)} label="Last 30 days" />
          <Big value={pct(allTime)} label="All time" />
        </View>
      </Card>

      <Card>
        <Label>Goals</Label>
        {activeGoals.length === 0 && <Body muted>No active goals. Add one from a habit’s page.</Body>}
        {activeGoals.map((g) => (
          <GoalCard key={g.id} goal={g} habit={habitById.get(g.habitId)!} showHabit />
        ))}
        {reached > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Icon name="trophy" size={16} color="#eab308" />
            <Body muted style={{ fontSize: 13 }}>
              {reached} past goal{reached === 1 ? '' : 's'} reached
            </Body>
          </View>
        )}
      </Card>

      <Card>
        <Label>Habits</Label>
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <Text style={[s.name, { color: c.textSecondary, fontSize: 12 }]}>Habit</Text>
          <Text style={[s.num, { color: c.textSecondary, fontSize: 12 }]} numberOfLines={1}>7d</Text>
          <Text style={[s.num, { color: c.textSecondary, fontSize: 12 }]} numberOfLines={1}>30d</Text>
          <View style={[s.num, { alignItems: 'flex-end' }]}>
            <Icon name="streak" size={16} color={c.textSecondary} />
          </View>
        </View>
        {rows.map(({ habit, d7, d30, streak }, i) => (
          <Pressable
            key={habit.id}
            onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
            style={[s.row, { borderColor: c.border }, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[s.name, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <HabitIconTile icon={habitIcon(habit)} color={habit.color} size={28} />
              <Text style={{ color: c.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
                {habit.name}
              </Text>
            </View>
            <Text style={[s.num, { color: c.text }]}>{pct(d7)}</Text>
            <Text style={[s.num, { color: c.text }]}>{pct(d30)}</Text>
            <Text style={[s.num, { color: c.text }]}>
              {streak.current}
              {streak.unit === 'weeks' ? 'w' : 'd'}
            </Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Label>Workouts</Label>
        <View style={s.three}>
          <Big value={String(thisWeek.length)} label="This week" />
          <Big value={String(thisMonth.length)} label="This month" />
          <Big value={monthVolume >= 1000 ? `${(monthVolume / 1000).toFixed(1)}t` : `${Math.round(monthVolume)}kg`} label="Volume" />
        </View>
      </Card>
    </ScrollView>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  three: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontSize: 15 },
  num: { width: 54, textAlign: 'right', fontSize: 14, fontVariant: ['tabular-nums'] },
});
