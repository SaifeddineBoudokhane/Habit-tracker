'use no memo';
// Widget components must stay plain functions: the React Compiler rewrites them into hook calls,
// which react-native-android-widget cannot render ("Invalid Hook Call" -> "Error rendering widget").

import { FlexWidget, ListWidget, SvgWidget, TextWidget, type HexColor } from 'react-native-android-widget';

import { HABIT_ICONS, UI_ICONS } from '@/constants/icons';
import type { HabitIconName } from '@/lib/habit-icon';
import type { CellStatus } from '@/lib/stats';

import type { HabitCard, TodayRow, WidgetData } from './model';

export const WIDGET_SCHEME = 'habittracker://';

/** Size of the widget in dp, as Android reports it. */
export type Size = { width: number; height: number };

type Theme = {
  bg: HexColor;
  card: HexColor;
  text: HexColor;
  sub: HexColor;
  track: HexColor;
  accent: HexColor;
  success: HexColor;
  danger: HexColor;
};
// Same tokens as the app (constants/theme.ts) so a widget reads as part of it.
const THEMES: Record<'light' | 'dark', Theme> = {
  light: {
    bg: '#ffffff',
    card: '#f1f2f4',
    text: '#16181c',
    sub: '#5d636c',
    track: '#e4e6ea',
    accent: '#3157e0',
    success: '#1f9d57',
    danger: '#d23b3b',
  },
  dark: {
    bg: '#1a1d21',
    card: '#262a30',
    text: '#eef0f3',
    sub: '#9aa1ab',
    track: '#363b43',
    accent: '#8aa4ff',
    success: '#4cc985',
    danger: '#f27b7b',
  },
};
const theme = (dark: boolean) => THEMES[dark ? 'dark' : 'light'];
const FLAME = '#f97316' as HexColor;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ---------- SVG pieces (widgets draw pictures, not views) ---------- */

// SVGs are drawn at 3x their dp size and scaled down, so they stay crisp on dense screens.
const SCALE = 3;
const svgOpen = (size: number, h = size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size * SCALE}" height="${h * SCALE}" viewBox="0 0 ${size} ${h}">`;

/** A Material glyph placed in a box of `size` at (x, y). */
const glyph = (d: string, color: string, x: number, y: number, size: number) =>
  `<path fill="${color}" transform="translate(${x} ${y}) scale(${size / 960}) translate(0 960)" d="${d}"/>`;

function arc(cx: number, r: number, stroke: number, color: string, progress: number) {
  const p = clamp(progress, 0, 1);
  if (p <= 0) return '';
  const c = 2 * Math.PI * r;
  return `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${cx} ${cx})"/>`;
}

/**
 * A habit's button: its icon inside a progress ring. Done = a solid disc of its color with a white icon,
 * so a finished day reads as a row of filled colors from across the room.
 */
function badgeSvg(o: { icon: HabitIconName; color: string; progress: number; done: boolean; size: number; t: Theme; warn?: boolean }) {
  const { size, color, t } = o;
  const cx = size / 2;
  const stroke = Math.max(3, Math.round(size / 12));
  const r = cx - stroke / 2 - 0.5;
  const iconSize = size * 0.5;
  const d = HABIT_ICONS[o.icon].d;
  if (o.done) {
    return (
      svgOpen(size) +
      `<circle cx="${cx}" cy="${cx}" r="${cx - 0.5}" fill="${color}"/>` +
      glyph(d, '#ffffff', cx - iconSize / 2, cx - iconSize / 2, iconSize) +
      `</svg>`
    );
  }
  return (
    svgOpen(size) +
    `<circle cx="${cx}" cy="${cx}" r="${r}" fill="${color}" fill-opacity="0.14" stroke="${o.warn ? t.danger : color}" stroke-opacity="${o.warn ? 1 : 0.28}" stroke-width="${stroke}"/>` +
    arc(cx, r, stroke, color, o.progress) +
    glyph(d, o.warn ? t.danger : color, cx - iconSize / 2, cx - iconSize / 2, iconSize) +
    `</svg>`
  );
}

/** Checkbox on the right of a list row. */
function checkSvg(done: boolean, color: string, t: Theme, size = 26) {
  const cx = size / 2;
  const s = size * 0.64;
  return done
    ? svgOpen(size) + `<circle cx="${cx}" cy="${cx}" r="${cx}" fill="${color}"/>` + glyph(UI_ICONS.check, '#ffffff', cx - s / 2, cx - s / 2, s) + `</svg>`
    : svgOpen(size) + `<circle cx="${cx}" cy="${cx}" r="${cx - 1.5}" fill="none" stroke="${t.track}" stroke-width="2.5"/></svg>`;
}

/** Plain icon. */
function iconSvg(d: string, color: string, size: number) {
  return svgOpen(size) + glyph(d, color, 0, 0, size) + `</svg>`;
}

