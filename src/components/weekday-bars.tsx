import { Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { getWeekStartDay } from '@/lib/dates';
import type { WeekdayStat } from '@/lib/stats';

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Completion % per weekday, best and worst days highlighted. */
export function WeekdayBars({ stats, color }: { stats: WeekdayStat[]; color: string }) {
  const c = useColors();
  const ORDER = Array.from({ length: 7 }, (_, i) => (getWeekStartDay() + i) % 7);
  const rates = stats.map((s) => (s.due ? s.done / s.due : null));
  const valid = rates.filter((r): r is number => r !== null);
  const max = valid.length ? Math.max(...valid) : 0;
  const min = valid.length ? Math.min(...valid) : 0;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }}>
      {ORDER.map((d) => {
        const r = rates[d];
        const highlight = r !== null && valid.length > 1 && max !== min && (r === max || r === min);
        return (
          <View key={d} style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ color: c.textSecondary, fontSize: 11, marginBottom: 4 }}>
              {r === null ? '' : `${Math.round(r * 100)}%`}
            </Text>
            <View style={{ height: 70, width: 18, justifyContent: 'flex-end', backgroundColor: c.muted, borderRadius: 6 }}>
              <View
                style={{
                  height: `${(r ?? 0) * 100}%`,
                  backgroundColor: r === max && highlight ? color : r === min && highlight ? c.danger : color + '88',
                  borderRadius: 6,
                }}
              />
            </View>
            <Text style={{ color: c.text, fontSize: 12, marginTop: 4, fontWeight: highlight ? '700' : '400' }}>
              {NAMES[d]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
