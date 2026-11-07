import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#111214',
    textSecondary: '#62666d',
    background: '#f4f5f7',
    card: '#ffffff',
    border: '#e3e5e8',
    accent: '#2563eb',
    accentText: '#ffffff',
    danger: '#dc2626',
    success: '#16a34a',
    muted: '#eceef1',
  },
  dark: {
    text: '#f2f3f5',
    textSecondary: '#a0a4ab',
    background: '#0d0e10',
    card: '#1a1b1f',
    border: '#2a2c31',
    accent: '#4f8bff',
    accentText: '#ffffff',
    danger: '#f87171',
    success: '#4ade80',
    muted: '#26282d',
  },
};

export type Palette = typeof Colors.light;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}

/** Habit colors to pick from. */
export const HABIT_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
];

export const EMOJI_SUGGESTIONS = ['💪', '🏃', '💧', '📖', '🧘', '🥗', '😴', '🦷', '💊', '🚭', '🍬', '📵', '✍️', '🎸', '🧹', '🚶'];
