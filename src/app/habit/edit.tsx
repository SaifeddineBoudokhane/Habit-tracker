import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TimeField } from '@/components/time-field';
import { Body, Button, Card, Chip, Input, Label, NumberInput, Segmented } from '@/components/ui';
import { EMOJI_SUGGESTIONS, HABIT_COLORS, useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { weekdayShort } from '@/lib/dates';
import type { Habit, HabitKind, Reminder, Schedule, Weekday } from '@/lib/types';
import { ensurePermission } from '@/notifications/scheduler';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export default function EditHabitScreen() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { habits, saveHabit, today } = useStore();
  const existing = habits.find((h) => h.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '💪');
  const [color, setColor] = useState(existing?.color ?? HABIT_COLORS[5]);
  const [kind, setKind] = useState<HabitKind>(existing?.kind ?? 'check');
  const [target, setTarget] = useState(existing?.target ?? 8);
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [schedType, setSchedType] = useState<ScheduleType>(existing?.schedule.type ?? 'daily');
  const [days, setDays] = useState<Weekday[]>(
    existing?.schedule.type === 'weekdays' ? existing.schedule.days : [1, 3, 5],
  );
  const [times, setTimes] = useState(existing?.schedule.type === 'perWeek' ? existing.schedule.times : 3);
  const [everyN, setEveryN] = useState(existing?.schedule.type === 'everyN' ? existing.schedule.n : 2);
  const [reminders, setReminders] = useState<Reminder[]>(existing?.reminders ?? []);

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
      emoji: emoji.trim() || '✅',
      color,
      kind,
      target: kind === 'count' || kind === 'duration' ? Math.max(1, target) : 1,
      unit: kind === 'count' ? unit.trim() : kind === 'duration' ? 'min' : '',
      schedule: kind === 'avoid' ? { type: 'daily' } : schedule(),
      reminders,
      archived: existing?.archived ?? false,
      sortOrder: existing?.sortOrder ?? habits.length,
      startDate: existing?.startDate ?? today,
    };
    await saveHabit(habit);
    if (reminders.length > 0) {
      const ok = await ensurePermission(true);
      if (!ok)
        Alert.alert(
          'Notifications are off',
          'Reminders won’t show until you allow notifications for this app in Android settings.',
        );
    }
    router.back();
  };

  const updateReminder = (rid: string, patch: Partial<Reminder>) =>
    setReminders((rs) => rs.map((r) => (r.id === rid ? ({ ...r, ...patch } as Reminder) : r)));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>Name</Label>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input value={emoji} onChangeText={setEmoji} style={{ width: 56, textAlign: 'center', fontSize: 22 }} maxLength={4} />
            <Input value={name} onChangeText={setName} placeholder="e.g. Workout" style={{ flex: 1 }} autoFocus={!existing} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 6 }}>
            {EMOJI_SUGGESTIONS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} style={[s.emoji, { backgroundColor: emoji === e ? c.muted : 'transparent' }]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[s.row, { marginTop: 12 }]}>
            {HABIT_COLORS.map((col) => (
              <Pressable
                key={col}
                onPress={() => setColor(col)}
                style={[s.swatch, { backgroundColor: col, borderColor: color === col ? c.text : 'transparent' }]}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Label>Type</Label>
          <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
          <Body muted style={{ marginTop: 10 }}>{KIND_HELP[kind]}</Body>
          {kind === 'count' && (
            <View style={[s.inline, { marginTop: 12 }]}>
              <Body>Daily goal</Body>
              <NumberInput value={target} onChange={setTarget} />
              <Input value={unit} onChangeText={setUnit} placeholder="unit (glasses)" style={{ flex: 1 }} />
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
                {WEEK_ORDER.map((d) => (
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
              <Pressable onPress={() => setReminders((rs) => rs.filter((x) => x.id !== r.id))} hitSlop={10} style={{ padding: 6 }}>
                <Text style={{ color: c.danger, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <View style={[s.row, { marginTop: 12 }]}>
            <Button
              title="+ At a time"
              kind="secondary"
              onPress={() => setReminders((rs) => [...rs, { id: newId(), kind: 'fixed', time: '08:00' }])}
            />
            <Button
              title="+ Repeating"
              kind="secondary"
              onPress={() =>
                setReminders((rs) => [...rs, { id: newId(), kind: 'interval', everyMin: 60, start: '09:00', end: '21:00' }])
              }
            />
          </View>
          <Body muted style={{ marginTop: 10, fontSize: 13 }}>
            Reminders stop for the day once the habit is done, and respect quiet hours (Settings).
          </Body>
        </Card>

        <Button title={existing ? 'Save changes' : 'Create habit'} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  emoji: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
