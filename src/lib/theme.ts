// Light and dark mode: the player's preference, how it resolves, and keeping
// custom background colors readable in either theme.

/** 'system' follows the device's appearance setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/**
 * localStorage key caching the preference, so the startup script in
 * index.html can apply the theme before the first paint. The save in
 * IndexedDB stays the source of truth.
 */
export const THEME_HINT_KEY = 'ember_theme';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  PREFERENCES.includes(value as ThemePreference);

/**
 * The preference stored in a save. A valid saved preference always wins.
 * Saves from before preferences existed keep exactly what the player saw:
 * dark if they had switched dark mode on, light otherwise. Only brand-new
 * players (createInitialState) start on 'system'.
 */
export function themePreferenceOf(saved: { theme?: unknown; isDarkMode?: unknown }): ThemePreference {
  if (isThemePreference(saved.theme)) return saved.theme;
  return saved.isDarkMode === true ? 'dark' : 'light';
}

export const resolveDark = (preference: ThemePreference, systemDark: boolean) =>
  preference === 'dark' || (preference === 'system' && systemDark);

// --- Readable custom backgrounds -------------------------------------------

type RGB = [number, number, number];

/** Text colors that sit directly on the page background in each theme (see index.css). */
export const PAGE_TEXT = {
  light: ['#1A1A1A', '#62666E', '#B93A00', '#7A5E00'],
  dark: ['#F5F5F0', '#A3A7AE', '#FF7A45', '#E0BE52'],
};
const DARK_BASE: RGB = [0x12, 0x12, 0x12];
const WHITE: RGB = [255, 255, 255];
/** How much of the player's color shows through in dark mode. */
const DARK_TINT = 0.15;
const AA = 4.5;

const parseHex = (color: string): RGB | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: RGB) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a: RGB, b: RGB, amountOfB: number): RGB => a.map((v, i) => v + (b[i] - v) * amountOfB) as RGB;

const luminance = (rgb: RGB) => {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colors. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(parseHex(a)!);
  const y = luminance(parseHex(b)!);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const readable = (bg: RGB, dark: boolean) =>
  (dark ? PAGE_TEXT.dark : PAGE_TEXT.light).every(text => contrastRatio(text, toHex(bg)) >= AA);

/**
 * The page background to show for the player's chosen color. The saved color
 * is never changed; only how it's displayed adapts so every page text color
 * keeps WCAG AA contrast. In light mode the color is used as is when it's
 * light enough, otherwise lightened just enough. In dark mode it becomes a
 * subtle tint of the dark background, darkened further if needed. Returns
 * null for no (or an invalid) color, meaning the theme's default background.
 */
export function readableBackground(color: string | undefined, dark: boolean): string | null {
  const rgb = color ? parseHex(color) : null;
  if (!rgb) return null;
  let bg = dark ? mix(DARK_BASE, rgb, DARK_TINT) : rgb;
  const toward = dark ? DARK_BASE : WHITE;
  for (let step = 0; step < 20 && !readable(bg, dark); step++) bg = mix(bg, toward, 0.1);
  if (!readable(bg, dark)) bg = toward;
  return toHex(bg);
}
