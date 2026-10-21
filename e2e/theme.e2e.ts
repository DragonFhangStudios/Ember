import type { Page } from '@playwright/test';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { LEGACY_KEY, editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Themes, contrast, and motion (#17): every screen and dialog meets WCAG AA
// contrast in light and dark mode (also on custom backgrounds), new players
// follow the system appearance, an explicit choice sticks, the theme is
// applied before the first paint, and reduced motion stops animations.

type Theme = 'System' | 'Light' | 'Dark';

const settingsButton = (page: Page) => page.locator('header').getByRole('button', { name: 'Settings' });

async function chooseTheme(page: Page, theme: Theme) {
  await settingsButton(page).click();
  // The choice shows once it's saved (one IndexedDB transaction later).
  const radio = page.getByRole('radio', { name: theme });
  await radio.click();
  await expect(radio).toBeChecked();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Checks once the screen has settled. Deliberately not a retrying check: that
 * would wait out short-lived problems, like a toast that shows for a few seconds.
 */
async function expectReadable(page: Page, screen: string) {
  await settle(page);
  expect(await contrastProblems(page), `contrast on ${screen}`).toEqual([]);
  expect(await lightPanelsInDarkMode(page), `light panels on ${screen}`).toEqual([]);
}

/** Reduced motion for color audits, so the page can settle (see settle). */
async function auditMode(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await waitForApp(page);
}

/** Visits every screen and dialog, checking each. */
async function expectAllScreensReadable(page: Page, theme: string) {
  await expectReadable(page, `${theme} Home`);
  for (const [tab, heading] of [['Focus', 'Focus Quest'], ['Check-in', 'Daily Check-in'], ['Shop', 'Dragon Wardrobe']] as const) {
    await goToTab(page, tab);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expectReadable(page, `${theme} ${tab}`);
  }
  await goToTab(page, 'Check-in');
  await page.getByRole('button', { name: 'Log Check-in' }).click();
  await expect(page.getByRole('heading', { name: 'Check-in Logged' })).toBeVisible();
  // Audit with the message toast showing too (it shows only for a few seconds).
  await expect(page.getByRole('status')).toContainText('Today counts');
  await expectReadable(page, `${theme} Check-in Logged`);
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Health Insights' })).toBeVisible();
  // The charts draw their axis labels a moment after the heading appears.
  await expect(page.locator('main svg text').first()).toBeVisible();
  await expectReadable(page, `${theme} Insights`);
  await page.getByRole('button', { name: 'Milestones' }).click();
  await expect(page.getByRole('heading', { name: 'Milestones' })).toBeVisible();
  await expectReadable(page, `${theme} Milestones`);

  await settingsButton(page).click();
  await expectReadable(page, `${theme} Settings`);
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await expect(page.getByRole('heading', { name: 'Reset Progress?' })).toBeVisible();
  await expectReadable(page, `${theme} Reset`);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();

  await goToTab(page, 'Home');
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await expect(page.getByRole('heading', { name: 'Add Custom Quest' })).toBeVisible();
  await expectReadable(page, `${theme} Add Custom Quest`);
  await page.getByRole('button', { name: 'New Type' }).click();
  await expect(page.getByRole('heading', { name: 'New Quest Type' })).toBeVisible();
  await expectReadable(page, `${theme} New Quest Type`);
}

test.describe('with a fresh save', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await waitForApp(page);
  });

  for (const theme of ['Light', 'Dark'] as const) {
    test(`every screen and dialog meets WCAG AA contrast in ${theme.toLowerCase()} mode`, async ({ page }) => {
      await auditMode(page);
      await chooseTheme(page, theme);
      if (theme === 'Dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      await expectAllScreensReadable(page, theme);
    });
  }

  test('text stays readable on any custom background color, in both themes', async ({ page }) => {
    // 6 colors × 2 themes × top and bottom of the page: about 16s alone, more under parallel load.
    test.slow();
    await auditMode(page);
    // Some of these are deliberately bad picks: black, white, saturated, and mid gray.
    for (const color of ['#000000', '#ffffff', '#ff0000', '#777777', '#1e3a8a', '#fef08a']) {
      await settingsButton(page).click();
      await page.getByLabel('Custom background color').fill(color);
      await expect.poll(async () => (await readSave(page))?.state.themeColor).toBe(color);
      await page.getByRole('button', { name: 'Close settings' }).click();
      for (const theme of ['Light', 'Dark'] as const) {
        await chooseTheme(page, theme);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expectReadable(page, `${theme} on ${color} (bottom)`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expectReadable(page, `${theme} on ${color} (top)`);
      }
    }
  });

  test('a new player follows the system appearance until choosing one, and the choice sticks', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await settingsButton(page).click();
    await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
    await page.getByRole('button', { name: 'Close settings' }).click();
    expect((await readSave(page))!.state.theme).toBe('system');

    // Following the system live.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // An explicit choice wins over the system, now and after a reload.
    await chooseTheme(page, 'Dark');
    await expect.poll(async () => (await readSave(page))?.state.theme).toBe('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await waitForApp(page);
    await expect(page.locator('html')).toHaveClass(/dark/);

    await chooseTheme(page, 'Light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('the chosen theme is applied before the app loads (no wrong-theme flash)', async ({ page, context }) => {
    await chooseTheme(page, 'Dark');
    // Load the page with the app's code blocked: only the inline startup
    // script in index.html runs, and it must already have applied dark mode.
    const blocked = await context.newPage();
    await blocked.emulateMedia({ colorScheme: 'light' });
    await blocked.route('**/src/main.tsx', route => route.abort());
    await blocked.goto('/');
    expect(await blocked.evaluate(() => document.documentElement.className)).toContain('dark');
    await blocked.close();
  });

  test('reduced motion stops looping and moving animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await waitForApp(page);
    const moving = () =>
      page.evaluate(async () => {
        const snapshot = () =>
          [...document.querySelectorAll('body *')].map(e => {
            const cs = getComputedStyle(e);
            return `${cs.transform}|${cs.opacity}|${cs.backgroundPosition}`;
          });
        const before = snapshot();
        await new Promise(r => setTimeout(r, 600));
        const after = snapshot();
        const looping = document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity && a.playState === 'running');
        return { changedElements: before.filter((s, i) => s !== after[i]).length, loopingAnimations: looping.length };
      });
    await expect.poll(moving, { timeout: 10_000 }).toEqual({ changedElements: 0, loopingAnimations: 0 });
  });
});

test('before any save loads, a new player gets the system theme and a returning player keeps light', async ({ browser, baseURL }) => {
  for (const [label, storage, expectDark] of [
    ['new player', {}, true],
    ['returning player from before themes', { ember_device_id: 'device-1' }, false],
  ] as const) {
    const context = await browser.newContext({ baseURL, colorScheme: 'dark' });
    await context.addInitScript(items => {
      for (const [key, value] of Object.entries(items)) localStorage.setItem(key, String(value));
    }, storage);
    const page = await context.newPage();
    await page.route('**/src/main.tsx', route => route.abort()); // only the startup script runs
    await page.goto('/');
    const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(dark, label).toBe(expectDark);
    await context.close();
  }
});

test('an existing player keeps their saved dark mode after the update', async ({ page }) => {
  // A version 7 save from before #17, with dark mode switched on.
  const v7 = { version: 7, dragonName: 'Ember', stage: 'Hatchling', energy: 70, goldenScales: 5, isDarkMode: true, lastLogin: new Date().toDateString() };
  await openApp(page, { legacy: JSON.stringify(v7) });
  await waitForApp(page);
  await expect(page.locator('html')).toHaveClass(/dark/);
  const saved = (await readSave(page))!.state;
  expect(saved.theme).toBe('dark');
  expect(saved).not.toHaveProperty('isDarkMode');
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY_KEY), 'backup untouched').toBe(JSON.stringify(v7));
});

