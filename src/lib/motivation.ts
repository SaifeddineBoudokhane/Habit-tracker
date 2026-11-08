import type { UI_ICONS } from '@/constants/icons';

import { getEntry, isComplete, isDueOn, isSlip } from './schedule';
import { computeStats } from './streaks';
import type { EntryIndex, Habit } from './types';

export interface StreakInfo {
  habit: Habit;
  current: number;
  best: number;
  unit: 'days' | 'weeks';
  doneToday: boolean;
  dueToday: boolean;
}

export function streakInfo(habits: Habit[], index: EntryIndex, today: string): StreakInfo[] {
  return habits
    .filter((h) => !h.archived && h.startDate <= today)
    .map((h) => {
      const s = computeStats(h, index, today);
      const e = getEntry(index, h.id, today);
      return {
        habit: h,
        current: s.current,
        best: s.best,
        unit: s.unit,
        doneToday: h.kind === 'avoid' ? !isSlip(h, e) : isComplete(h, e) || !!e?.skipped,
        dueToday: isDueOn(h, index, today),
      };
    });
}

const MILESTONES = [7, 14, 21, 30, 50, 100, 150, 200, 365, 500, 1000];

function unitLabel(n: number, unit: 'days' | 'weeks') {
  const u = unit === 'weeks' ? 'week' : 'day';
  return `${n}-${u}`;
}

export interface Encouragement {
  icon: keyof typeof UI_ICONS;
  title: string;
  body: string;
}

/** One short, specific message about where you stand today. */
export function encouragement(habits: Habit[], index: EntryIndex, today: string): Encouragement {
  const info = streakInfo(habits, index, today);
  if (info.length === 0) return { icon: 'spa', title: 'Start a habit', body: 'Add your first habit to begin a streak.' };

  const due = info.filter((i) => i.dueToday && i.habit.kind !== 'avoid');
  const pending = due.filter((i) => !i.doneToday);
  const atRisk = pending.filter((i) => i.current > 0).sort((a, b) => b.current - a.current);
  const milestone = info
    .filter((i) => i.doneToday && MILESTONES.includes(i.current))
    .sort((a, b) => b.current - a.current)[0];

  if (milestone) {
    return {
      icon: 'trophy',
      title: `${unitLabel(milestone.current, milestone.unit)} streak!`,
      body: `${milestone.habit.name}: that's a milestone. Keep going.`,
    };
  }
  if (due.length > 0 && pending.length === 0) {
    const best = [...info].sort((a, b) => b.current - a.current)[0];
    return {
      icon: 'celebration',
      title: 'All done today',
      body: best && best.current > 1 ? `Streaks are safe. Longest: ${best.habit.name}, ${best.current} ${best.unit}.` : 'Every habit is checked off. Nice work.',
    };
  }
  if (atRisk.length > 0) {
    const top = atRisk[0];
    const more = atRisk.length > 1 ? ` (+${atRisk.length - 1} more)` : '';
    return {
      icon: 'streak',
      title: `Keep your ${unitLabel(top.current, top.unit)} streak`,
      body: `${top.habit.name} isn't done yet today${more}.`,
    };
  }
  if (pending.length > 0) {
    const doneCount = due.length - pending.length;
    return {
      icon: 'trending_up',
      title: doneCount ? `${doneCount} of ${due.length} done` : 'Fresh start',
      body: doneCount ? `${pending.length} to go. You've got this.` : 'One check-off starts a new streak.',
    };
  }
  const clean = info.filter((i) => i.habit.kind === 'avoid').sort((a, b) => b.current - a.current)[0];
  if (clean && clean.current > 0) {
    return { icon: 'shield', title: `${clean.current} days clean`, body: `${clean.habit.name}. Stay strong.` };
  }
  return { icon: 'spa', title: 'Nothing due today', body: 'Enjoy the rest day.' };
}
