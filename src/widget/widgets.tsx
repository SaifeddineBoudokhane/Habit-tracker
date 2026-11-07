'use no memo';
// Widget components must stay plain functions: the React Compiler rewrites them into hook calls,
// which react-native-android-widget cannot render ("Invalid Hook Call" -> "Error rendering widget").

import { FlexWidget, ListWidget, SvgWidget, TextWidget, type HexColor } from 'react-native-android-widget';

import type { HabitCard, WidgetData } from './model';

export const WIDGET_SCHEME = 'habittracker://';

type Theme = {
  bg: HexColor;
  card: HexColor;
  text: HexColor;
  sub: HexColor;
  track: HexColor;
  accent: HexColor;
};
const THEMES: Record<'light' | 'dark', Theme> = {
  light: {
    bg: '#ffffff',
    card: '#f2f4f7',
    text: '#111214',
    sub: '#62666d',
    track: '#e3e6ea',
    accent: '#2563eb',
  },
  dark: {
    bg: '#17181c',
    card: '#24262b',
    text: '#f2f3f5',
    sub: '#a0a4ab',
    track: '#33363d',
    accent: '#4f8bff',
  },
};
const theme = (dark: boolean) => THEMES[dark ? 'dark' : 'light'];

function ring(
  progress: number,
  color: string,
  track: string,
  size: number,
  label: string,
  labelColor: string,
  fontScale = 0.3,
) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="7"/>` +
    (p > 0
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`
      : '') +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(size * fontScale)}" font-weight="bold" fill="${labelColor}">${label}</text>` +
    `</svg>`
  );
}

/** Two flex children make a progress bar (widgets can't size by percentage). */
function Bar({ value, total, color, track }: { value: number; total: number; color: HexColor; track: HexColor }) {
  const filled = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        width: 'match_parent',
        height: 6,
        borderRadius: 3,
        backgroundColor: track,
        overflow: 'hidden',
      }}>
      {filled > 0 ? (
        <FlexWidget
          style={{
            flex: filled,
            height: 6,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      ) : null}
      {filled < 100 ? <FlexWidget style={{ flex: 100 - filled, height: 6 }} /> : null}
    </FlexWidget>
  );
}

const root = (t: Theme) => ({
  height: 'match_parent' as const,
  width: 'match_parent' as const,
  backgroundColor: t.bg,
  borderRadius: 22,
  padding: 14,
});

/* ---------- Today (list) ---------- */

export function TodayWidget({ data, dark }: { data: WidgetData; dark: boolean }) {
  const t = theme(dark);
  return (
    <FlexWidget style={root(t)}>
      <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', marginBottom: 8 }}>
        <FlexWidget
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: 'match_parent',
            marginBottom: 6,
          }}>
          <TextWidget text="Today" style={{ fontSize: 17, fontWeight: 'bold', color: t.text }} />
          <TextWidget
            text={data.total ? `${data.done}/${data.total}` : ''}
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: data.total && data.done === data.total ? '#16a34a' : t.sub,
            }}
          />
        </FlexWidget>
        {data.total > 0 ? (
          <Bar
            value={data.done}
            total={data.total}
            color={data.done === data.total ? '#16a34a' : t.accent}
            track={t.track}
          />
        ) : null}
      </FlexWidget>
      {data.rows.length === 0 ? (
        <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flex: 1, justifyContent: 'center' }}>
          <TextWidget
            text={`${data.message.emoji} ${data.message.title}`}
            style={{ fontSize: 15, fontWeight: 'bold', color: t.text }}
          />
          <TextWidget text={data.message.body} maxLines={2} style={{ fontSize: 12, color: t.sub }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {data.rows.map((r) => (
            <FlexWidget
              key={r.id}
              clickAction={r.tappable ? 'TAP' : 'OPEN_APP'}
              clickActionData={{ habitId: r.id }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: 'match_parent',
                backgroundColor: t.card,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 6,
              }}>
              <FlexWidget
                style={{
                  width: 4,
                  height: 22,
                  borderRadius: 2,
                  backgroundColor: r.color,
                  marginRight: 10,
                }}
              />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={`${r.emoji}  ${r.name}`}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 14, color: r.done ? t.sub : t.text }}
                />
              </FlexWidget>
              {r.streak > 0 ? <TextWidget text={`🔥${r.streak} `} style={{ fontSize: 12, color: t.sub }} /> : null}
              <TextWidget
                text={r.status}
                style={{
                  fontSize: 15,
                  fontWeight: 'bold',
                  color: r.done ? r.color : t.sub,
                }}
              />
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

/* ---------- Single habit ---------- */

export function HabitWidget({ card, widgetId, dark }: { card: HabitCard | null; widgetId: number; dark: boolean }) {
  const t = theme(dark);
  if (!card) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{
          uri: `${WIDGET_SCHEME}widget-setup?widgetId=${widgetId}`,
        }}
        style={{ ...root(t), justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="➕" style={{ fontSize: 26 }} />
        <TextWidget
          text="Tap to choose"
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            color: t.text,
            marginTop: 4,
          }}
        />
        <TextWidget text="a habit" style={{ fontSize: 12, color: t.sub }} />
      </FlexWidget>
    );
  }
  return (
    <FlexWidget
      clickAction={card.tappable ? 'TAP' : 'OPEN_APP'}
      clickActionData={{ habitId: card.id }}
      style={{
        ...root(t),
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
      }}>
      <SvgWidget
        svg={ring(card.progress, card.color, t.track, 64, card.emoji, t.text)}
        style={{ height: 64, width: 64 }}
      />
      <TextWidget
        text={card.name}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: 13,
          fontWeight: 'bold',
          color: t.text,
          marginTop: 4,
        }}
      />
      <TextWidget text={card.status} maxLines={1} style={{ fontSize: 12, color: card.done ? card.color : t.sub }} />
      {card.streak > 0 ? (
        <TextWidget
          text={`🔥 ${card.streak} ${card.streakUnit}`}
          style={{
            fontSize: 12,
            fontWeight: 'bold',
            color: t.text,
            marginTop: 2,
          }}
        />
      ) : (
        <TextWidget text={card.message} maxLines={1} style={{ fontSize: 11, color: t.sub, marginTop: 2 }} />
      )}
    </FlexWidget>
  );
}

