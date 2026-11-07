import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';

import { EntryEditor } from '@/components/entry-editor';
import { GoalCard } from '@/components/goal-card';
import { WeekdayBars } from '@/components/weekday-bars';
import { YearHeatmap } from '@/components/year-heatmap';
import { Body, Button, Card, Label } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { addDays, fromKey, getWeekStartDay, monthLabel, prettyDate, toKey, weekStart, weekdayShort } from '@/lib/dates';
import { reminderTimes } from '@/lib/reminders';
import { describeSchedule, getEntry, isComplete, isScheduled, isSlip } from '@/lib/schedule';
import { periodRate, weekdayStats } from '@/lib/stats';
import { computeStats } from '@/lib/streaks';
import type { Habit } from '@/lib/types';

export default function HabitDetailScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, index, today, saveHabit, removeHabit, goals, updateSettings } = useStore();
  const habit = habits.find((h) => h.id === id);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  useLayoutEffect(() => {
    nav.setOptions({
      title: habit ? `${habit.emoji} ${habit.name}` : '',
      headerRight: () =>
        habit && (
          <Pressable onPress={() => router.push({ pathname: '/habit/edit', params: { id: habit.id } })} hitSlop={12}>
            <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600' }}>Edit</Text>
          </Pressable>
        ),
    });
  }, [nav, habit, c.accent]);

  if (!habit) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  const st = computeStats(habit, index, today);
  const unit = st.unit === 'weeks' ? 'weeks' : 'days';
  const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);
  const rates = [
    { label: 'This week', value: periodRate(habit, index, weekStart(today), today, today) },
    { label: 'This month', value: periodRate(habit, index, today.slice(0, 8) + '01', today, today) },
    { label: 'All time', value: periodRate(habit, index, '0000-01-01', today, today) },
  ];
  const myGoals = goals.filter((g) => g.habitId === habit.id).sort((a, b) => (a.end < b.end ? -1 : 1));
  const notes = [...(index.get(habit.id)?.values() ?? [])]
    .filter((e) => e.note)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);

  const confirmDelete = () =>
    Alert.alert('Delete habit?', `This permanently deletes "${habit.name}" and all its history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          removeHabit(habit.id);
        },
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.stats}>
        <Stat label={habit.kind === 'avoid' ? 'Days clean' : `Streak (${unit})`} value={String(st.current)} />
        <Stat label={`Best (${unit})`} value={String(st.best)} />
        <Stat label="Last 30 days" value={st.rate30 === null ? '–' : `${Math.round(st.rate30 * 100)}%`} />
        <Stat
          label={habit.kind === 'avoid' ? 'Slips' : habit.kind === 'check' ? 'Times done' : `Total ${habit.unit}`}
          value={String(habit.kind === 'count' || habit.kind === 'duration' ? Math.round(st.totalValue) : st.totalDone)}
        />
      </View>

      <Card>
        <Label>Completion</Label>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {rates.map((r) => (
            <View key={r.label} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{pct(r.value)}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{r.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <MonthCalendar habit={habit} onPick={setEditingDate} />
        <Body muted style={{ fontSize: 13, marginTop: 10 }}>Tap a day to fix it, fill it in, or add a note.</Body>
      </Card>

      <Card>
        <Label>Last 12 months</Label>
        <YearHeatmap habit={habit} />
      </Card>

      <Card>
        <Label>Goals</Label>
        {myGoals.length === 0 && <Body muted>No goals yet, e.g. “150 workouts this year”.</Body>}
        {myGoals.map((g) => (
          <GoalCard key={g.id} goal={g} habit={habit} />
        ))}
        <Button
          title="+ Add goal"
          kind="secondary"
          style={{ marginTop: 10 }}
          onPress={() => router.push({ pathname: '/goal/edit', params: { habitId: habit.id } })}
        />
      </Card>

      <Card>
        <Label>{habit.kind === 'avoid' ? 'Clean days by weekday' : 'Best and worst days'}</Label>
        <WeekdayBars stats={weekdayStats(habit, index, today)} color={habit.color} />
      </Card>

      {notes.length > 0 && (
        <Card>
          <Label>Notes</Label>
          {notes.map((e) => (
            <Pressable key={e.date} onPress={() => setEditingDate(e.date)} style={{ paddingVertical: 6 }}>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{prettyDate(e.date, today)}</Text>
              <Body>{e.note}</Body>
            </Pressable>
          ))}
        </Card>
      )}

      <Card>
        <Label>Details</Label>
        <Body>{habit.kind === 'avoid' ? 'Avoid habit' : describeSchedule(habit)}</Body>
        {(habit.kind === 'count' || habit.kind === 'duration') && (
          <Body muted>
            Goal: {habit.target} {habit.unit} per day
          </Body>
        )}
        {habit.reminders.map((r) => (
          <Body key={r.id} muted>
            🔔 {r.kind === 'fixed' ? `At ${r.time}` : `Every ${r.everyMin} min, ${r.start}–${r.end} (${reminderTimes(r).length}×/day)`}
          </Body>
        ))}
      </Card>

      <View style={{ gap: 10 }}>
        {Platform.OS === 'android' && !habit.archived && (
          <Button
            title="➕ Add widget to home screen"
            kind="secondary"
            onPress={async () => {
              await updateSettings({ pendingWidgetHabit: habit.id });
              const ok = await requestPinWidget({ widgetName: 'Habit' }).catch(() => false);
              if (!ok)
                Alert.alert(
                  'Add it from the home screen',
                  'Long-press an empty spot on your home screen → Widgets → Habit Tracker → Single habit.',
                );
            }}
          />
        )}
        <Button
          title={habit.archived ? 'Unarchive' : 'Archive (hide, keep history)'}
          kind="secondary"
          onPress={() => saveHabit({ ...habit, archived: !habit.archived })}
        />
        <Button title="Delete habit" kind="danger" onPress={confirmDelete} />
      </View>

      <EntryEditor habit={editingDate ? habit : null} date={editingDate ?? today} onClose={() => setEditingDate(null)} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={[s.stat, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}


function MonthCalendar({ habit, onPick }: { habit: Habit; onPick: (date: string) => void }) {
  const c = useColors();
  const { index, today } = useStore();
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');

  const first = fromKey(month);
  const startDay = getWeekStartDay();
  const weekHeader = Array.from({ length: 7 }, (_, i) => (startDay + i) % 7);
  const lead = (first.getDay() - startDay + 7) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 0; d < daysInMonth; d++) cells.push(addDays(month, d));
  while (cells.length % 7) cells.push(null);

  const shiftMonth = (n: number) => setMonth(toKey(new Date(first.getFullYear(), first.getMonth() + n, 1)));

  return (
    <View>
      <View style={s.calHeader}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={12}>
          <Text style={{ color: c.text, fontSize: 24 }}>‹</Text>
        </Pressable>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{monthLabel(month)}</Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={12} disabled={month >= today.slice(0, 7) + '-01'}>
          <Text style={{ color: month >= today.slice(0, 7) + '-01' ? c.border : c.text, fontSize: 24 }}>›</Text>
        </Pressable>
      </View>
      <View style={s.grid}>
        {weekHeader.map((d) => (
          <Text key={d} style={[s.headCell, { color: c.textSecondary }]}>
            {weekdayShort(d).slice(0, 2)}
          </Text>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={s.cell} />;
          const e = getEntry(index, habit.id, d);
          const future = d > today;
          const scheduled = habit.kind === 'avoid' || isScheduled(habit, d);
          let bg = 'transparent';
          let fg = scheduled ? c.text : c.textSecondary;
          let border = 'transparent';
          if (habit.kind === 'avoid') {
            if (isSlip(habit, e)) {
              bg = c.danger;
              fg = '#fff';
            } else if (!future && d >= habit.startDate) {
              bg = habit.color + '40';
            }
          } else if (e?.skipped) {
            border = c.textSecondary;
            fg = c.textSecondary;
          } else if (isComplete(habit, e)) {
            bg = habit.color;
            fg = '#fff';
          } else if (e && e.value > 0) {
            bg = habit.color + '55';
          }
          if (d === today) border = c.text;
          return (
            <Pressable key={d} style={s.cell} disabled={future} onPress={() => onPick(d)}>
              <View style={[s.day, { backgroundColor: bg, borderColor: border, opacity: future ? 0.35 : 1 }]}>
                <Text style={{ color: fg, fontSize: 13, fontWeight: scheduled ? '600' : '400' }}>
                  {Number(d.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  headCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: '84%', height: '84%', borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
