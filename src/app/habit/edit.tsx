import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';

import { TimeField } from '@/components/time-field';
import { Body, Button, Card, Chip, Input, Label, NumberInput, Segmented } from '@/components/ui';
import { EMOJI_SUGGESTIONS, HABIT_COLORS, isHexColor, useColors } from '@/constants/theme';
import { newId, useStore } from '@/data/store';
import { getWeekStartDay, weekdayShort } from '@/lib/dates';
import type { Habit, HabitGroup, HabitKind, Reminder, Schedule, Weekday } from '@/lib/types';
import { ensurePermission } from '@/notifications/scheduler';


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
  const { habits, saveHabit, today } = useStore();
  const existing = habits.find((h) => h.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '💪');
  const [color, setColor] = useState(existing?.color ?? HABIT_COLORS[7]);
  const [customColor, setCustomColor] = useState(existing && !HABIT_COLORS.includes(existing.color) ? existing.color : '');
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
      step: kind === 'count' || kind === 'duration' ? step || undefined : undefined,
      schedule: kind === 'avoid' ? { type: 'daily' } : schedule(),
      reminders,
      group,
      archived: existing?.archived ?? false,
      sortOrder: existing?.sortOrder ?? habits.length,
      startDate: existing?.startDate ?? today,
    };
    // Close straight away; the save finishes in the background.
    saveHabit(habit);
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input value={emoji} onChangeText={setEmoji} style={{ width: 56, textAlign: 'center', fontSize: 22 }} maxLength={4} />
            <Input value={name} onChangeText={setName} placeholder="e.g. Workout" style={{ flex: 1 }} autoFocus={!existing} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 12 }} contentContainerStyle={{ gap: 6 }}>
            {EMOJI_SUGGESTIONS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} style={[s.emoji, { backgroundColor: emoji === e ? c.muted : 'transparent' }]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
          <Label>Color</Label>
          <View style={[s.preview, { backgroundColor: c.muted }]}>
            <View style={[s.previewIcon, { backgroundColor: color + '26' }]}>
              <Text style={{ fontSize: 22 }}>{emoji || '✅'}</Text>
            </View>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {name || 'Habit name'}
            </Text>
            <View style={[s.previewCheck, { backgroundColor: color, borderColor: color }]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>✓</Text>
            </View>
          </View>
          <View style={[s.row, { marginTop: 12 }]}>
            {HABIT_COLORS.map((col) => (
              <Pressable
                key={col}
                onPress={() => {
                  setColor(col);
                  setCustomColor('');
                }}
                hitSlop={4}
                style={[s.swatch, { backgroundColor: col, borderColor: color === col ? c.text : 'transparent' }]}>
                {color === col && <Text style={s.swatchTick}>✓</Text>}
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
            {customColor !== '' && !isHexColor(customColor) && <Body muted style={{ fontSize: 13 }}>Use #RRGGBB</Body>}
          </View>
        </Card>

        <Card>
          <Label>Time of day</Label>
          <Segmented options={GROUP_OPTIONS} value={group} onChange={setGroup} />
          <Body muted style={{ marginTop: 8, fontSize: 13 }}>Groups habits into sections on the Today screen.</Body>
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
    </FormScreen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  emoji: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  swatchTick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  previewIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  previewCheck: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
