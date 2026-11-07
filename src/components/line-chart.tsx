import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useColors } from '@/constants/theme';
import type { SeriesPoint } from '@/lib/workouts';

export function LineChart({ points, color, height = 160 }: { points: SeriesPoint[]; color: string; height?: number }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  if (points.length === 0) return null;
  const pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (points.length - 1));
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const coords = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>max {max}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>min {min}</Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={y(max)} y2={y(max)} stroke={c.border} strokeDasharray="4 4" />
            <Line x1={0} x2={width} y1={y(min)} y2={y(min)} stroke={c.border} strokeDasharray="4 4" />
            <Polyline points={coords} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={color} />
            ))}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>{points[0].date}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>{points[points.length - 1].date}</Text>
      </View>
    </View>
  );
}
