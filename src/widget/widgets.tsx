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
 * What a Today button shows in its middle, so its state reads without labels:
 * done = check mark on a solid disc; count habits = how far along ("3/20"); yes/no = the habit's icon.
 */
type ButtonState = Pick<TodayRow, 'done' | 'color' | 'slipped' | 'avoid' | 'numeric' | 'value' | 'target' | 'progress' | 'icon'>;

function buttonSvg(r: ButtonState, size: number, t: Theme, iconWithCount = false) {
  const cx = size / 2;
  const stroke = Math.max(3, Math.round(size / 12));
  const ring = cx - stroke / 2 - 0.5;
  if (r.done && iconWithCount) {
    // Alone on a 1x1: keep the habit's icon so you know which one is done, with a check badge.
    const s = size * 0.46;
    const b = size * 0.17;
    const bx = cx + size * 0.27;
    return (
      svgOpen(size) +
      `<circle cx="${cx}" cy="${cx}" r="${cx - 0.5}" fill="${r.color}"/>` +
      glyph(HABIT_ICONS[r.icon].d, '#ffffff', cx - s / 2, cx - s / 2 - size * 0.02, s) +
      `<circle cx="${bx}" cy="${bx}" r="${b}" fill="#ffffff"/>` +
      glyph(UI_ICONS.check, r.color, bx - b * 0.75, bx - b * 0.75, b * 1.5) +
      `</svg>`
    );
  }
  if (r.done) {
    const s = size * 0.5;
    return svgOpen(size) + `<circle cx="${cx}" cy="${cx}" r="${cx - 0.5}" fill="${r.color}"/>` + glyph(UI_ICONS.check, '#ffffff', cx - s / 2, cx - s / 2, s) + `</svg>`;
  }
  const tone = r.slipped ? t.danger : r.color;
  const track =
    `<circle cx="${cx}" cy="${cx}" r="${ring}" fill="${tone}" fill-opacity="0.12" stroke="${tone}" stroke-opacity="${r.slipped ? 1 : 0.3}" stroke-width="${stroke}"/>` +
    (r.numeric ? arc(cx, ring, stroke, r.color, r.progress) : '');
  if (r.numeric && iconWithCount) {
    // No name next to it (e.g. a 1x1 widget): keep the habit's icon on top so you know which one it is.
    const ic = size * 0.22;
    const big = Math.round(size * (String(r.value).length > 3 ? 0.2 : 0.26));
    const small = Math.round(size * (String(r.target).length > 3 ? 0.12 : 0.15));
    return (
      svgOpen(size) +
      track +
      glyph(HABIT_ICONS[r.icon].d, r.color, cx - ic / 2, cx - size * 0.34, ic) +
      `<text x="${cx}" y="${cx + size * 0.1}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${big}" fill="${t.text}">${r.value}</text>` +
      `<text x="${cx}" y="${cx + size * 0.27}" text-anchor="middle" font-family="sans-serif" font-size="${small}" fill="${t.sub}">/${r.target}</text>` +
      `</svg>`
    );
  }
  if (r.numeric) {
    // Big number done, small goal under it. Shrinks for long numbers like 1500/2000.
    const big = Math.round(size * (String(r.value).length > 3 ? 0.24 : 0.32));
    const small = Math.round(size * (String(r.target).length > 3 ? 0.16 : 0.2));
    return (
      svgOpen(size) +
      track +
      `<text x="${cx}" y="${cx - size * 0.02}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${big}" fill="${t.text}">${r.value}</text>` +
      `<text x="${cx}" y="${cx + small + size * 0.02}" text-anchor="middle" font-family="sans-serif" font-size="${small}" fill="${t.sub}">/${r.target}</text>` +
      `</svg>`
    );
  }
  const s = size * 0.48;
  const d = r.avoid ? UI_ICONS['shield-fill'] : HABIT_ICONS[r.icon].d;
  return svgOpen(size) + track + glyph(d, tone, cx - s / 2, cx - s / 2, s) + `</svg>`;
}

