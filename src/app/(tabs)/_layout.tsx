import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';

function icon(glyph: string) {
  // eslint-disable-next-line react/display-name
  return ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('✅') }} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: icon('🏋️') }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
