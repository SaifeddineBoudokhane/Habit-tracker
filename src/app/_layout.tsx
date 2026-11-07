// Must be first: defines background tasks before Android runs them headlessly.
import '@/notifications/tasks';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

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
    <ThemeProvider value={theme}>
      <StoreProvider>
        <HideSplashWhenReady />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="habit/edit" options={{ presentation: 'modal', title: 'Habit' }} />
          <Stack.Screen name="habit/[id]" options={{ title: '' }} />
        </Stack>
      </StoreProvider>
    </ThemeProvider>
  );
}
