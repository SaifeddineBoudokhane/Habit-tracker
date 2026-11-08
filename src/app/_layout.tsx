import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AppLock } from '@/components/app-lock';
import { Colors } from '@/constants/theme';
import { StoreProvider, useStore } from '@/data/store';

SplashScreen.preventAutoHideAsync();

function HideSplashWhenReady() {
  const { ready } = useStore();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.text, border: c.border },
  };
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
    <ThemeProvider value={theme}>
      <StoreProvider>
        <HideSplashWhenReady />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="habit/edit" options={{ presentation: 'modal', title: 'Habit' }} />
          <Stack.Screen name="habit/[id]" options={{ title: '' }} />
          <Stack.Screen name="goal/edit" options={{ presentation: 'modal', title: 'Goal' }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="exercises" options={{ title: 'Exercises' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
          <Stack.Screen name="template/[id]" options={{ title: 'Template' }} />
          <Stack.Screen name="widgets" options={{ title: 'Home-screen widgets' }} />
          <Stack.Screen name="widget-setup" options={{ title: 'Choose habit' }} />
        </Stack>
        <AppLock />
      </StoreProvider>
    </ThemeProvider>
    </KeyboardProvider>
  );
}