/**
 * Compact: a row of round habit buttons in your own order (they never move when tapped).
 * Avoid habits go last: they open the app, since a slip is logged there.
 */
function TodayButtons({ rows, t, size, badge, labels }: { rows: TodayRow[]; t: Theme; size: Size; badge: number; labels: boolean }) {
  // Names need ~56dp; without them buttons can sit closer so more habits fit in one row.
  const slot = labels ? Math.max(badge + 8, 54) : badge + 8;
  const fit = Math.max(2, Math.floor(size.width / slot));
  const ordered = [...rows.filter((r) => !r.avoid), ...rows.filter((r) => r.avoid)];
  const overflow = ordered.length > fit ? ordered.length - (fit - 1) : 0;
  const shown = overflow ? ordered.slice(0, fit - 1) : ordered;
  return (
    <FlexWidget style={{ flex: 1, flexDirection: 'row', height: 'match_parent', alignItems: 'center', justifyContent: 'space-around' }}>
      {shown.map((r) => (
        <FlexWidget
          key={r.id}
          clickAction={r.avoid ? 'OPEN_APP' : 'TAP'}
          clickActionData={{ habitId: r.id }}
          style={{ width: slot, alignItems: 'center' }}>
          <Svg svg={buttonSvg(r, badge, t)} size={badge} />
          {labels ? (
            <TextWidget text={r.name} maxLines={1} truncate="END" style={{ fontSize: 11, color: t.text, marginTop: 3, textAlign: 'center' }} />
          ) : null}
        </FlexWidget>
      ))}
      {overflow ? (
        <FlexWidget clickAction="OPEN_APP" style={{ width: slot, alignItems: 'center' }}>
          <FlexWidget
            style={{ width: badge, height: badge, borderRadius: badge / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={`+${overflow}`} style={{ fontSize: 14, fontWeight: 'bold', color: t.sub }} />
          </FlexWidget>
          {labels ? <TextWidget text="More" maxLines={1} style={{ fontSize: 11, color: t.sub, marginTop: 3 }} /> : null}
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

const SUMMARY_W = 46;

export function TodayWidget({ data, dark, size }: { data: WidgetData; dark: boolean; size: Size }) {
  const t = theme(dark);
  const allDone = data.total > 0 && data.done === data.total;

  // One row tall: no header. The day's progress ring leads, then the buttons; names only if they fit.
  if (size.height < 100) {
    const labels = size.height >= 76;
    const badge = clamp(size.height - 16 - (labels ? 16 : 0), 30, 44);
    return (
      <FlexWidget style={{ ...root(t, 8), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
        {/* Plain text, not a ring, so the day's total can't be mistaken for a habit button. */}
        <FlexWidget clickAction="OPEN_APP" style={{ alignItems: 'center', width: SUMMARY_W }}>
          <TextWidget
            text={data.total ? `${data.done}/${data.total}` : '–'}
            style={{ fontSize: 18, fontWeight: 'bold', color: allDone ? t.success : t.text }}
          />
          <TextWidget text={allDone ? 'all done' : 'done'} style={{ fontSize: 11, color: allDone ? t.success : t.sub }} />
        </FlexWidget>
        {data.rows.length === 0 ? (
          <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, paddingLeft: 8 }}>
            <TextWidget text={data.message.title} maxLines={1} style={{ fontSize: 14, fontWeight: 'bold', color: t.text }} />
          </FlexWidget>
        ) : (
          <TodayButtons rows={data.rows} t={t} size={{ width: size.width - 20 - SUMMARY_W, height: size.height }} badge={badge} labels={labels} />
        )}
      </FlexWidget>
    );
  }

  const compact = size.height < 170;
  return (
    <FlexWidget style={root(t)}>
      <DayHeader data={data} t={t} title={data.dayName} />
      {data.rows.length === 0 ? (
        <Empty t={t} icon={UI_ICONS.spa} title={data.message.title} body={compact ? undefined : data.message.body} />
      ) : compact ? (
        <TodayButtons rows={data.rows} t={t} size={{ width: size.width - 24, height: size.height }} badge={clamp(Math.floor(size.height - 24 - 30 - 18), 36, 52)} labels />
      ) : (
        <TodayList rows={data.rows} t={t} />
      )}
    </FlexWidget>
  );
}

/* ---------- Single habit ---------- */

/** One line under a single-habit widget: what a tap does, or once done, the streak it protects. */
function habitHint(card: HabitCard, t: Theme): { text: string; icon?: string; color: HexColor } {
  if (card.avoid)
    return card.slipped
      ? { text: 'Slipped today', icon: UI_ICONS['shield-fill'], color: t.danger }
      : { text: `${card.streak} ${card.streak === 1 ? 'day' : 'days'} clean`, icon: UI_ICONS['shield-fill'], color: card.color };
  if (card.done)
    return card.streak > 0
      ? { text: `${card.streak} ${card.streakUnit}`, icon: UI_ICONS['streak-fill'], color: FLAME }
      : { text: 'Done for today', color: card.color };
  if (card.numeric) return { text: `Tap for +${card.step}${card.unit === 'min' ? ' min' : ''}`, color: t.sub };
  return { text: card.dueToday ? 'Tap when done' : 'Not due today', color: t.sub };
}

function Hint({ hint, t, center }: { hint: ReturnType<typeof habitHint>; t: Theme; center?: boolean }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', marginTop: 2 }}>
      {hint.icon ? <Svg svg={iconSvg(hint.icon, hint.color, 14)} size={14} mr={3} /> : null}
      <TextWidget text={hint.text} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: hint.icon ? 'bold' : 'normal', color: hint.icon ? t.sub : hint.color }} />
    </FlexWidget>
  );
}

export function HabitWidget({ card, widgetId, dark, size }: { card: HabitCard | null; widgetId: number; dark: boolean; size: Size }) {
  const t = theme(dark);
  const tiny = size.width < 100 || size.height < 100;
  if (!card) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: `${WIDGET_SCHEME}widget-setup?widgetId=${widgetId}` }}
        style={{ ...root(t, tiny ? 6 : 12), justifyContent: 'center', alignItems: 'center' }}>
        <FlexWidget style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
          <Svg svg={iconSvg(UI_ICONS.add, t.accent, 24)} size={24} />
        </FlexWidget>
        {size.height >= 90 || size.width >= 150 ? (
          <TextWidget text="Choose a habit" maxLines={1} style={{ fontSize: 13, fontWeight: 'bold', color: t.text, marginTop: 4 }} />
        ) : null}
      </FlexWidget>
    );
  }
  const state = { ...card, progress: card.avoid ? 0 : card.progress };
  const tap = { clickAction: card.tappable ? 'TAP' : 'OPEN_APP', clickActionData: { habitId: card.id } } as const;

  // Wide and short (2x1, 3x1): ring on the left, name and hint beside it.
  if (size.height < 100 && size.width >= 150) {
    const badge = clamp(size.height - 16, 32, Math.min(76, Math.round(size.width * 0.3)));
    return (
      <FlexWidget {...tap} style={{ ...root(t, 8), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
        <Svg svg={buttonSvg(state, badge, t)} size={badge} mr={10} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={card.name} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: 'bold', color: t.text }} />
          {size.height >= 56 ? <Hint hint={habitHint(card, t)} t={t} /> : null}
        </FlexWidget>
      </FlexWidget>
    );
  }

  // 1x1 (or narrow): just the ring, as big as fits. Count habits keep their icon inside.
  if (tiny) {
    const badge = Math.max(28, Math.min(size.width, size.height) - 12);
    return (
      <FlexWidget {...tap} style={{ ...root(t, 6), alignItems: 'center', justifyContent: 'center', borderRadius: Math.min(24, badge / 2 + 6) }}>
        <Svg svg={buttonSvg(state, badge, t, true)} size={badge} />
      </FlexWidget>
    );
  }

  const badge = clamp(Math.round(Math.min(size.width, size.height * 0.9) * 0.5), 44, 104);
  return (
    <FlexWidget {...tap} style={{ ...root(t, 10), alignItems: 'center', justifyContent: 'center' }}>
      <Svg svg={buttonSvg(state, badge, t)} size={badge} />
      <TextWidget text={card.name} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: 'bold', color: t.text, marginTop: 6, textAlign: 'center' }} />
      <Hint hint={habitHint(card, t)} t={t} center />
    </FlexWidget>
  );
}

