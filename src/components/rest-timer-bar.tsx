import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { restTimer, useRestTimer } from '@/data/rest-timer';
import { formatDuration } from '@/lib/workouts';

export function RestTimerBar() {
  const c = useColors();
  const { endsAt, total } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt !== null && now >= endsAt) restTimer.stop();
  }, [now, endsAt]);

  if (endsAt === null) return null;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const frac = total ? Math.min(1, left / total) : 0;

  return (
    <View style={[s.bar, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[s.fill, { width: `${frac * 100}%`, backgroundColor: c.accent + '22' }]} />
      <Text style={[s.time, { color: c.text }]}>Rest {formatDuration(left)}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="−15" onPress={() => restTimer.add(-15)} />
        <Btn label="+15" onPress={() => restTimer.add(15)} />
        <Btn label="Skip" onPress={() => restTimer.stop()} />
      </View>
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[s.btn, { backgroundColor: c.muted }]} hitSlop={6}>
      <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  time: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
});
