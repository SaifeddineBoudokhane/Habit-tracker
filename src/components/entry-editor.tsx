import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { durationStep } from '@/data/actions';
import { useStore } from '@/data/store';
import { useHabitTimer, useTicker } from '@/data/timers';
import { formatDuration } from '@/lib/workouts';
import { prettyDate } from '@/lib/dates';
import { skipsInMonth } from '@/lib/schedule';
import type { Entry, Habit } from '@/lib/types';

import { Body, Button, Input, NumberInput } from './ui';

/** Bottom sheet to set the exact value for a habit on a day, or mark it skipped. */
export function EntryEditor({ habit, date, onClose }: { habit: Habit | null; date: string; onClose: () => void }) {
  if (!habit) return null;
  return <Sheet key={`${habit.id}|${date}`} habit={habit} date={date} onClose={onClose} />;
}

function Sheet({ habit, date, onClose }: { habit: Habit; date: string; onClose: () => void }) {
  const c = useColors();
  const { entryFor, setEntry, index, settings, today } = useStore();
  const [draft, setDraft] = useState<Entry>(() => entryFor(habit.id, date));
  const [inputKey, setInputKey] = useState(0);
  const timer = useHabitTimer(habit.id);
  const now = useTicker(timer.startedAt !== null);

  const original = entryFor(habit.id, date);
  const usedSkips = skipsInMonth(habit.id, index, date) - (original.skipped ? 1 : 0);
  const canSkip = usedSkips < settings.skipsPerMonth;
  const numeric = habit.kind === 'count' || habit.kind === 'duration';
  const step = habit.kind === 'duration' ? durationStep(habit) : 1;
  const unit = habit.kind === 'duration' ? 'min' : habit.unit;

  const setValue = (v: number) => {
    setDraft({ ...draft, value: Math.max(0, v), skipped: false });
    setInputKey((k) => k + 1);
  };
  const save = async (e: Entry) => {
    await setEntry(e);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={sheet.backdrop} onPress={onClose} />
      <ScrollView style={[sheet.panel, { backgroundColor: c.card }]} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 36 }}>
        <Text style={[sheet.title, { color: c.text }]}>
          {habit.emoji} {habit.name}
        </Text>
        <Body muted>{prettyDate(date, today)}</Body>

        {numeric && (
          <View style={sheet.stepper}>
            <Button title={`−${step}`} kind="secondary" onPress={() => setValue(draft.value - step)} />
            <NumberInput key={inputKey} value={draft.value} min={0} onChange={(n) => setDraft({ ...draft, value: n, skipped: false })} />
            <Button title={`+${step}`} kind="secondary" onPress={() => setValue(draft.value + step)} />
          </View>
        )}
        {habit.kind === 'duration' && (
          <View style={{ marginBottom: 12 }}>
            {timer.startedAt === null ? (
              <Button title="▶ Start timer" kind="secondary" onPress={() => timer.start().then(onClose)} />
            ) : (
              <Button
                title={`■ Stop timer · ${formatDuration((now - timer.startedAt) / 1000)}`}
                onPress={() => timer.stop().then(onClose)}
              />
            )}
          </View>
        )}
        {numeric && (
          <Body muted style={{ textAlign: 'center', marginBottom: 12 }}>
            Goal: {habit.target} {unit}
          </Body>
        )}

        <Input
          value={draft.note ?? ''}
          onChangeText={(note) => setDraft({ ...draft, note })}
          placeholder="Note (optional), e.g. felt weak, slept 5h"
          multiline
          style={{ marginTop: numeric ? 0 : 16, minHeight: 44 }}
        />

        <View style={{ gap: 10, marginTop: 12 }}>
          {!numeric && (draft.note ?? '') !== (original.note ?? '') && (
            <Button title="Save note" kind="secondary" onPress={() => save({ ...original, note: draft.note })} />
          )}
          {habit.kind === 'check' && (
            <Button
              title={original.value >= 1 && !original.skipped ? 'Mark as not done' : 'Mark as done'}
              onPress={() => save({ ...draft, skipped: false, value: original.value >= 1 ? 0 : 1 })}
            />
          )}
          {habit.kind === 'avoid' && (
            <Button
              title={original.value >= 1 ? 'Undo slip' : 'I slipped'}
              kind={original.value >= 1 ? 'secondary' : 'danger'}
              onPress={() => save({ ...draft, skipped: false, value: original.value >= 1 ? 0 : 1 })}
            />
          )}
          {numeric && <Button title="Save" onPress={() => save(draft)} />}
          {numeric && draft.value < habit.target && (
            <Button title="Set to goal" kind="secondary" onPress={() => save({ ...draft, value: habit.target, skipped: false })} />
          )}
          {habit.kind !== 'avoid' &&
            (original.skipped ? (
              <Button title="Un-skip this day" kind="secondary" onPress={() => save({ ...draft, skipped: false })} />
            ) : (
              <Button
                title={`Skip day (rest/sick) · ${usedSkips}/${settings.skipsPerMonth} this month`}
                kind="secondary"
                disabled={!canSkip}
                onPress={() => save({ ...draft, value: 0, skipped: true })}
              />
            ))}
          <Button title="Cancel" kind="secondary" onPress={onClose} />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { padding: 20, flexGrow: 0, maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 16 },
});
