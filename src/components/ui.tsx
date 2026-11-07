import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useColors } from '@/constants/theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.textSecondary }]}>{children}</Text>;
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
}: {
  title: string;
  /** May return a promise: the button then shows a spinner and ignores taps until it settles. */
  onPress: () => void | Promise<unknown>;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? 'transparent' : c.muted;
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
      accessibilityState={{ disabled: !!disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        kind === 'danger' && { borderWidth: 1, borderColor: c.danger },
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.accent : c.muted, borderColor: selected ? c.accent : c.border },
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
      style={[styles.input, { color: c.text, backgroundColor: c.muted, borderColor: c.border }, props.style]}
    />
  );
}

/** Integer input that keeps its own text state while editing. */
export function NumberInput({
  value,
  onChange,
  min = 1,
  style,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  style?: object;
}) {
  return (
    <Input
      keyboardType="number-pad"
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
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
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