test.describe('celebrations', () => {
  // One more active day hatches the egg (and unlocks "First Hatch"), and the
  // quest's Bond crosses into Bond level 2: three celebrations from one tap.
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await waitForApp(page);
    await editSave(page, "state.activity = { days: ['2026-01-01'], legacy: [] }; state.bond = { legacy: 19 };");
    await page.reload();
    await waitForApp(page);
  });

  test('hatching, a Bond level-up, and a milestone each get a short, gentle celebration', async ({ page }) => {
    // Times the celebrations in the page itself (the test runner's clock adds its own delays).
    await page.evaluate(() => {
      const w = window as unknown as { celebrationTimes: { first?: number; last?: number } };
      w.celebrationTimes = {};
      new MutationObserver(() => {
        const showing = document.querySelector('[data-celebration]') || document.body.textContent?.includes('Evolution Milestone!');
        if (showing) w.celebrationTimes.first ??= performance.now();
        // The moment they're all gone (later page changes don't move it).
        else if (w.celebrationTimes.first !== undefined) w.celebrationTimes.last ??= performance.now();
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await page.getByText('Morning Routine').click();
    await expect(page.getByRole('status')).toContainText('Milestone unlocked: First Hatch');
    await expect(page.getByText('Evolution Milestone!')).toBeVisible();
    await expect(page.locator('[data-celebration]'), 'dragon, Bond tile, and message').toHaveCount(3);
    await expect(page.getByRole('status').locator('[data-celebration]')).toHaveCount(1);
    await expect(page.locator('main [data-celebration] span').first(), 'sparkles').toBeAttached();

    await expect(page.locator('[data-celebration]')).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByText('Evolution Milestone!')).toHaveCount(0);
    // Designed: glows 1.2s, the evolution banner 1.5s, plus a 0.3s fade-out
    // (1.8s at most), with some slack for slow machines.
    const { first, last } = await page.evaluate(() => (window as unknown as { celebrationTimes: { first: number; last: number } }).celebrationTimes);
    expect(last - first, 'celebrations last about 1–1.5s').toBeGreaterThan(1000);
    expect(last - first, 'celebrations last about 1–1.5s').toBeLessThan(2300);

    const saved = (await readSave(page))!.state;
    expect(saved.stage).toBe('Hatchling');
    expect(saved.badges.find((b: any) => b.id === 'badge_hatch').unlockedAt).toBeTruthy();
  });

  test('with reduced motion, a celebration is a still glow with no sparkles', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByText('Morning Routine').click();
    await expect(page.locator('[data-celebration]')).toHaveCount(3);
    // Counted once while the celebrations show (a retrying check would just wait them out).
    expect(await page.locator('[data-celebration] span').count(), 'sparkles').toBe(0);
    await expect(page.locator('[data-celebration]')).toHaveCount(0, { timeout: 3000 });
  });
});
