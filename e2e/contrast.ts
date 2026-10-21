import type { Page } from '@playwright/test';

/**
 * Text on the current screen that fails WCAG 2.1 AA contrast: 4.5:1, or 3:1
 * for large text (24px+, or 18.66px+ bold). Covers HTML text, SVG chart text,
 * and input placeholders. Each color is blended over the backgrounds behind
 * it, including translucent layers and faded (opacity) ancestors. Disabled
 * controls are exempt, as in WCAG. With a dialog open, only the dialog is
 * checked (the page behind is dimmed and inert).
 */
export function contrastProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type RGBA = { r: number; g: number; b: number; a: number };
    const ctx = document.createElement('canvas').getContext('2d')!;
    // The canvas normalizes any CSS color (oklch, color-mix results, …) to sRGB.
    const parse = (css: string): RGBA | null => {
      if (!css || css === 'none' || css === 'transparent') return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const over = (top: RGBA, under: RGBA): RGBA => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const luminance = ({ r, g, b }: RGBA) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    /** The solid color behind an element: its own and its ancestors' backgrounds, composited. */
    const backgroundOf = (el: Element): RGBA => {
      const layers: RGBA[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a >= 1) break;
        }
      }
      return layers.reverse().reduce((under, top) => over(top, under), { r: 255, g: 255, b: 255, a: 1 } as RGBA);
    };
    const opacityOf = (el: Element) => {
      let o = 1;
      for (let e: Element | null = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
      return o;
    };
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && opacityOf(e) > 0.05;
    };

    const TEXT_INPUTS = ['text', 'number', 'search', 'email', 'tel', 'url', 'password'];
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    const scope = dialogs[dialogs.length - 1] ?? document.body;
    const problems: string[] = [];
    const check = (el: Element, color: string, text: string) => {
      if (el.closest(':disabled, [aria-disabled="true"]')) return;
      const fg = parse(color);
      if (!fg) return;
      const bg = backgroundOf(el);
      const seen = over({ ...fg, a: fg.a * opacityOf(el) }, bg);
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700);
      const value = ratio(seen, bg);
      if (value < (large ? 3 : 4.5)) problems.push(`"${text.trim().slice(0, 32)}" ${value.toFixed(2)}:1`);
    };

    for (const el of scope.querySelectorAll('*')) {
      if (!shown(el)) continue;
      if (el instanceof HTMLInputElement && !TEXT_INPUTS.includes(el.type)) continue;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.placeholder && !el.value) check(el, getComputedStyle(el, '::placeholder').color, `placeholder: ${el.placeholder}`);
        if (el.value) check(el, getComputedStyle(el).color, el.value);
        continue;
      }
      const text = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('');
      if (!text.trim()) continue;
      const svg = el instanceof SVGElement;
      check(el, svg ? getComputedStyle(el).fill : getComputedStyle(el).color, text);
    }
    return problems;
  });
}

/**
 * Large light panels on a dark screen (a card that missed the theme).
 * Controls are excluded: a light primary button is normal in dark mode.
 */
export function lightPanelsInDarkMode(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    if (!document.documentElement.classList.contains('dark')) return [];
    const ctx = document.createElement('canvas').getContext('2d')!;
    const lightness = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { value: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, alpha: a / 255 };
    };
    return [...document.querySelectorAll('body *')]
      .filter(e => {
        const r = e.getBoundingClientRect();
        if (r.width * r.height < 4000 || getComputedStyle(e).visibility === 'hidden') return false;
        if (e.matches('button, a, input, select, textarea, [role="button"]')) return false;
        const { value, alpha } = lightness(getComputedStyle(e).backgroundColor);
        return alpha > 0.5 && value > 0.6;
      })
      .map(e => `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 4).join('.')}`);
  });
}
