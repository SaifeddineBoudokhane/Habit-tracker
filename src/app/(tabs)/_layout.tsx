import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { Icon, type UiIconName } from '@/components/icon';
import { useColors } from '@/constants/theme';

function icon(name: UiIconName, active: UiIconName = name) {
  // eslint-disable-next-line react/display-name
  return ({ focused, color }: { focused: boolean; color: ColorValue | null }) => (
    <Icon name={focused ? active : name} size={24} color={color ?? 'gray'} />
  );
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.background },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarLabel: 'Today', tabBarIcon: icon('today', 'today-fill') }} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: icon('habits') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: icon('workouts') }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: icon('stats') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-fill') }} />
    </Tabs>
  );
}
