import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { FormScreen } from '@/components/form-screen';
import { Icon } from '@/components/icon';
import { TimeField } from '@/components/time-field';
import { Body, Button, Card, Chip, HabitIconTile, IconButton, Input, Label, NumberInput, Segmented } from '@/components/ui';
import { HABIT_ICONS } from '@/constants/icons';
import { HABIT_COLORS, isHexColor, radius, tint, useColors } from '@/constants/theme';
import { DEFAULT_HABIT_ICON, HABIT_ICON_NAMES, guessIcon, habitIcon, type HabitIconName } from '@/lib/habit-icon';
import { newId, useStore } from '@/data/store';
import { addDays, diffDays, getWeekStartDay, weekdayShort } from '@/lib/dates';
import { backfillDays } from '@/lib/schedule';
import type { Habit, HabitGroup, HabitKind, Reminder, Schedule, Weekday } from '@/lib/types';
import { ensurePermission } from '@/notifications/scheduler';

/** Indexes into HABIT_COLORS: blue, emerald, orange, purple, rose, cyan, amber, indigo, teal, pink. */
const DEFAULT_COLOR_ORDER = [7, 11, 16, 4, 1, 9, 15, 6, 10, 2];
/** Icons shown before "show all": two rows, the last cell is the toggle. */
const ICONS_COLLAPSED = 11;

const KIND_OPTIONS: { value: HabitKind; label: string }[] = [
  { value: 'check', label: 'Yes / No' },
  { value: 'count', label: 'Count' },
  { value: 'duration', label: 'Duration' },
  { value: 'avoid', label: 'Avoid' },
];

const KIND_HELP: Record<HabitKind, string> = {
  check: 'Done or not done, e.g. Workout, Meditate.',
  count: 'Reach a number each day, e.g. 8 glasses of water, 100 push-ups.',
  duration: 'Reach a number of minutes, e.g. Read 20 min.',
  avoid: 'Something to stop doing. Log when you slip; the streak is days clean.',
};

type ScheduleType = Schedule['type'];
const SCHEDULE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Specific days' },
  { value: 'perWeek', label: 'X per week' },
  { value: 'everyN', label: 'Every N days' },
];

