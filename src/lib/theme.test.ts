import { describe, expect, it } from 'vitest';
import { PAGE_TEXT, contrastRatio, readableBackground, resolveDark, themePreferenceOf } from './theme';
import { createInitialState, migrateState } from './progression';

const NOW = new Date(2026, 9, 21, 9, 0);

describe('theme preference', () => {
  it('new players follow the system', () => {
    expect(createInitialState(NOW).theme).toBe('system');
  });

  it('a saved preference always wins', () => {
    for (const theme of ['system', 'light', 'dark'] as const) {
      expect(themePreferenceOf({ theme, isDarkMode: theme !== 'dark' })).toBe(theme);
    }
  });

  it('saves from before preferences keep what the player saw', () => {
    expect(themePreferenceOf({ isDarkMode: true })).toBe('dark');
    expect(themePreferenceOf({ isDarkMode: false })).toBe('light');
    expect(themePreferenceOf({})).toBe('light'); // never switched: they were seeing light mode
    expect(themePreferenceOf({ theme: 'purple' })).toBe('light');
  });

  it('migrating a v7 save converts isDarkMode and drops it', () => {
    for (const [isDarkMode, theme] of [[true, 'dark'], [false, 'light'], [undefined, 'light']] as const) {
      const migrated = migrateState({ version: 7, energy: 80, isDarkMode, themeColor: '#EBF5FF' }, NOW);
      expect(migrated.theme).toBe(theme);
      expect(migrated).not.toHaveProperty('isDarkMode');
      expect(migrated.themeColor).toBe('#EBF5FF');
      expect(migrated.energy).toBe(80);
    }
  });

  it('migration is idempotent, and a stale tab writing an older version keeps the choice', () => {
    const once = migrateState({ version: 7, isDarkMode: true }, NOW);
    expect(migrateState(once, NOW).theme).toBe('dark');
    // An old tab still open during the update writes version 7 but keeps unknown fields.
    expect(migrateState({ ...once, version: 7, theme: 'system' }, NOW).theme).toBe('system');
  });

  it('resolves system, light, and dark', () => {
    expect(resolveDark('system', true)).toBe(true);
    expect(resolveDark('system', false)).toBe(false);
    expect(resolveDark('light', true)).toBe(false);
    expect(resolveDark('dark', false)).toBe(true);
  });
});

describe('readable custom backgrounds', () => {
  const PRESETS = ['#F5F5F0', '#EBF5FF', '#F0FFF4', '#F5F3FF', '#FFF5F5', '#FFF7ED'];
  const TRICKY = ['#000000', '#FFFFFF', '#FF0000', '#777777', '#1E3A8A', '#FEF08A', '#00FF00', '#8E9299', '#123456'];

  it('every page text color meets WCAG AA on any chosen color, in both themes', () => {
    for (const color of [...PRESETS, ...TRICKY]) {
      for (const dark of [false, true]) {
        const bg = readableBackground(color, dark)!;
        for (const text of dark ? PAGE_TEXT.dark : PAGE_TEXT.light) {
          expect(contrastRatio(text, bg), `${text} on ${bg} (from ${color}, ${dark ? 'dark' : 'light'})`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('light presets are shown exactly as chosen in light mode', () => {
    for (const color of PRESETS) expect(readableBackground(color, false)).toBe(color);
  });

  it('dark mode shows a dark tint of the chosen color', () => {
    const bg = readableBackground('#EBF5FF', true)!;
    expect(contrastRatio(bg, '#121212')).toBeLessThan(1.6);
    expect(bg).not.toBe('#121212');
  });

  it('no or invalid colors use the theme default', () => {
    expect(readableBackground(undefined, false)).toBeNull();
    expect(readableBackground('red', true)).toBeNull();
    expect(readableBackground('#12345', false)).toBeNull();
  });
});
