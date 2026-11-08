import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EntryEditor } from '@/components/entry-editor';
import { HabitRow } from '@/components/habit-row';
import { Icon, type UiIconName } from '@/components/icon';
import { ProgressRing } from '@/components/progress-ring';
import { Button, EmptyState, IconButton, SectionHeader } from '@/components/ui';
import { radius, space, type as typo, useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { addDays, diffDays, prettyDate, weekday } from '@/lib/dates';
import { encouragement } from '@/lib/motivation';
import { getEntry, isComplete, isDueOn } from '@/lib/schedule';
import type { EntryIndex, Habit, HabitGroup } from '@/lib/types';

const GROUPS: { key: HabitGroup; label: string; icon: UiIconName }[] = [
  { key: 'morning', label: 'Morning', icon: 'morning' },
  { key: 'afternoon', label: 'Afternoon', icon: 'afternoon' },
  { key: 'evening', label: 'Evening', icon: 'evening' },
  { key: 'anytime', label: 'Anytime', icon: 'anytime' },
];

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Done / due for the habits that count toward a day (avoid habits don't). */
function dayProgress(habits: Habit[], index: EntryIndex, date: string) {
  const due = habits.filter((h) => !h.archived && h.startDate <= date && h.kind !== 'avoid' && isDueOn(h, index, date));
  const done = due.filter((h) => {
    const e = getEntry(index, h.id, date);
    return isComplete(h, e) || e?.skipped;
  }).length;
  return { done, total: due.length };
}

export default function TodayScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { habits, index, today, ready } = useStore();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const date = addDays(today, offset);
  // The strip shows the week ending on today, or on the selected day when it's further back.
  const stripEnd = offset > -7 ? today : addDays(date, 3);
  const stripDays = Array.from({ length: 7 }, (_, k) => addDays(stripEnd, k - 6));

  useLayoutEffect(() => {
    nav.setOptions({ title: prettyDate(date, today) });
  }, [nav, date, today]);

  const active = habits.filter((h) => !h.archived && h.startDate <= date);
  const due = active.filter((h) => isDueOn(h, index, date));
  const others = active.filter((h) => !isDueOn(h, index, date));
  const sections = GROUPS.map((g) => ({ ...g, items: due.filter((h) => (h.group ?? 'anytime') === g.key) })).filter(
    (g) => g.items.length > 0,
  );
  const { done: doneCount, total } = dayProgress(habits, index, date);
  const message = offset === 0 && habits.length ? encouragement(habits, index, today) : null;
  const allDone = total > 0 && doneCount === total;

  // Don't flash "nothing due" while the database is still loading.
  if (!ready) return <View style={[s.fill, { backgroundColor: c.background }]} />;

  if (habits.length === 0) {
    return (
      <View style={[s.fill, { backgroundColor: c.background, justifyContent: 'center' }]}>
        <EmptyState
          icon="spa"
          title="No habits yet"
          body="Add something you want to do every day, like a workout, drinking water or reading."
          action={<Button title="Create your first habit" icon="add" onPress={() => router.push('/habit/edit')} />}
        />
      </View>
    );
  }

  return (
    <View style={[s.fill, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        <View style={s.strip}>
          <IconButton icon="chevron_left" label="Previous day" onPress={() => setOffset((o) => o - 1)} size={36} color={c.textSecondary} />
          {stripDays.map((d) => {
            const p = dayProgress(habits, index, d);
            const selected = d === date;
            const isToday = d === today;
            const dayColor = selected ? c.accentText : c.text;
            return (
              <Pressable
                key={d}
                onPress={() => setOffset(-diffDays(d, today))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${prettyDate(d, today)}, ${p.done} of ${p.total} done`}
                style={[s.day, selected && { backgroundColor: c.accent }]}>
                <Text style={[s.dayLetter, { color: selected ? c.accentText : isToday ? c.accent : c.textSecondary }]}>
                  {LETTERS[weekday(d)]}
                </Text>
                <ProgressRing
                  progress={p.total ? p.done / p.total : 0}
                  color={selected ? c.accentText : p.total && p.done === p.total ? c.success : c.accent}
                  track={selected ? 'rgba(255,255,255,0.28)' : c.muted}
                  size={32}
                  stroke={3}>
                  <Text style={[s.dayNum, { color: dayColor }]}>{Number(d.slice(8))}</Text>
                </ProgressRing>
              </Pressable>
            );
          })}
          <IconButton
            icon="chevron_right"
            label="Next day"
            onPress={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset === 0}
            size={36}
            color={c.textSecondary}
          />
        </View>

        {total > 0 && (
          <View style={[s.summary, { backgroundColor: c.card }]}>
            <ProgressRing progress={doneCount / total} color={allDone ? c.success : c.accent} track={c.muted} size={56} stroke={6}>
              {allDone ? (
                <Icon name="check" size={26} color={c.success} />
              ) : (
                <Text style={[s.summaryNum, { color: c.text }]}>
                  {doneCount}/{total}
                </Text>
              )}
            </ProgressRing>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typo.headline, { color: c.text }]}>{allDone ? 'All done' : `${doneCount} of ${total} done`}</Text>
              <Text style={[typo.subhead, { color: c.textSecondary }]} numberOfLines={2}>
                {message
                  ? ['trophy', 'streak', 'shield'].includes(message.icon)
                    ? `${message.title}. ${message.body}`
                    : message.body
                  : 'Tap a habit to fix what you logged that day.'}
              </Text>
            </View>
            {offset !== 0 && (
              <Pressable onPress={() => setOffset(0)} hitSlop={8} accessibilityRole="button" style={[s.todayChip, { backgroundColor: c.muted }]}>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Today</Text>
              </Pressable>
            )}
          </View>
        )}

        {due.length === 0 && (
          <EmptyState
            icon="spa"
            title={`Nothing due ${offset === 0 ? 'today' : 'this day'}`}
            body={others.length ? 'Habits that aren’t scheduled are listed below.' : undefined}
          />
        )}

        {sections.map(({ key, label, icon, items }) => (
          <View key={key} style={{ gap: space.sm }}>
            {sections.length > 1 && <SectionHeader title={label} icon={icon} />}
            {items.map((h) => (
              <HabitRow key={h.id} habit={h} date={date} onEdit={() => setEditing(h)} />
            ))}
          </View>
        ))}

        {others.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Pressable
              onPress={() => setShowOthers((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showOthers }}
              style={s.othersToggle}>
              <Icon name={showOthers ? 'keyboard_arrow_down' : 'keyboard_arrow_right'} size={20} color={c.textSecondary} />
              <Text style={[typo.section, { color: c.textSecondary }]}>
                Not due {offset === 0 ? 'today' : 'this day'} ({others.length})
              </Text>
            </Pressable>
            {showOthers && others.map((h) => <HabitRow key={h.id} habit={h} date={date} onEdit={() => setEditing(h)} />)}
          </View>
        )}
      </ScrollView>

      <EntryEditor habit={editing} date={date} onClose={() => setEditing(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.xxl, gap: space.md },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 3, borderRadius: radius.md, borderCurve: 'continuous', minWidth: 38 },
  dayLetter: { fontSize: 12, fontWeight: '600' },
  dayNum: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  summaryNum: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  todayChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  othersToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: space.sm },
});
