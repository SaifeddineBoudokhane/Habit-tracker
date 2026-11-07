import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/constants/theme';
import { newId, useStore } from '@/data/store';
import type { Exercise, ExerciseKind } from '@/lib/types';

import { Body, Button, Input, Segmented } from './ui';

export const KIND_LABEL: Record<ExerciseKind, string> = {
  strength: 'Weight × reps',
  bodyweight: 'Bodyweight reps',
  cardio: 'Distance / time',
};

/** Full-screen list to pick an exercise, with search and "create new". */
export function ExercisePicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const { exercises, saveExercise } = useStore();
  const [query, setQuery] = useState('');
  const [newKind, setNewKind] = useState<ExerciseKind>('strength');
  const q = query.trim().toLowerCase();
  const list = exercises.filter((e) => !e.archived && e.name.toLowerCase().includes(q));
  const exact = exercises.some((e) => e.name.toLowerCase() === q);

  const create = async () => {
    const e: Exercise = { id: newId(), name: query.trim(), kind: newKind };
    await saveExercise(e);
    setQuery('');
    onPick(e);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={s.header}>
          <Input value={query} onChangeText={setQuery} placeholder="Search or create exercise" style={{ flex: 1 }} autoFocus />
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 8 }}>
            <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
        {q.length > 0 && !exact && (
          <View style={[s.create, { borderColor: c.border, backgroundColor: c.card }]}>
            <Body>Create “{query.trim()}”</Body>
            <Segmented
              options={(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              value={newKind}
              onChange={setNewKind}
            />
            <Button title="Create and add" onPress={create} />
          </View>
        )}
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setQuery('');
                onPick(item);
              }}
              style={[s.item, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 16 }}>{item.name}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{KIND_LABEL[item.kind]}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  create: { margin: 12, marginTop: 0, padding: 12, gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  item: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
