import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EntryEditor } from '@/components/entry-editor';
import { HabitRow } from '@/components/habit-row';
import { Body, Button } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { addDays, prettyDate } from '@/lib/dates';
import { getEntry, isComplete, isDueOn } from '@/lib/schedule';
import type { Habit, HabitGroup } from '@/lib/types';

const GROUPS: { key: HabitGroup; label: string }[] = [
  { key: 'morning', label: '🌅 Morning' },
  { key: 'afternoon', label: '☀️ Afternoon' },
  { key: 'evening', label: '🌙 Evening' },
  { key: 'anytime', label: 'Anytime' },
];

export default function TodayScreen() {
  const c = useColors();
  const { habits, index, today, ready } = useStore();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const date = addDays(today, offset);

  const active = habits.filter((h) => !h.archived && h.startDate <= date);
  const due = active.filter((h) => isDueOn(h, index, date));
  const others = active.filter((h) => !isDueOn(h, index, date));
  const sections = GROUPS.map((g) => ({ ...g, items: due.filter((h) => (h.group ?? 'anytime') === g.key) })).filter(
    (g) => g.items.length > 0,
  );
  const trackable = due.filter((h) => h.kind !== 'avoid');
  const doneCount = trackable.filter((h) => {
    const e = getEntry(index, h.id, date);
    return isComplete(h, e) || e?.skipped;
  }).length;

  if (ready && habits.length === 0) {
    return (
      <View style={[s.empty, { backgroundColor: c.background }]}>
        <Text style={{ fontSize: 48 }}>🌱</Text>
        <Text style={[s.emptyTitle, { color: c.text }]}>No habits yet</Text>
        <Body muted style={{ textAlign: 'center', marginBottom: 20 }}>
          Add things like a workout, drinking water, or reading.
        </Body>
        <Button title="Create your first habit" onPress={() => router.push('/habit/edit')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[s.dateBar, { borderColor: c.border, backgroundColor: c.card }]}>
        <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={12} style={s.arrow}>
          <Text style={[s.arrowText, { color: c.text }]}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setOffset(0)} style={{ alignItems: 'center' }}>
          <Text style={[s.dateText, { color: c.text }]}>{prettyDate(date, today)}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            {trackable.length ? `${doneCount} of ${trackable.length} done` : ' '}
          </Text>
        </Pressable>
        <Pressable onPress={() => setOffset((o) => Math.min(0, o + 1))} hitSlop={12} style={s.arrow} disabled={offset === 0}>
          <Text style={[s.arrowText, { color: offset === 0 ? c.border : c.text }]}>›</Text>
        </Pressable>
      </View>
      {trackable.length > 0 && (
        <View style={[s.progressTrack, { backgroundColor: c.muted }]}>
          <View style={[s.progressFill, { backgroundColor: c.success, width: `${(doneCount / trackable.length) * 100}%` }]} />
        </View>
      )}

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {due.length === 0 && <Body muted style={{ textAlign: 'center', marginTop: 24 }}>Nothing due {offset === 0 ? 'today' : 'this day'} 🎉</Body>}
        {sections.map(({ key, label, items }) => (
          <View key={key} style={{ gap: 10 }}>
            {sections.length > 1 && <Text style={[s.section, { color: c.textSecondary }]}>{label}</Text>}
            {items.map((h) => (
              <HabitRow key={h.id} habit={h} date={date} onEdit={() => setEditing(h)} />
            ))}
          </View>
        ))}

        {others.length > 0 && (
          <>
            <Pressable onPress={() => setShowOthers((v) => !v)} style={{ paddingVertical: 12 }}>
              <Text style={{ color: c.textSecondary, fontWeight: '600' }}>
                {showOthers ? '▾' : '▸'} Not due {offset === 0 ? 'today' : 'this day'} ({others.length})
              </Text>
            </Pressable>
            {showOthers && others.map((h) => <HabitRow key={h.id} habit={h} date={date} onEdit={() => setEditing(h)} />)}
          </>
        )}
      </ScrollView>

      <EntryEditor habit={editing} date={date} onClose={() => setEditing(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 30, fontWeight: '300' },
  dateText: { fontSize: 18, fontWeight: '700' },
  progressTrack: { height: 4 },
  progressFill: { height: 4 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginVertical: 8 },
});
