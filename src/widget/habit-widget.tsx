import { FlexWidget, TextWidget, type HexColor } from 'react-native-android-widget';

export interface HabitWidgetModel {
  habitId: string | null;
  emoji: string;
  name: string;
  status: string;
  sub: string;
  done: boolean;
  color: HexColor;
  tappable: boolean;
}

const THEMES = {
  light: { bg: '#ffffff' as HexColor, text: '#111214' as HexColor, sub: '#62666d' as HexColor },
  dark: { bg: '#1a1b1f' as HexColor, text: '#f2f3f5' as HexColor, sub: '#a0a4ab' as HexColor },
};

/** One habit: big emoji, progress and streak. Tapping logs it. */
export function HabitWidget({ model, dark }: { model: HabitWidgetModel; dark: boolean }) {
  const t = THEMES[dark ? 'dark' : 'light'];
  if (!model.habitId) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: t.bg, borderRadius: 20, padding: 12, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="Habit not found" style={{ fontSize: 14, color: t.sub }} />
        <TextWidget text="Remove and re-add this widget" style={{ fontSize: 11, color: t.sub }} />
      </FlexWidget>
    );
  }
  return (
    <FlexWidget
      clickAction={model.tappable ? 'TAP' : 'OPEN_APP'}
      clickActionData={{ habitId: model.habitId }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: t.bg,
        borderRadius: 20,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: model.done ? model.color : t.bg,
      }}>
      <TextWidget text={model.emoji} style={{ fontSize: 30 }} />
      <TextWidget text={model.name} maxLines={1} truncate="END" style={{ fontSize: 13, color: t.text, marginTop: 2 }} />
      <TextWidget text={model.status} style={{ fontSize: 18, fontWeight: 'bold', color: model.done ? model.color : t.text, marginTop: 2 }} />
      {model.sub ? <TextWidget text={model.sub} style={{ fontSize: 11, color: t.sub }} /> : null}
    </FlexWidget>
  );
}
