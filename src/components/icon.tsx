import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HABIT_ICONS, UI_ICONS } from '@/constants/icons';
import type { HabitIconName } from '@/lib/habit-icon';

export type UiIconName = keyof typeof UI_ICONS;

/** A Material Symbols (Rounded) glyph. `name` is a UI icon; `habit` is a habit's icon. */
export function Icon({
  name,
  habit,
  size = 24,
  color,
}: {
  name?: UiIconName;
  habit?: HabitIconName;
  size?: number;
  color: ColorValue;
}) {
  const d = habit ? HABIT_ICONS[habit].d : name ? UI_ICONS[name] : '';
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" pointerEvents="none">
      <Path d={d} fill={color} />
    </Svg>
  );
}
