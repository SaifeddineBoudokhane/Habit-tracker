import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, type as typo, useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { addDays, fromKey, monthKey, prettyDate, toKey, weekStart, weekday, weekdayShort } from '@/lib/dates';
import { dayProgress } from '@/lib/schedule';

import { ProgressRing } from './progress-ring';
import { Button, IconButton, Segmented } from './ui';

type Mode = 'week' | 'month';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Bottom sheet to jump to any past day: a week view (one row per day, with how much got done)
 * or a month grid. Each day shows its progress ring, so you can spot gaps at a glance.
 */
export function DayCalendar({ visible, selected, onPick, onClose }: { visible: boolean; selected: string; onPick: (date: string) => void; onClose: () => void }) {
  if (!visible) return null;
  return <Sheet key={selected} selected={selected} onPick={onPick} onClose={onClose} />;
}

function Sheet({ selected, onPick, onClose }: { selected: string; onPick: (date: string) => void; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { today } = useStore();
  const [mode, setMode] = useState<Mode>('week');
  // Any day inside the period being shown.
  const [anchor, setAnchor] = useState(selected);

  const week0 = weekStart(anchor);
  const month0 = `${monthKey(anchor)}-01`;
  const canGoNext = mode === 'week' ? addDays(week0, 7) <= today : nextMonth(month0) <= today;

  const shift = (dir: 1 | -1) => {
    if (mode === 'week') setAnchor(addDays(week0, 7 * dir));
    else setAnchor(dir === 1 ? nextMonth(month0) : prevMonth(month0));
  };

  const title =
    mode === 'week'
      ? weekTitle(week0)
      : `${MONTHS[fromKey(month0).getMonth()]} ${fromKey(month0).getFullYear()}`;

  const pick = (d: string) => {
    onPick(d);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close calendar" />
      <View style={[s.panel, { backgroundColor: c.card, paddingBottom: space.xl + insets.bottom }]}>
        <Segmented
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <View style={s.nav}>
          <IconButton icon="chevron_left" label={mode === 'week' ? 'Previous week' : 'Previous month'} onPress={() => shift(-1)} color={c.text} />
          <Text style={[typo.headline, { color: c.text }]}>{title}</Text>
          <IconButton
            icon="chevron_right"
            label={mode === 'week' ? 'Next week' : 'Next month'}
            onPress={() => shift(1)}
            disabled={!canGoNext}
            color={c.text}
          />
        </View>

        {mode === 'week' ? (
          <WeekList start={week0} selected={selected} today={today} onPick={pick} />
        ) : (
          <MonthGrid first={month0} selected={selected} today={today} onPick={pick} />
        )}

        <View style={[s.footer, { marginTop: space.md }]}>
          {selected !== today && <Button title="Go to today" icon="today" onPress={() => pick(today)} />}
          <Button title="Close" kind="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function WeekList({ start, selected, today, onPick }: { start: string; selected: string; today: string; onPick: (d: string) => void }) {
  const c = useColors();
  const { habits, index } = useStore();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={{ gap: 6 }}>
      {days.map((d) => {
        const future = d > today;
        const p = dayProgress(habits, index, d);
        const isSel = d === selected;
        const full = p.total > 0 && p.done === p.total;
        const label = future ? '' : p.total === 0 ? 'Nothing due' : full ? 'All done' : `${p.done} of ${p.total} done`;
        return (
          <Pressable
            key={d}
            disabled={future}
            onPress={() => onPick(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel, disabled: future }}
            accessibilityLabel={`${prettyDate(d, today)}${label ? `, ${label}` : ''}`}
            style={({ pressed }) => [
              s.weekRow,
              { backgroundColor: isSel ? c.accent : pressed ? c.muted : 'transparent', opacity: future ? 0.35 : 1 },
            ]}>
            <ProgressRing
              progress={p.total ? p.done / p.total : 0}
              color={isSel ? c.accentText : full ? c.success : c.accent}
              track={isSel ? 'rgba(255,255,255,0.28)' : c.muted}
              size={36}
              stroke={3.5}>
              <Text style={[s.num, { color: isSel ? c.accentText : c.text }]}>{Number(d.slice(8))}</Text>
            </ProgressRing>
            <Text style={[typo.rowTitle, { flex: 1, color: isSel ? c.accentText : d === today ? c.accent : c.text }]}>
              {d === today ? 'Today' : weekdayShort(weekday(d))}
            </Text>
            <Text style={[typo.subhead, { color: isSel ? c.accentText : full ? c.success : c.textSecondary }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthGrid({ first, selected, today, onPick }: { first: string; selected: string; today: string; onPick: (d: string) => void }) {
  const c = useColors();
  const { habits, index } = useStore();
  const gridStart = weekStart(first);
  const month = monthKey(first);
  // Enough whole weeks to cover the month (4 to 6).
  const weeks: string[][] = [];
  for (let w = gridStart; monthKey(w) <= month || w < first; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
    if (weeks.length >= 6) break;
  }
  return (
    <View style={{ gap: 4 }}>
      <View style={s.gridRow}>
        {weeks[0].map((d) => (
          <Text key={d} style={[s.head, { color: c.textSecondary }]}>
            {weekdayShort(weekday(d)).slice(0, 1)}
          </Text>
        ))}
      </View>
      {weeks.map((row) => (
        <View key={row[0]} style={s.gridRow}>
          {row.map((d) => {
            if (monthKey(d) !== month) return <View key={d} style={s.cell} />;
            const future = d > today;
            const p = dayProgress(habits, index, d);
            const isSel = d === selected;
            const full = p.total > 0 && p.done === p.total;
            return (
              <Pressable
                key={d}
                disabled={future}
                onPress={() => onPick(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: future }}
                accessibilityLabel={`${prettyDate(d, today)}${future ? '' : `, ${p.done} of ${p.total} done`}`}
                style={[s.cell, { opacity: future ? 0.35 : 1 }]}>
                <View style={[s.cellInner, isSel && { backgroundColor: c.accent }]}>
                  <ProgressRing
                    progress={future || !p.total ? 0 : p.done / p.total}
                    color={isSel ? c.accentText : full ? c.success : c.accent}
                    track={isSel ? 'rgba(255,255,255,0.28)' : c.muted}
                    size={34}
                    stroke={3}>
                    <Text style={[s.num, { color: isSel ? c.accentText : d === today ? c.accent : c.text }]}>{Number(d.slice(8))}</Text>
                  </ProgressRing>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function nextMonth(first: string): string {
  const d = fromKey(first);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

function prevMonth(first: string): string {
  const d = fromKey(first);
  return toKey(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

function weekTitle(start: string): string {
  const a = fromKey(start);
  const b = fromKey(addDays(start, 6));
  const short = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return `${short(a)} – ${short(b)}`;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderCurve: 'continuous',
    gap: space.sm,
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  gridRow: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  cellInner: { padding: 3, borderRadius: radius.md, borderCurve: 'continuous' },
  num: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  footer: { gap: space.sm },
});
