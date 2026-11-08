import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { radius, space, tint, type as typo, useColors } from '@/constants/theme';
import type { HabitIconName } from '@/lib/habit-icon';

import { Icon, type UiIconName } from './icon';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card }, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.textSecondary }]}>{children}</Text>;
}

/** Section title above a group of rows, with an optional icon. */
export function SectionHeader({ title, icon, right }: { title: string; icon?: UiIconName; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionHeader}>
      {icon && <Icon name={icon} size={18} color={c.textSecondary} />}
      <Text style={[typo.section, { color: c.textSecondary, flex: 1 }]} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

/** A habit's icon on a soft tile of its color. */
export function HabitIconTile({ icon, color, size = 44 }: { icon: HabitIconName; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        borderCurve: 'continuous',
        backgroundColor: tint(color),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon habit={icon} size={Math.round(size * 0.54)} color={color} />
    </View>
  );
}

/** Empty screens are an invitation to act: icon, one line of why, one action. */
export function EmptyState({ icon, title, body, action }: { icon: UiIconName; title: string; body?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: tint(c.accent as string, 0.12) }]}>
        <Icon name={icon} size={34} color={c.accent} />
      </View>
      <Text style={[typo.headline, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[typo.body, { color: c.textSecondary, textAlign: 'center' }]}>{body}</Text>}
      {action && <View style={{ marginTop: space.sm }}>{action}</View>}
    </View>
  );
}

/** Round, icon-only control. Always give it a label for screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  disabled,
  size = 40,
}: {
  icon: UiIconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  size?: number;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.muted : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}>
      <Icon name={icon} size={Math.round(size * 0.58)} color={color ?? c.text} />
    </Pressable>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const c = useColors();
  return <Text style={[{ color: muted ? c.textSecondary : c.text, fontSize: 15 }, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  style,
  icon,
}: {
  title: string;
  icon?: UiIconName;
  /** May return a promise: the button then shows a spinner and ignores taps until it settles. */
  onPress: () => void | Promise<unknown>;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? tint(c.danger, 0.12) : c.muted;
  const fg = kind === 'primary' ? c.accentText : kind === 'danger' ? c.danger : c.text;
  const handlePress = () => {
    if (busy) return;
    const result = onPress();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setBusy(true);
      (result as Promise<unknown>).catch((e) => console.warn(e)).finally(() => setBusy(false));
    }
  };
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {icon && <Icon name={icon} size={20} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.accent : c.muted, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text style={{ color: selected ? c.accentText : c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.textSecondary}
      {...props}
      style={[styles.input, { color: c.text, backgroundColor: c.muted }, props.style]}
    />
  );
}

/** Integer input that keeps its own text state while editing. */
export function NumberInput({
  value,
  onChange,
  min = 1,
  style,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  style?: object;
} & Omit<TextInputProps, 'value' | 'onChange' | 'style'>) {
  return (
    <Input
      keyboardType="number-pad"
      {...rest}
      defaultValue={String(value)}
      onChangeText={(t) => {
        const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(n)) onChange(Math.max(min, n));
      }}
      style={[{ width: 80, textAlign: 'center' }, style]}
    />
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderCurve: 'continuous', padding: space.lg },
  label: { ...typo.section, marginBottom: space.sm },
  button: { borderRadius: radius.md, borderCurve: 'continuous', minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: { borderRadius: radius.md, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, marginBottom: 2, paddingHorizontal: 2 },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xxl },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingRight: space.sm, borderRadius: radius.lg, borderCurve: 'continuous', minHeight: 64 },
  navIcon: { width: 40, height: 40, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
});

/** Decimal input for weights/distances. Empty means 0. Keeps the typed text while editing ("62." stays). */
export function DecimalInput({
  value,
  onChange,
  placeholder,
  style,
  integer,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  style?: object;
  integer?: boolean;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <Input
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      value={text}
      placeholder={placeholder}
      selectTextOnFocus
      onChangeText={(t) => {
        const clean = t.replace(',', '.').replace(integer ? /[^0-9]/g : /[^0-9.]/g, '');
        setText(clean);
        const n = integer ? parseInt(clean, 10) : parseFloat(clean);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      style={[{ textAlign: 'center', paddingHorizontal: 6, paddingVertical: 8 }, style]}
    />
  );
}

/** A tappable row that opens another screen: icon, title, optional subtitle, chevron. */
export function NavRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  icon: UiIconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const c = useColors();
  const tone = iconColor ?? (c.accent as string);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.navRow, { backgroundColor: pressed ? c.muted : c.card }]}>
      <View style={[styles.navIcon, { backgroundColor: tint(tone, 0.14) }]}>
        <Icon name={icon} size={22} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typo.rowTitle, { color: c.text }]}>{title}</Text>
        {subtitle && <Text style={[typo.subhead, { color: c.textSecondary }]}>{subtitle}</Text>}
      </View>
      <Icon name="chevron_right" size={22} color={c.textSecondary} />
    </Pressable>
  );
}
