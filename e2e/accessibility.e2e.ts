import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { editSave, expect, goToTab, openApp, test, waitForApp } from './fixtures';

// Screen-reader and keyboard checks for the closed alpha (#32), read from the
// browser's own accessibility tree: every control and image has a name, each
// screen has a heading and the page keeps its landmarks, and Tab only ever
// lands on visible controls.

/** Controls and images in the accessibility tree that have no name (what a screen reader would announce as just "button"). */
async function unnamed(page: Page) {
  const tree = await page.locator('body').ariaSnapshot();
  return tree
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^- (button|link|textbox|checkbox|radio|combobox|slider|spinbutton|switch|tab|menuitem|img)\b(?! ")/.test(line));
}

async function expectNamed(page: Page, screen: string, heading: string) {
  await expect(page.getByRole('heading', { name: heading }).first(), `${screen} has its heading`).toBeVisible();
  expect(await unnamed(page), `${screen}: everything has a name`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  // Content on every screen: a hatched dragon, a check-in with a note, a custom quest, an owned cosmetic.
  await editSave(page, `
    state.stage = 'Hatchling';
    state.symptomLogs = [{ date: new Date().toISOString(), energy: 3, mood: 4, notes: 'Calm day' }];
    state.quests.push({ id: 'custom_1', title: 'Stretch', description: '', type: 'custom', completed: false, points: 30, isDaily: true, isCustom: true, progress: 1, target: 3 });
    state.inventory = ['hat_wizard'];
  `);
  await page.reload();
  await waitForApp(page);
});

test('every screen and dialog names its controls and images, under the page landmarks', async ({ page }) => {
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('banner')).toHaveCount(1);

  await expectNamed(page, 'Home', 'Daily Quests');
  for (const [tab, heading] of [['Focus', 'Focus Quest'], ['Check-in', 'Daily Check-in'], ['Shop', 'Dragon Wardrobe']] as const) {
    await goToTab(page, tab);
    await expectNamed(page, tab, heading);
  }
  await page.getByRole('button', { name: 'Insights' }).click();
  await expectNamed(page, 'Insights', 'Health Insights');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await expectNamed(page, 'Milestones', 'Milestones');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expectNamed(page, 'Settings', 'Settings');
  const [download] = await Promise.all([page.waitForEvent('download'), settings.getByRole('button', { name: 'Export save' }).click()]);
  const file = await readFile((await download.path())!, 'utf8');
  await settings.getByLabel('Choose a save file to import').setInputFiles({ name: 'ember-save.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await expectNamed(page, 'Import confirmation', 'Replace your save?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await settings.getByRole('button', { name: 'Privacy and feedback…' }).click();
  await expectNamed(page, 'Privacy', 'Privacy and your data');
  await page.getByRole('button', { name: 'Close privacy' }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await expectNamed(page, 'Reset', 'Reset Progress?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();

  await goToTab(page, 'Home');
  await page.getByRole('button', { name: 'Options for Stretch' }).click();
  await expectNamed(page, 'Quest options', 'Stretch');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await expectNamed(page, 'Add Custom Quest', 'Add Custom Quest');
});

test('Tab reaches the header, every quest and the navigation, landing only on visible controls', async ({ page }) => {
  const reached = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      return {
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        visible: r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden',
      };
    });
    if (!focused) continue;
    expect(focused.visible, `Tab landed on an invisible element: "${focused.name}"`).toBe(true);
    reached.add(focused.name);
  }
  const all = [...reached].join(' | ');
  for (const name of ['Settings', 'Insights', 'Milestones', 'Morning Routine', 'Hydration Goal', 'Options for Stretch', 'Home', 'Focus', 'Check-in', 'Shop']) {
    expect(all, `Tab reaches ${name}`).toContain(name);
  }
});
