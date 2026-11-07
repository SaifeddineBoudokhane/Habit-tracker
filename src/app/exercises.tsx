import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { ExercisePicker, KIND_LABEL } from '@/components/exercise-picker';
import { Button } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { isFilled } from '@/lib/workouts';

export default function ExercisesScreen() {
  const c = useColors();
  const { exercises, sets } = useStore();
  const [adding, setAdding] = useState(false);
  const count = new Map<string, number>();
  for (const s of sets) if (isFilled(s)) count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
  // Most-used first, then alphabetical.
  const list = exercises
    .filter((e) => !e.archived)
    .sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.name.localeCompare(b.name));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={<Button title="+ New exercise" kind="secondary" style={{ margin: 16 }} onPress={() => setAdding(true)} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })}
            style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: c.border, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: c.text, fontSize: 16 }}>{item.name}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{KIND_LABEL[item.kind]}</Text>
            </View>
            <Text style={{ color: c.textSecondary }}>{count.get(item.id) ? `${count.get(item.id)} sets` : ''}</Text>
          </Pressable>
        )}
      />
      <ExercisePicker
        visible={adding}
        onClose={() => setAdding(false)}
        onPick={(e) => {
          setAdding(false);
          router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
        }}
      />
    </View>
  );
}