/* ---------- Streaks & motivation ---------- */

export function StreaksWidget({ data, dark }: { data: WidgetData; dark: boolean }) {
  const t = theme(dark);
  const pct = data.total ? Math.round((data.done / data.total) * 100) : 0;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...root(t), flexDirection: 'row', alignItems: 'center' }}>
      <SvgWidget
        svg={ring(
          data.total ? data.done / data.total : 0,
          data.done === data.total && data.total ? '#16a34a' : t.accent,
          t.track,
          76,
          data.total ? `${pct}%` : '–',
          t.text,
          pct >= 100 ? 0.2 : 0.24,
        )}
        style={{ height: 76, width: 76, marginRight: 12 }}
      />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={`${data.message.emoji} ${data.message.title}`}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 15, fontWeight: 'bold', color: t.text }}
        />
        <TextWidget
          text={data.message.body}
          maxLines={2}
          truncate="END"
          style={{ fontSize: 12, color: t.sub, marginBottom: 6 }}
        />
        {data.topStreaks.length === 0 ? (
          <TextWidget text="No streaks yet. Today is day one." style={{ fontSize: 12, color: t.sub }} />
        ) : (
          data.topStreaks.map((s, i) => (
            <FlexWidget
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: 'match_parent',
                marginTop: 2,
              }}>
              <TextWidget
                text={`🔥 ${s.current}${s.unit}`}
                style={{
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: s.doneToday ? s.color : t.text,
                }}
              />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={`  ${s.emoji} ${s.name}`}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 13, color: t.sub }}
                />
              </FlexWidget>
            </FlexWidget>
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

/* ---------- Week view ---------- */

export function WeekWidget({ data, dark }: { data: WidgetData; dark: boolean }) {
  const t = theme(dark);
  const dot = (status: string, color: HexColor): { bg: HexColor; border: HexColor } => {
    switch (status) {
      case 'done':
        return { bg: color, border: color };
      case 'partial':
        return { bg: `${color}66` as HexColor, border: color };
      case 'slip':
        return { bg: '#dc2626', border: '#dc2626' };
      case 'skip':
        return { bg: t.track, border: t.sub };
      case 'none':
        return { bg: t.bg, border: t.track };
      default:
        return { bg: t.bg, border: t.bg };
    }
  };
  return (
    <FlexWidget clickAction="OPEN_APP" style={root(t)}>
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          alignItems: 'center',
          marginBottom: 6,
        }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text="Week" style={{ fontSize: 15, fontWeight: 'bold', color: t.text }} />
        </FlexWidget>
        {data.week.labels.map((l, i) => (
          <FlexWidget key={i} style={{ width: 22, alignItems: 'center' }}>
            <TextWidget
              text={l}
              style={{
                fontSize: 11,
                color: i === 6 ? t.text : t.sub,
                fontWeight: i === 6 ? 'bold' : 'normal',
              }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>
      {data.week.rows.length === 0 ? (
        <TextWidget text="Add a habit to see your week." style={{ fontSize: 12, color: t.sub }} />
      ) : (
        data.week.rows.map((r) => (
          <FlexWidget
            key={r.id}
            style={{
              flexDirection: 'row',
              width: 'match_parent',
              alignItems: 'center',
              marginBottom: 4,
            }}>
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget text={r.emoji} style={{ fontSize: 15 }} />
            </FlexWidget>
            {r.cells.map((c, i) => {
              const d = dot(c, r.color);
              return (
                <FlexWidget key={i} style={{ width: 22, alignItems: 'center' }}>
                  <FlexWidget
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: d.bg,
                      borderWidth: 2,
                      borderColor: d.border,
                    }}
                  />
                </FlexWidget>
              );
            })}
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}
