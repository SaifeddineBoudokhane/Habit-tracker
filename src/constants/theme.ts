import { useColorScheme } from 'react-native';

import type { TextStyle } from 'react-native';

/**
 * Quiet chrome so each habit's own color carries the screen.
 * Surfaces are separated by tone, not outlines: background < card, muted = wells inside a card.
 */
export const Colors = {
  light: {
    text: '#16181c',
    textSecondary: '#5d636c',
    background: '#f1f2f4',
    card: '#ffffff',
    border: '#e1e3e7',
    accent: '#3157e0',
    accentText: '#ffffff',
    danger: '#d23b3b',
    success: '#1f9d57',
    muted: '#eaecef',
  },
  dark: {
    text: '#eef0f3',
    textSecondary: '#9aa1ab',
    background: '#0f1114',
    card: '#1a1d21',
    border: '#2b2f35',
    accent: '#8aa4ff',
    accentText: '#0d1630',
    danger: '#f27b7b',
    success: '#4cc985',
    muted: '#262a30',
  },
};

export type Palette = typeof Colors.light;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}

/** Habit colors to pick from (any #RRGGBB can also be typed in). */
export const HABIT_COLORS = [
  '#ef4444', // red
  '#f43f5e', // rose
  '#ec4899', // pink
  '#d946ef', // fuchsia
  '#a855f7', // purple
  '#8b5cf6', // violet
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#22c55e', // green
  '#84cc16', // lime
  '#eab308', // yellow
  '#f59e0b', // amber
  '#f97316', // orange
  '#a16207', // brown
  '#64748b', // slate
  '#111827', // near black
];

export const isHexColor = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** 4-point spacing scale. Row gap < group gap < section gap. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 20, full: 999 } as const;

/** Text styles (system font). Colors are applied by the caller from the palette. */
export const type = {
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  subhead: { fontSize: 13, fontWeight: '400' },
  section: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

/** A habit color at low opacity, for icon tiles and soft fills. */
export const tint = (hex: string, alpha = 0.16) =>
  hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