/** Day progress ring with a label or a check in the middle. */
function ringSvg(progress: number, color: string, t: Theme, size: number, label: string) {
  const cx = size / 2;
  const stroke = Math.max(4, Math.round(size / 10));
  const r = cx - stroke / 2;
  const done = progress >= 1;
  const s = size * 0.46;
  return (
    svgOpen(size) +
    `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${t.track}" stroke-width="${stroke}"/>` +
    arc(cx, r, stroke, color, progress) +
    (done
      ? glyph(UI_ICONS.check, color, cx - s / 2, cx - s / 2, s)
      : `<text x="${cx}" y="${cx}" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${Math.round(size * (label.length > 3 ? 0.24 : 0.28))}" fill="${t.text}">${label}</text>`) +
    `</svg>`
  );
}

/** Seven days as dots in one picture, so columns line up exactly with the day letters. */
function weekSvg(cells: CellStatus[], color: string, t: Theme, cell: number, todayIdx: number) {
  const h = cell;
  const r = cell * 0.3;
  let out = svgOpen(cell * cells.length, h);
  cells.forEach((st, i) => {
    const cx = i * cell + cell / 2;
    const cy = h / 2;
    switch (st) {
      case 'done':
        out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
        break;
      case 'partial':
        out += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2"/>`;
        break;
      case 'slip':
        out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.danger}"/>`;
        break;
      case 'skip':
        out += `<rect x="${cx - r * 0.7}" y="${cy - 1.25}" width="${r * 1.4}" height="2.5" rx="1.25" fill="${t.sub}"/>`;
        break;
      case 'none':
        out += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${i === todayIdx ? t.sub : t.track}" stroke-width="2"/>`;
        break;
      default:
        // Not scheduled / before the habit started.
        out += `<circle cx="${cx}" cy="${cy}" r="1.75" fill="${t.track}"/>`;
    }
  });
  return out + `</svg>`;
}

const Svg = ({ svg, size, h = size, ml = 0, mr = 0 }: { svg: string; size: number; h?: number; ml?: number; mr?: number }) => (
  <SvgWidget svg={svg} style={{ width: size, height: h, marginLeft: ml, marginRight: mr }} />
);

const root = (t: Theme, padding = 12) => ({
  height: 'match_parent' as const,
  width: 'match_parent' as const,
  backgroundColor: t.bg,
  borderRadius: 24,
  padding,
});

/** "3/5" with a small ring, or a check when the day is done. */
function DayHeader({ data, t, title }: { data: WidgetData; t: Theme; title: string }) {
  const allDone = data.total > 0 && data.done === data.total;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 8, paddingHorizontal: 2 }}>
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={title} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold', color: t.text }} />
      </FlexWidget>
      {data.total > 0 ? (
        <TextWidget
          text={allDone ? 'All done' : `${data.done} of ${data.total}`}
          style={{ fontSize: 13, fontWeight: 'bold', color: allDone ? t.success : t.sub, marginRight: 6 }}
        />
      ) : null}
      {data.total > 0 ? (
        <Svg svg={ringSvg(data.done / data.total, allDone ? t.success : t.accent, t, 20, '')} size={20} />
      ) : null}
    </FlexWidget>
  );
}

function Empty({ t, icon, title, body }: { t: Theme; icon: string; title: string; body?: string }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
      <Svg svg={iconSvg(icon, t.accent, 28)} size={28} />
      <TextWidget text={title} maxLines={1} style={{ fontSize: 14, fontWeight: 'bold', color: t.text, marginTop: 6 }} />
      {body ? <TextWidget text={body} maxLines={2} style={{ fontSize: 12, color: t.sub, textAlign: 'center' }} /> : null}
    </FlexWidget>
  );
}

/* ---------- Today ---------- */

/**
 * Compact: a row of round habit buttons. Pending habits first, so the next tap is always in reach;
 * avoid habits last, since they can't be logged from a widget.
 */
