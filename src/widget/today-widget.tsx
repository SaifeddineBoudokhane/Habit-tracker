import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

import type { HexColor } from 'react-native-android-widget';

export interface WidgetRow {
  id: string;
  emoji: string;
  name: string;
  status: string;
  done: boolean;
  color: HexColor;
  /** Whether tapping logs it from the widget (avoid habits open the app instead). */
  tappable: boolean;
}

export interface WidgetModel {
  rows: WidgetRow[];
  done: number;
  total: number;
}

const THEMES = {
  light: { bg: '#ffffff' as HexColor, text: '#111214' as HexColor, sub: '#62666d' as HexColor, row: '#f4f5f7' as HexColor },
  dark: { bg: '#1a1b1f' as HexColor, text: '#f2f3f5' as HexColor, sub: '#a0a4ab' as HexColor, row: '#26282d' as HexColor },
};

export function TodayWidget({ model, dark }: { model: WidgetModel; dark: boolean }) {
  const t = THEMES[dark ? 'dark' : 'light'];
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: t.bg, borderRadius: 20, padding: 12 }}>
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent', marginBottom: 8 }}>
        <TextWidget text="Today" style={{ fontSize: 16, fontWeight: 'bold', color: t.text }} />
        <TextWidget
          text={model.total ? `${model.done}/${model.total} done` : ''}
          style={{ fontSize: 13, color: t.sub }}
        />
      </FlexWidget>
      {model.rows.length === 0 ? (
        <TextWidget text="Nothing due today 🎉" clickAction="OPEN_APP" style={{ fontSize: 14, color: t.sub }} />
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {model.rows.map((r) => (
            <FlexWidget
              key={r.id}
              clickAction={r.tappable ? 'TAP' : 'OPEN_APP'}
              clickActionData={{ habitId: r.id }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: 'match_parent',
                backgroundColor: t.row,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 6,
              }}>
              <TextWidget
                text={`${r.emoji}  ${r.name}`}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 14, color: r.done ? t.sub : t.text }}
              />
              <TextWidget
                text={r.status}
                style={{ fontSize: 14, fontWeight: 'bold', color: r.done ? r.color : t.sub }}
              />
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
