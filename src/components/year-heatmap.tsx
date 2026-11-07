import { useRef } from 'react';
import { ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { fromKey } from '@/lib/dates';
import { yearGrid, type YearCell } from '@/lib/stats';
import type { Habit } from '@/lib/types';

const CELL = 13;
const GAP = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GitHub-style year view, scrolled to the current week. */
export function YearHeatmap({ habit }: { habit: Habit }) {
  const c = useColors();
  const { index, today } = useStore();
  const scroll = useRef<ScrollViewInstance>(null);
  const grid = yearGrid(habit, index, today);

  const color = (cell: YearCell): string => {
    switch (cell.status) {
      case 'done':
        return habit.kind === 'avoid' ? habit.color + '99' : habit.color;
      case 'partial':
        return habit.color + (cell.ratio > 0.5 ? '99' : '55');
      case 'slip':
        return c.danger;
      case 'skip':
        return c.textSecondary + '55';
      case 'future':
        return 'transparent';
      default:
        return c.muted;
    }
  };

  return (
    <ScrollView
      horizontal
      ref={scroll}
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
      <View>
        <View style={{ flexDirection: 'row', height: 16 }}>
          {grid.map((col, i) => {
            const d = fromKey(col[0].date);
            const first = i === 0 || fromKey(grid[i - 1][0].date).getMonth() !== d.getMonth();
            return (
              <View key={i} style={{ width: CELL + GAP }}>
                {first && (
                  <Text style={{ color: c.textSecondary, fontSize: 10, width: 40 }} numberOfLines={1}>
                    {MONTHS[d.getMonth()]}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {grid.map((col, i) => (
            <View key={i} style={{ marginRight: GAP }}>
              {col.map((cell) => (
                <View
                  key={cell.date}
                  style={{
                    width: CELL,
                    height: CELL,
                    marginBottom: GAP,
                    borderRadius: 3,
                    backgroundColor: color(cell),
                    borderWidth: cell.date === today ? 1.5 : 0,
                    borderColor: c.text,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