/* ---------- Streaks ---------- */

type StreakLine = WidgetData['topStreaks'][number];

/** One streak: icon, optional name, flame (lit when done today) and the count. */
function StreakRow({ s, t, showName }: { s: StreakLine; t: Theme; showName: boolean }) {
  const lit = s.doneToday ? (s.avoid ? s.color : FLAME) : t.track;
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 4 }}>
      <Svg svg={iconSvg(HABIT_ICONS[s.icon].d, s.color, 16)} size={16} mr={8} />
      <FlexWidget style={{ flex: 1 }}>
        {showName ? (
          <TextWidget text={s.name} maxLines={1} truncate="END" style={{ fontSize: 13, color: s.doneToday ? t.text : t.sub }} />
        ) : null}
      </FlexWidget>
      <Svg svg={iconSvg(UI_ICONS[s.avoid ? 'shield-fill' : 'streak-fill'], lit, 14)} size={14} mr={2} />
      <TextWidget text={`${s.current}${s.unit}`} style={{ fontSize: 13, fontWeight: 'bold', color: t.text }} />
    </FlexWidget>
  );
}

export function StreaksWidget({ data, dark, size }: { data: WidgetData; dark: boolean; size: Size }) {
  const t = theme(dark);
  const allDone = data.total > 0 && data.done === data.total;
  const ringColor = allDone ? t.success : t.accent;
  const progress = data.total ? data.done / data.total : 0;
  const label = data.total ? `${data.done}/${data.total}` : '–';
  const empty = <TextWidget text="No streaks yet. Today is day one." maxLines={3} style={{ fontSize: 12, color: t.sub, marginTop: 4 }} />;

  // Narrow: stack a small ring + title above the list, so the list gets the full width.
  if (size.width < 280) {
    const ring = 40;
    const lines = clamp(Math.floor((size.height - 28 - ring - 4) / 22), 0, 4);
    // Under ~180dp there's no room for names next to the counts: icons carry the identity.
    const showName = size.width >= 180;
    // Long nudges don't fit beside the ring on the smallest sizes: say what's left instead.
    const title = showName ? data.message.title : allDone ? 'All done' : data.total ? `${data.total - data.done} to go` : 'Streaks';
    return (
      <FlexWidget clickAction="OPEN_APP" style={root(t, 14)}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
          <Svg svg={ringSvg(progress, ringColor, t, ring, label)} size={ring} mr={10} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={title} maxLines={2} truncate="END" style={{ fontSize: 13, fontWeight: 'bold', color: t.text }} />
          </FlexWidget>
        </FlexWidget>
        {lines === 0
          ? null
          : data.topStreaks.length === 0
            ? empty
            : data.topStreaks.slice(0, lines).map((s, i) => <StreakRow key={i} s={s} t={t} showName={showName} />)}
      </FlexWidget>
    );
  }

  const ring = clamp(Math.round(size.height - 32), 56, 92);
  const lines = clamp(Math.floor((size.height - 24 - 24) / 22), 1, 4);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...root(t, 14), flexDirection: 'row', alignItems: 'center' }}>
      <Svg svg={ringSvg(progress, ringColor, t, ring, label)} size={ring} mr={14} />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={data.message.title} maxLines={1} truncate="END" style={{ fontSize: 15, fontWeight: 'bold', color: t.text, marginBottom: 4 }} />
        {data.topStreaks.length === 0
          ? empty
          : data.topStreaks.slice(0, lines).map((s, i) => <StreakRow key={i} s={s} t={t} showName />)}
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
