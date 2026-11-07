import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { Colors } from '@/constants/theme';
import { loadAll, patchSettings } from '@/data/db';
import type { Habit } from '@/lib/types';

import { buildHabitModel, renderHabit } from './handler';

/** Shown by Android when you place a "Single habit" widget: pick which habit it shows. */
export function HabitWidgetConfiguration({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const c = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [habits, setHabits] = useState<Habit[] | null>(null);

  useEffect(() => {
    loadAll().then((d) => setHabits(d.habits.filter((h) => !h.archived)));
  }, []);

  const pick = async (h: Habit) => {
    const { settings } = await loadAll();
    await patchSettings({ widgetHabits: { ...settings.widgetHabits, [String(widgetInfo.widgetId)]: h.id } });
    renderWidget(renderHabit(await buildHabitModel(h.id)));
    setResult('ok');
  };

  return (
    <View style={[s.wrap, { backgroundColor: c.background }]}>
      <Text style={[s.title, { color: c.text }]}>Which habit should this widget show?</Text>
      {habits?.length === 0 && (
        <Text style={{ color: c.textSecondary, padding: 16 }}>Create a habit in the app first, then add the widget.</Text>
      )}
      <FlatList
        data={habits ?? []}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => pick(item)} style={[s.item, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{item.name}</Text>
          </Pressable>
        )}
        contentContainerStyle={{ gap: 8, padding: 16 }}
      />
      <Pressable onPress={() => setResult('cancel')} style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: c.accent, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
