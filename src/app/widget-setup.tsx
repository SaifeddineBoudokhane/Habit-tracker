import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Body, Button, HabitIconTile } from '@/components/ui';
import { radius, useColors } from '@/constants/theme';
import { habitIcon } from '@/lib/habit-icon';
import { useStore } from '@/data/store';
import { refreshWidgets } from '@/widget/handler';

/** Opened from a "Single habit" widget (habittracker://widget-setup?widgetId=…) to choose its habit. */
export default function WidgetSetupScreen() {
  const c = useColors();
  const { widgetId } = useLocalSearchParams<{ widgetId?: string }>();
  const { habits, settings, updateSettings } = useStore();
  const active = habits.filter((h) => !h.archived);
  const current = widgetId ? settings.widgetHabits?.[widgetId] : undefined;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pick = async (habitId: string) => {
    if (!widgetId) return leave();
    await updateSettings({ widgetHabits: { ...settings.widgetHabits, [widgetId]: habitId } });
    await refreshWidgets();
    leave();
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={[s.title, { color: c.text }]}>Which habit should this widget show?</Text>
      {active.length === 0 && (
        <View style={{ gap: 12 }}>
          <Body muted>You don’t have any habits yet. Create one first.</Body>
          <Button title="Create a habit" icon="add" onPress={() => router.replace('/habit/edit')} />
        </View>
      )}
      {active.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => pick(h.id)}
          style={({ pressed }) => [
            s.item,
            { backgroundColor: pressed ? c.muted : c.card, borderColor: current === h.id ? h.color : 'transparent' },
          ]}>
          <HabitIconTile icon={habitIcon(h)} color={h.color} />
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{h.name}</Text>
          {current === h.id && <Icon name="today-fill" size={22} color={h.color} />}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 2 },
});
