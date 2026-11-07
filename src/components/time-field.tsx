import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';

import { useColors } from '@/constants/theme';
import { formatTime, parseTime } from '@/lib/dates';

import { styles } from './ui';

/** Shows "HH:MM"; tapping opens the native time picker. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useColors();
  const [iosOpen, setIosOpen] = useState(false);
  const minutes = parseTime(value);
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  const apply = (d?: Date) => d && onChange(formatTime(d.getHours() * 60 + d.getMinutes()));

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        is24Hour: true,
        onChange: (e, d) => e.type === 'set' && apply(d),
      });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <>
      <Pressable onPress={open} style={[styles.input, { backgroundColor: c.muted, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: 16, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </Pressable>
      {iosOpen && (
        <DateTimePicker value={date} mode="time" display="spinner" onChange={(_, d) => apply(d)} />
      )}
    </>
  );
}
