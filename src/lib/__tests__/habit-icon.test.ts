import { HABIT_ICONS } from '@/constants/icons';
import { DEFAULT_HABIT_ICON, guessIcon, habitIcon, isHabitIcon, svgPath } from '@/lib/habit-icon';

describe('habitIcon', () => {
  it('uses the icon the habit picked', () => {
    expect(habitIcon({ name: 'Water', icon: 'menu_book', emoji: '💧' })).toBe('menu_book');
  });

  it('maps the emoji of habits made before icons existed', () => {
    expect(habitIcon({ name: 'Morning thing', emoji: '💧' })).toBe('water_drop');
    expect(habitIcon({ name: 'x', emoji: '✍️' })).toBe('edit_note');
    expect(habitIcon({ name: 'x', emoji: '✍' })).toBe('edit_note');
  });

  it('prefers the name over the old default ✅ emoji', () => {
    expect(habitIcon({ name: 'Read 20 pages', emoji: '✅' })).toBe('menu_book');
  });

  it('falls back to a check for unknown habits and ignores unknown icon keys', () => {
    expect(habitIcon({ name: 'Zzyzx', emoji: '🦄' })).toBe(DEFAULT_HABIT_ICON);
    expect(habitIcon({ name: 'Zzyzx', icon: 'not-an-icon', emoji: '' })).toBe(DEFAULT_HABIT_ICON);
  });
});

describe('guessIcon', () => {
  it.each([
    ['Drink water', 'water_drop'],
    ['No smoking', 'smoke_free'],
    ['Gym', 'fitness_center'],
    ['Morning run', 'directions_run'],
    ['Meditate', 'self_improvement'],
    ['Floss teeth', 'dentistry'],
    ['Study Spanish', 'auto_stories'],
  ])('%s -> %s', (name, icon) => {
    expect(guessIcon(name)).toBe(icon);
  });

  it('returns null when nothing matches', () => {
    expect(guessIcon('Zzyzx')).toBeNull();
  });

  it('only ever suggests icons that exist', () => {
    for (const n of ['water', 'read', 'run', 'walk', 'gym', 'sleep', 'pray', 'code', 'budget', 'garden', 'focus']) {
      const g = guessIcon(n);
      expect(g === null || isHabitIcon(g)).toBe(true);
    }
  });
});

describe('svgPath', () => {
  it('builds a standalone svg for widgets', () => {
    const svg = svgPath(HABIT_ICONS.water_drop.d, '#123456', 24);
    expect(svg).toContain('viewBox="0 -960 960 960"');
    expect(svg).toContain('fill="#123456"');
  });
});