function TodayButtons({ rows, t, size }: { rows: TodayRow[]; t: Theme; size: Size }) {
  const slot = 56;
  const fit = Math.max(2, Math.floor((size.width - 24) / slot));
  const ordered = [
    ...rows.filter((r) => !r.done && !r.avoid),
    ...rows.filter((r) => r.done),
    ...rows.filter((r) => r.avoid),
  ];
  const overflow = ordered.length > fit ? ordered.length - (fit - 1) : 0;
  const shown = overflow ? ordered.slice(0, fit - 1) : ordered;
  const badge = clamp(Math.floor(size.height - 24 - 30 - 18), 36, 52);
  return (
    <FlexWidget style={{ flex: 1, flexDirection: 'row', width: 'match_parent', alignItems: 'center', justifyContent: 'space-around' }}>
      {shown.map((r) => (
        <FlexWidget
          key={r.id}
          clickAction={r.avoid ? 'OPEN_APP' : 'TAP'}
          clickActionData={{ habitId: r.id }}
          style={{ width: slot, alignItems: 'center' }}>
          <Svg
            svg={badgeSvg({ icon: r.icon, color: r.color, progress: r.progress, done: r.done, size: badge, t, warn: r.slipped })}
            size={badge}
          />
          <TextWidget
            text={r.name}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, color: r.done ? t.sub : t.text, marginTop: 3, textAlign: 'center' }}
          />
        </FlexWidget>
      ))}
      {overflow ? (
        <FlexWidget clickAction="OPEN_APP" style={{ width: slot, alignItems: 'center' }}>
          <FlexWidget
            style={{ width: badge, height: badge, borderRadius: badge / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={`+${overflow}`} style={{ fontSize: 14, fontWeight: 'bold', color: t.sub }} />
          </FlexWidget>
          <TextWidget text="More" maxLines={1} style={{ fontSize: 11, color: t.sub, marginTop: 3 }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** Tall: a checklist. The whole row is the tap target. */
function TodayList({ rows, t }: { rows: TodayRow[]; t: Theme }) {
  return (
    <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
      {rows.map((r) => (
        <FlexWidget
          key={r.id}
          clickAction={r.avoid ? 'OPEN_APP' : 'TAP'}
          clickActionData={{ habitId: r.id }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: 'match_parent',
            backgroundColor: t.card,
            borderRadius: 16,
            paddingLeft: 8,
            paddingRight: 12,
            paddingVertical: 7,
            marginBottom: 6,
          }}>
          <Svg
            svg={badgeSvg({ icon: r.icon, color: r.color, progress: r.avoid ? 0 : r.progress, done: false, size: 34, t, warn: r.slipped })}
            size={34}
            mr={10}
          />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={r.name} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '500', color: r.done ? t.sub : t.text }} />
          </FlexWidget>
          {r.avoid ? (
            <TextWidget
              text={r.slipped ? 'Slipped' : `${r.status} clean`}
              style={{ fontSize: 12, fontWeight: 'bold', color: r.slipped ? t.danger : t.sub }}
            />
          ) : (
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
              {r.status ? <TextWidget text={r.status} style={{ fontSize: 12, fontWeight: 'bold', color: t.sub, marginRight: 8 }} /> : null}
              <Svg svg={checkSvg(r.done, r.color, t)} size={26} />
            </FlexWidget>
          )}
        </FlexWidget>
      ))}
    </ListWidget>
  );
}

export function TodayWidget({ data, dark, size }: { data: WidgetData; dark: boolean; size: Size }) {
  const t = theme(dark);
  const compact = size.height < 170;
  return (
    <FlexWidget style={root(t)}>
      <DayHeader data={data} t={t} title={data.dayName} />
      {data.rows.length === 0 ? (
        <Empty t={t} icon={UI_ICONS.spa} title={data.message.title} body={compact ? undefined : data.message.body} />
      ) : compact ? (
        <TodayButtons rows={data.rows} t={t} size={size} />
      ) : (
        <TodayList rows={data.rows} t={t} />
      )}
    </FlexWidget>
  );
}

/* ---------- Single habit ---------- */

export function HabitWidget({ card, widgetId, dark, size }: { card: HabitCard | null; widgetId: number; dark: boolean; size: Size }) {
  const t = theme(dark);
  if (!card) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: `${WIDGET_SCHEME}widget-setup?widgetId=${widgetId}` }}
        style={{ ...root(t), justifyContent: 'center', alignItems: 'center' }}>
        <FlexWidget style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
          <Svg svg={iconSvg(UI_ICONS.add, t.accent, 26)} size={26} />
        </FlexWidget>
        <TextWidget text="Choose a habit" style={{ fontSize: 13, fontWeight: 'bold', color: t.text, marginTop: 8 }} />
      </FlexWidget>
    );
  }
  const badge = clamp(Math.round(Math.min(size.width, size.height) * 0.46), 44, 96);
  const sub =
    card.avoid
      ? { icon: UI_ICONS['shield-fill'], color: card.slipped ? t.danger : card.color, text: card.slipped ? 'Slipped today' : `${card.streak} days clean` }
      : card.streak > 0
        ? { icon: UI_ICONS['streak-fill'], color: FLAME, text: `${card.streak} ${card.streakUnit}` }
        : null;
  return (
    <FlexWidget
      clickAction={card.tappable ? 'TAP' : 'OPEN_APP'}
      clickActionData={{ habitId: card.id }}
      style={{ ...root(t, 10), alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        svg={badgeSvg({ icon: card.icon, color: card.color, progress: card.avoid ? 0 : card.progress, done: card.done, size: badge, t, warn: card.slipped })}
        size={badge}
      />
      <TextWidget
        text={card.name}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 14, fontWeight: 'bold', color: t.text, marginTop: 6, textAlign: 'center' }}
      />
      {/* Count habits show progress; everything else shows the streak it protects. */}
      {!card.done && !card.avoid && card.status !== 'Tap to log' ? (
        <TextWidget text={card.status} maxLines={1} style={{ fontSize: 12, color: t.sub }} />
      ) : sub ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
          <Svg svg={iconSvg(sub.icon, sub.color, 14)} size={14} mr={3} />
          <TextWidget text={sub.text} maxLines={1} style={{ fontSize: 12, fontWeight: 'bold', color: t.sub }} />
        </FlexWidget>
      ) : (
        <TextWidget text={card.done ? 'Done' : 'Tap to log'} maxLines={1} style={{ fontSize: 12, color: card.done ? card.color : t.sub }} />
      )}
    </FlexWidget>
  );
}