const GROUP_OPTIONS: { value: HabitGroup; label: string }[] = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export default function EditHabitScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { habits, saveHabit, addEntries, index, today } = useStore();
  const existing = habits.find((h) => h.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<HabitIconName>(existing ? habitIcon(existing) : DEFAULT_HABIT_ICON);
  // Until you pick an icon yourself, it follows the name (Water -> drop).
  const [iconPicked, setIconPicked] = useState(!!existing);
  // New habits get the next color in a spread-out order (until you pick one), so Today isn't all one color.
  const [pickedColor, setColor] = useState<string | null>(existing?.color ?? null);
  const color = pickedColor ?? HABIT_COLORS[DEFAULT_COLOR_ORDER[habits.length % DEFAULT_COLOR_ORDER.length]];
  const [allIcons, setAllIcons] = useState(false);
  const [customColor, setCustomColor] = useState(
    existing && !HABIT_COLORS.includes(existing.color) ? existing.color : '',
  );
  const [kind, setKind] = useState<HabitKind>(existing?.kind ?? 'check');
  const [target, setTarget] = useState(existing?.target ?? 8);
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [step, setStep] = useState(existing?.step ?? 0);
  const [schedType, setSchedType] = useState<ScheduleType>(existing?.schedule.type ?? 'daily');
  const [days, setDays] = useState<Weekday[]>(
    existing?.schedule.type === 'weekdays' ? existing.schedule.days : [1, 3, 5],
  );
  const [times, setTimes] = useState(existing?.schedule.type === 'perWeek' ? existing.schedule.times : 3);
  const [everyN, setEveryN] = useState(existing?.schedule.type === 'everyN' ? existing.schedule.n : 2);
  const [group, setGroup] = useState<HabitGroup>(existing?.group ?? 'anytime');
  const [reminders, setReminders] = useState<Reminder[]>(existing?.reminders ?? []);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  // Days between the chosen start and the day you began tracking in the app.
  const [backfill, setBackfill] = useState<'done' | 'empty'>('done');
  const trackedFrom = existing ? (existing.startDate < today ? existing.startDate : today) : today;
  const earlierStart = startDate < trackedFrom;

  useLayoutEffect(() => {
    nav.setOptions({ title: existing ? 'Edit habit' : 'New habit' });
  }, [nav, existing]);

  const schedule = (): Schedule => {
    switch (schedType) {
      case 'weekdays':
        return { type: 'weekdays', days };
      case 'perWeek':
        return { type: 'perWeek', times: Math.min(7, times) };
      case 'everyN':
        return { type: 'everyN', n: everyN };
      default:
        return { type: 'daily' };
    }
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Give the habit a name.');
    if (schedType === 'weekdays' && days.length === 0 && kind !== 'avoid')
      return Alert.alert('Pick days', 'Choose at least one day of the week.');
    const habit: Habit = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      icon,
      emoji: existing?.emoji ?? '',
      color,
      kind,
      target: kind === 'count' || kind === 'duration' ? Math.max(1, target) : 1,
      unit: kind === 'count' ? unit.trim() : kind === 'duration' ? 'min' : '',
      step: kind === 'count' || kind === 'duration' ? step || undefined : undefined,
      schedule: kind === 'avoid' ? { type: 'daily' } : schedule(),
      reminders,
      group,
      archived: existing?.archived ?? false,
      sortOrder: existing?.sortOrder ?? habits.length,
      startDate: startDate > today ? today : startDate,
    };
    // Close straight away; the save finishes in the background.
    saveHabit(habit);
    if (earlierStart && backfill === 'done') {
      const value = habit.kind === 'check' ? 1 : habit.target;
      addEntries(
        backfillDays(habit, index, habit.startDate, addDays(trackedFrom, -1)).map((date) => ({
          habitId: habit.id,
          date,
          value,
          skipped: false,
        })),
      );
    }
    router.back();
    if (reminders.length > 0) {
      const ok = await ensurePermission(true);
      if (!ok)
        Alert.alert(
          'Notifications are off',
          'Reminders won’t show until you allow notifications for this app in Android settings.',
        );
    }
  };

  const updateReminder = (rid: string, patch: Partial<Reminder>) =>
    setReminders((rs) => rs.map((r) => (r.id === rid ? ({ ...r, ...patch } as Reminder) : r)));

  return (
    <FormScreen footer={<Button title={existing ? 'Save changes' : 'Create habit'} onPress={save} />}>
      <Card>
        <Label>Name</Label>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <HabitIconTile icon={icon} color={color} size={48} />
          <Input
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (!iconPicked) setIcon(guessIcon(t) ?? DEFAULT_HABIT_ICON);
            }}
            placeholder="e.g. Workout"
            style={{ flex: 1 }}
            autoFocus={!existing}
          />
        </View>
      </Card>

      <Card>
        <Label>Icon</Label>
        <View style={s.iconGrid}>
          {(allIcons
            ? HABIT_ICON_NAMES
            : [...new Set([icon, ...HABIT_ICON_NAMES.filter((n) => n !== DEFAULT_HABIT_ICON)])].slice(0, ICONS_COLLAPSED)
          ).map((name) => {
            const selected = icon === name;
            return (
              <Pressable
                key={name}
                onPress={() => {
                  setIcon(name);
                  setIconPicked(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={HABIT_ICONS[name].label}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  s.iconCell,
                  { backgroundColor: selected ? tint(color, 0.18) : pressed ? c.muted : 'transparent' },
                  selected && { borderColor: color },
                ]}>
                <Icon habit={name} size={24} color={selected ? color : c.textSecondary} />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setAllIcons((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={allIcons ? 'Show fewer icons' : 'Show all icons'}
            style={({ pressed }) => [s.iconCell, { backgroundColor: pressed ? c.border : c.muted }]}>
            <Icon name={allIcons ? 'close' : 'keyboard_arrow_down'} size={24} color={c.text} />
          </Pressable>
        </View>
      </Card>

      <Card>
        <Label>Type</Label>
        <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <Body muted style={{ marginTop: 10 }}>
          {KIND_HELP[kind]}
        </Body>
        {kind === 'count' && (
          <View style={[s.inline, { marginTop: 12 }]}>
            <Body>Daily goal</Body>
            <NumberInput value={target} onChange={setTarget} />
            <Input value={unit} onChangeText={setUnit} placeholder="unit (glasses)" style={{ flex: 1 }} />
          </View>
        )}
        {(kind === 'count' || kind === 'duration') && (
          <View style={[s.inline, { marginTop: 12 }]}>
            <Body>Each tap adds</Body>
            <NumberInput
              key={kind}
              value={step || (kind === 'duration' ? (target >= 30 ? 10 : 5) : 1)}
              onChange={setStep}
            />
            <Body muted>{kind === 'duration' ? 'minutes' : unit || 'per tap'}</Body>
          </View>
        )}
        {kind === 'duration' && (
          <View style={[s.inline, { marginTop: 12 }]}>
            <Body>Daily goal</Body>
            <NumberInput value={target} onChange={setTarget} />
            <Body>minutes</Body>
          </View>
        )}
      </Card>

      {kind !== 'avoid' && (
        <Card>
          <Label>Schedule</Label>
          <Segmented options={SCHEDULE_OPTIONS} value={schedType} onChange={setSchedType} />
          {schedType === 'weekdays' && (
            <View style={[s.row, { marginTop: 12 }]}>
              {Array.from({ length: 7 }, (_, i) => ((getWeekStartDay() + i) % 7) as Weekday).map((d) => (
                <Chip
                  key={d}
                  label={weekdayShort(d)}
                  selected={days.includes(d)}
                  onPress={() => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}
                />
              ))}
            </View>
          )}
          {schedType === 'perWeek' && (
            <View style={[s.inline, { marginTop: 12 }]}>
              <NumberInput value={times} onChange={(n) => setTimes(Math.min(7, n))} />
              <Body>times per week, any days</Body>
            </View>
          )}
          {schedType === 'everyN' && (
            <View style={[s.inline, { marginTop: 12 }]}>
              <Body>Every</Body>
              <NumberInput value={everyN} onChange={setEveryN} />
              <Body>days</Body>
            </View>
          )}
        </Card>
      )}

      <Card>
        <Label>Started on</Label>
        <DateField value={startDate} onChange={setStartDate} max={today} />
        <Body muted style={{ marginTop: 8, fontSize: 13 }}>
          {startDate === today
            ? 'Counting starts today. Pick an earlier date if you were already doing this before using the app.'
            : `Counting from ${diffDays(startDate, today)} day${diffDays(startDate, today) === 1 ? '' : 's'} ago.`}
        </Body>
        {earlierStart && kind === 'avoid' && (
          <Body muted style={{ marginTop: 8, fontSize: 13 }}>
            Every day since then counts as clean. Log any slips from the habit’s calendar.
          </Body>
        )}
        {earlierStart && kind !== 'avoid' && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Body>Days before {existing ? 'the old start date' : 'today'}</Body>
            <Segmented
              options={[
                { value: 'done', label: 'Mark as done' },
                { value: 'empty', label: 'Leave empty' },
              ]}
              value={backfill}
              onChange={setBackfill}
            />
            <Body muted style={{ fontSize: 13 }}>
              {backfill === 'done'
                ? 'Your streak starts from that date. Days you already logged are kept; fix any misses from the habit’s calendar.'
                : 'You can fill them in yourself from the habit’s calendar. Empty days count as missed.'}
            </Body>
          </View>
        )}
      </Card>

      <Card>
        <Label>Color</Label>
        <View style={s.row}>
          {HABIT_COLORS.map((col) => (
            <Pressable
              key={col}
              onPress={() => {
                setColor(col);
                setCustomColor('');
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Color ${col}`}
              accessibilityState={{ selected: color === col }}
              style={[
                s.swatch,
                {
                  backgroundColor: col,
                  borderColor: color === col ? c.text : 'transparent',
                },
              ]}>
              {color === col && <Icon name="check" size={18} color="#fff" />}
            </Pressable>
          ))}
        </View>
        <View style={[s.inline, { marginTop: 12 }]}>
          <Body>Custom</Body>
          <Input
            value={customColor}
            onChangeText={(t) => {
              const v = (t.startsWith('#') ? t : `#${t}`).slice(0, 7);
              setCustomColor(t ? v : '');
              if (isHexColor(v)) setColor(v.toLowerCase());
            }}
            placeholder="#ff8800"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            style={{ width: 120 }}
          />
          {customColor !== '' && !isHexColor(customColor) && (
            <Body muted style={{ fontSize: 13 }}>
              Use #RRGGBB
            </Body>
          )}
        </View>
      </Card>

      <Card>
        <Label>Time of day</Label>
        <Segmented options={GROUP_OPTIONS} value={group} onChange={setGroup} />
        <Body muted style={{ marginTop: 8, fontSize: 13 }}>
          Groups habits into sections on the Today screen.
        </Body>
      </Card>

      <Card>
        <Label>Reminders</Label>
        {reminders.length === 0 && <Body muted>No reminders.</Body>}
        {reminders.map((r) => (
          <View key={r.id} style={[s.reminder, { borderColor: c.border }]}>
            {r.kind === 'fixed' ? (
              <View style={s.inline}>
                <Body>At</Body>
                <TimeField value={r.time} onChange={(time) => updateReminder(r.id, { time })} />
              </View>
            ) : (
              <View style={{ gap: 8, flex: 1 }}>
                <View style={s.inline}>
                  <Body>Every</Body>
                  <NumberInput value={r.everyMin} min={5} onChange={(everyMin) => updateReminder(r.id, { everyMin })} />
                  <Body>min</Body>
                </View>
                <View style={s.inline}>
                  <Body>from</Body>
                  <TimeField value={r.start} onChange={(start) => updateReminder(r.id, { start })} />
                  <Body>to</Body>
                  <TimeField value={r.end} onChange={(end) => updateReminder(r.id, { end })} />
                </View>
              </View>
            )}
            <IconButton
              icon="delete"
              label="Remove reminder"
              color={c.danger}
              onPress={() => setReminders((rs) => rs.filter((x) => x.id !== r.id))}
            />
          </View>
        ))}
        <View style={[s.row, { marginTop: 12 }]}>
          <Button
            title="At a time"
            icon="schedule"
            kind="secondary"
            onPress={() => setReminders((rs) => [...rs, { id: newId(), kind: 'fixed', time: '08:00' }])}
          />
          <Button
            title="Repeating"
            icon="event_repeat"
            kind="secondary"
            onPress={() =>
              setReminders((rs) => [
                ...rs,
                {
                  id: newId(),
                  kind: 'interval',
                  everyMin: 60,
                  start: '09:00',
                  end: '21:00',
                },
              ])
            }
          />
        </View>
        <Body muted style={{ marginTop: 10, fontSize: 13 }}>
          Reminders stop for the day once the habit is done, and respect quiet hours (Settings).
        </Body>
      </Card>
    </FormScreen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconCell: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
