import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';

import { useColors } from '@/constants/theme';
import { fromKey, toKey } from '@/lib/dates';

import { styles } from './ui';

export function DateField({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Latest date that can be picked (YYYY-MM-DD). */
  max?: string;
}) {
  const c = useColors();
  const [iosOpen, setIosOpen] = useState(false);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromKey(value),
        mode: 'date',
        maximumDate: max ? fromKey(max) : undefined,
        onChange: (e, d) => e.type === 'set' && d && onChange(toKey(d)),
      });
    } else setIosOpen((o) => !o);
  };
  return (
    <>
      <Pressable onPress={open} style={[styles.input, { backgroundColor: c.muted, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: 16 }}>{value}</Text>
      </Pressable>
      {iosOpen && <DateTimePicker
          value={fromKey(value)}
          mode="date"
          maximumDate={max ? fromKey(max) : undefined}
          onChange={(_, d) => d && onChange(toKey(d))} />}
    </>
  );
}
