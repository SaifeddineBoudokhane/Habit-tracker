import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { WidgetPreview, getWidgetInfo, requestPinWidget, type WidgetInfo } from 'react-native-android-widget';

import { Body, Button, Card, Chip, Label } from '@/components/ui';
import { type as typo, useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { WIDGETS, refreshWidgets, renderFor } from '@/widget/handler';
import { buildWidgetData, type WidgetData } from '@/widget/model';

const LIST: { name: string; title: string; about: string; sizes: { label: string; w: number; h: number }[] }[] = [
  {
    name: WIDGETS.today,
    title: 'Habits today',
    about: 'Tap a habit to log it. Small, it’s a row of buttons; stretch it taller for a checklist.',
    sizes: [
      { label: 'Small', w: 320, h: 130 },
      { label: 'Tall', w: 320, h: 260 },
    ],
  },
  { name: WIDGETS.streaks, title: 'Streaks', about: 'Today’s progress and the streaks you’re protecting.', sizes: [{ label: '', w: 320, h: 150 }] },
  { name: WIDGETS.week, title: 'Week view', about: 'The last 7 days for each habit at a glance.', sizes: [{ label: '', w: 320, h: 190 }] },
  { name: WIDGETS.habit, title: 'Single habit', about: 'One habit, one tap. Place as many as you like.', sizes: [{ label: '', w: 150, h: 150 }] },
];

export default function WidgetsScreen() {
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const { habits, settings, updateSettings } = useStore();
  const [data, setData] = useState<WidgetData | null>(null);
  const [placed, setPlaced] = useState<WidgetInfo[]>([]);
  const active = habits.filter((h) => !h.archived);
  const [habitForWidget, setHabitForWidget] = useState<string>('');
  const chosenHabit = habitForWidget || active[0]?.id || '';

  const load = useCallback(() => {
    buildWidgetData().then(setData).catch(() => {});
    if (Platform.OS === 'android') getWidgetInfo(WIDGETS.habit).then(setPlaced).catch(() => setPlaced([]));
  }, []);
  useFocusEffect(load);

  const add = async (name: string) => {
    if (Platform.OS !== 'android') return;
    if (name === WIDGETS.habit) {
      if (!chosenHabit) return Alert.alert('No habits yet', 'Create a habit first.');
      await updateSettings({ pendingWidgetHabit: chosenHabit });
    }
    const ok = await requestPinWidget({ widgetName: name }).catch(() => false);
    if (!ok) {
      Alert.alert(
        'Add it from the home screen',
        'Your launcher doesn’t support adding widgets from apps. Long-press an empty spot on your home screen → Widgets → Habit Tracker.',
      );
    }
  };

  const preview = (name: string, w: number, h: number, previewData: WidgetData) => {
    const scale = Math.min(1, (width - 64) / w);
    const fakeId = -1;
    const d: WidgetData =
      name === WIDGETS.habit && chosenHabit
        ? { ...previewData, settings: { ...previewData.settings, widgetHabits: { [String(fakeId)]: chosenHabit } } }
        : previewData;
    const r = renderFor(name, fakeId, d, { width: w, height: h });
    return (
      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <WidgetPreview renderWidget={() => (dark ? r.dark : r.light)} width={w * scale} height={h * scale} />
      </View>
    );
  };

  if (Platform.OS !== 'android') {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: c.background }}>
        <Body muted>Home-screen widgets are available on Android.</Body>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Body muted>
        Add a widget with the button, or long-press an empty spot on your home screen → Widgets → Habit Tracker.
      </Body>
      {LIST.map((wd) => (
        <Card key={wd.name}>
          <Text style={[typo.headline, { color: c.text, marginBottom: 2 }]}>{wd.title}</Text>
          <Body muted style={{ fontSize: 13 }}>{wd.about}</Body>
          {wd.name === WIDGETS.habit && active.length > 0 && (
            <View style={[s.chips, { marginTop: 10 }]}>
              {active.map((h) => (
                <Chip key={h.id} label={h.name} selected={chosenHabit === h.id} onPress={() => setHabitForWidget(h.id)} />
              ))}
            </View>
          )}
          {data &&
            wd.sizes.map((sz) => (
              <View key={sz.label}>
                {sz.label !== '' && <Text style={[typo.caption, { color: c.textSecondary, marginTop: 8 }]}>{sz.label}</Text>}
                {preview(wd.name, sz.w, sz.h, data)}
              </View>
            ))}
          <Button title="Add to home screen" icon="add" onPress={() => add(wd.name)} />
        </Card>
      ))}

      {placed.length > 0 && (
        <Card>
          <Label>Your single-habit widgets</Label>
          {placed.map((w) => {
            const h = habits.find((x) => x.id === settings.widgetHabits?.[String(w.widgetId)]);
            return (
              <View key={w.widgetId} style={[s.row, { borderColor: c.border }]}>
                <Body style={{ flex: 1 }}>{h ? h.name : 'Not set yet'}</Body>
                <Button
                  title="Change"
                  kind="secondary"
                  onPress={() => router.push({ pathname: '/widget-setup', params: { widgetId: String(w.widgetId) } })}
                />
              </View>
            );
          })}
        </Card>
      )}
      <Button title="Refresh all widgets" icon="sync" kind="secondary" onPress={() => refreshWidgets().then(load)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