/* ---------- Streaks ---------- */

export function StreaksWidget({ data, dark, size }: { data: WidgetData; dark: boolean; size: Size }) {
  const t = theme(dark);
  const allDone = data.total > 0 && data.done === data.total;
  const ring = clamp(Math.round(size.height - 32), 56, 92);
  const lines = clamp(Math.floor((size.height - 24 - 24) / 22), 1, 4);
  const streaks = data.topStreaks.slice(0, lines);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...root(t, 14), flexDirection: 'row', alignItems: 'center' }}>
      <Svg
        svg={ringSvg(data.total ? data.done / data.total : 0, allDone ? t.success : t.accent, t, ring, data.total ? `${data.done}/${data.total}` : '–')}
        size={ring}
        mr={14}
      />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={data.message.title} maxLines={1} truncate="END" style={{ fontSize: 15, fontWeight: 'bold', color: t.text, marginBottom: 4 }} />
        {streaks.length === 0 ? (
          <TextWidget text="No streaks yet. Today is day one." maxLines={2} style={{ fontSize: 12, color: t.sub }} />
        ) : (
          streaks.map((s, i) => (
            <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 4 }}>
              <Svg svg={iconSvg(HABIT_ICONS[s.icon].d, s.color, 16)} size={16} mr={8} />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget text={s.name} maxLines={1} truncate="END" style={{ fontSize: 13, color: s.doneToday ? t.text : t.sub }} />
              </FlexWidget>
              <Svg
                svg={iconSvg(UI_ICONS[s.avoid ? 'shield-fill' : 'streak-fill'], s.doneToday ? (s.avoid ? s.color : FLAME) : t.track, 14)}
                size={14}
                mr={2}
              />
              <TextWidget text={`${s.current}${s.unit}`} style={{ fontSize: 13, fontWeight: 'bold', color: t.text }} />
            </FlexWidget>
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

/* ---------- Week ---------- */

export function WeekWidget({ data, dark, size }: { data: WidgetData; dark: boolean; size: Size }) {
  const t = theme(dark);
  const showNames = size.width >= 250;
  // Narrow widgets shrink the day columns instead of overflowing.
  const cell = clamp(Math.floor((size.width - 24 - (showNames ? 110 : 30)) / 7), 16, 24);
  const rowsFit = clamp(Math.floor((size.height - 24 - 26) / 26), 1, 8);
  const rows = data.week.rows.slice(0, rowsFit);
  return (
    <FlexWidget clickAction="OPEN_APP" style={root(t)}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', marginBottom: 4, paddingLeft: 2 }}>
        <FlexWidget style={{ flex: 1 }}>
          {showNames ? <TextWidget text="Last 7 days" maxLines={1} style={{ fontSize: 14, fontWeight: 'bold', color: t.text }} /> : null}
        </FlexWidget>
        {data.week.labels.map((l, i) => (
          <FlexWidget key={i} style={{ width: cell, alignItems: 'center' }}>
            <TextWidget text={l} style={{ fontSize: 11, color: i === 6 ? t.accent : t.sub, fontWeight: i === 6 ? 'bold' : 'normal' }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      {rows.length === 0 ? (
        <Empty t={t} icon={UI_ICONS.spa} title="No habits yet" body="Add one to see your week." />
      ) : (
        rows.map((r) => (
          <FlexWidget key={r.id} style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', marginTop: 4 }}>
            <Svg svg={iconSvg(HABIT_ICONS[r.icon].d, r.color, 18)} size={18} ml={2} mr={8} />
            <FlexWidget style={{ flex: 1 }}>
              {showNames ? <TextWidget text={r.name} maxLines={1} truncate="END" style={{ fontSize: 13, color: t.text }} /> : null}
            </FlexWidget>
            <Svg svg={weekSvg(r.cells, r.color, t, cell, 6)} size={cell * 7} h={cell} />
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}
