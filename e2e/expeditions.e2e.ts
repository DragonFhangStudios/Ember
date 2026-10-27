import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DISCOVERIES, EXPEDITIONS } from '../src/lib/expeditions';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { bondOf, editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Little Expeditions and the treasure shelf: optional adventures once Ember
// hatches. Every choice finds a keepsake; a revisit finds the alternate one;
// keepsakes are kept once, forever, through reloads, export/import, backups
// and tabs. Nothing is earned, and no wellness detail ever appears.

const saved = async (page: Page) => (await readSave(page))!.state;
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Little Expeditions' });
const progress = (s: Record<string, any>) => ({ energy: s.energy, bond: bondOf(s), scales: s.goldenScales, days: s.activity.days.length, daily: s.daily, stage: s.stage });

async function hatch(page: Page) {
  await editSave(page, "state.stage = 'Hatchling'; state.stageSeen = 'Hatchling';");
  await page.reload();
  await waitForApp(page);
}

async function openExpeditions(page: Page) {
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(sheet(page)).toBeVisible();
}

/** Plays one expedition choice; returns what the visit turned up. */
async function go(page: Page, location: string, choice: string) {
  await sheet(page).locator(`[data-location="${location}"]`).click();
  await sheet(page).locator(`[data-choice="${choice}"]`).click();
  const result = sheet(page).locator('[data-visit]');
  await expect(result).toBeVisible();
  const kind = (await result.getAttribute('data-visit'))!;
  const found = await result.getAttribute('data-found');
  await sheet(page).getByRole('button', { name: 'Explore somewhere else' }).click();
  return { kind, found };
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('the egg is told gently that expeditions open after hatching; nothing is saved', async ({ page }) => {
  const before = (await readSave(page))!;
  await openExpeditions(page);
  await expect(sheet(page)).toContainText('Little expeditions open once Ember hatches.');
  await expect(sheet(page).locator('[data-location]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  expect((await readSave(page))!.rev).toBe(before.rev);
});

test('every choice at every place keeps its keepsake once; revisits turn up an alternate story or find it again, never a duplicate, and nothing is earned', async ({ page }) => {
  test.slow();
  await hatch(page);
  const before = progress(await saved(page));
  await openExpeditions(page);
  for (const expedition of EXPEDITIONS) {
    for (const choice of expedition.choices) {
      const where = `${expedition.id}/${choice.id}`;
      expect(await go(page, expedition.id, choice.id), `${where} first`).toEqual({ kind: 'new', found: choice.find.discovery });
      // Revisits: an alternate story or the keepsake again (50/50); keep going until the alternate shows.
      const kinds = new Set<string>();
      for (let i = 0; i < 12 && !kinds.has('alternate'); i++) {
        const r = await go(page, expedition.id, choice.id);
        expect(r.kind === 'alternate' ? r.found : r, where).toEqual(r.kind === 'alternate' ? null : { kind: 'again', found: choice.find.discovery });
        kinds.add(r.kind);
      }
      expect(kinds.has('alternate'), `${where}: the alternate story turns up`).toBe(true);
    }
  }
  await expect.poll(async () => Object.keys((await saved(page)).discoveries).sort()).toEqual(Object.keys(DISCOVERIES).sort());
  expect(progress(await saved(page)), 'no Energy, Bond, Golden Scales, active day or daily counter changed').toEqual(before);

  // The shelf shows all six, once each, with where they were found.
  await sheet(page).getByRole('button', { name: "Ember's treasure shelf" }).click();
  const items = sheet(page).getByRole('list', { name: 'Keepsakes' }).getByRole('listitem');
  await expect(items).toHaveCount(6);
  await expect(sheet(page).locator('[data-keepsake="tiny-bell"]')).toContainText('Found at Starfall Clearing');
});

test('keepsakes survive a reload, export and import, and a backup restore', async ({ page }) => {
  test.slow();
  await hatch(page);
  await openExpeditions(page);
  await go(page, 'pebblebrook-crossing', 'peek');
  await go(page, 'starfall-clearing', 'wish');
  await page.keyboard.press('Escape');
  const kept = (await saved(page)).discoveries;
  expect(Object.keys(kept).sort()).toEqual(['river-pebble', 'star-fragment']);

  await page.reload();
  await waitForApp(page);
  expect((await saved(page)).discoveries).toEqual(kept);

  // Export, start over (the save is kept as a backup), import: all back.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const [download] = await Promise.all([page.waitForEvent('download'), settings.getByRole('button', { name: 'Export save' }).click()]);
  const file = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(file).state.discoveries).toEqual(kept);
  await settings.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).discoveries).toEqual({});
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.getByLabel('Choose a save file to import').setInputFiles({ name: 'ember-save.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await page.getByRole('button', { name: 'Replace My Save' }).click();
  await expect.poll(async () => (await saved(page)).discoveries).toEqual(kept);

  // Reset again, then restore the backup instead.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).discoveries).toEqual({});
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Restore a backup/ }).click();
  const backups = page.getByRole('dialog').filter({ has: page.locator('#save-dialog-title') });
  await backups.getByRole('button', { name: /Replaced by a reset/ }).first().click();
  await backups.getByRole('button', { name: 'Restore This Backup' }).click();
  await expect.poll(async () => (await saved(page)).discoveries).toEqual(kept);
});

test('two tabs stay in step, and the same keepsake found in both is kept once', async ({ page, context }) => {
  await hatch(page);
  const other = await context.newPage();
  await other.goto('/');
  await waitForApp(other);
  await openExpeditions(page);
  await openExpeditions(other);
  // Both pick the same path at the same time.
  await Promise.all([
    (async () => {
      await sheet(page).locator('[data-location="glowcap-grove"]').click();
      await sheet(page).locator('[data-choice="listen"]').click();
    })(),
    (async () => {
      await sheet(other).locator('[data-location="glowcap-grove"]').click();
      await sheet(other).locator('[data-choice="listen"]').click();
    })(),
  ]);
  await expect(sheet(page).locator('[data-visit]')).toBeVisible();
  await expect(sheet(other).locator('[data-visit]')).toBeVisible();
  await expect.poll(async () => (await saved(page)).discoveries).toEqual({ 'mushroom-crystal': expect.any(String) });

  // The other tab's shelf shows it too.
  await sheet(other).getByRole('button', { name: 'Explore somewhere else' }).click();
  await sheet(other).getByRole('button', { name: "Ember's treasure shelf" }).click();
  await expect(sheet(other).locator('[data-keepsake]')).toHaveCount(1);
  await other.close();
});

test('the keyboard can play a whole expedition; each step is announced by moving focus to its heading', async ({ page }) => {
  await hatch(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page)).toBeVisible();
  const grove = sheet(page).locator('[data-location="glowcap-grove"]');
  await grove.focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Glowcap Grove' })).toBeFocused();
  await sheet(page).locator('[data-choice="follow-glow"]').focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'A new keepsake!' })).toBeFocused();
  await expect(sheet(page)).toContainText('Shimmering feather');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore', exact: true }), 'focus returns to Explore').toBeFocused();
});

test('with reduced motion, a new keepsake only glows: no sparkles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hatch(page);
  await openExpeditions(page);
  await sheet(page).locator('[data-location="starfall-clearing"]').click();
  await sheet(page).locator('[data-choice="search-grass"]').click();
  await expect(sheet(page).locator('[data-celebration]')).toBeVisible();
  await expect(sheet(page).locator('[data-celebration] span')).toHaveCount(0);
});

test('expeditions never show wellness details, and make no network requests beyond the app itself', async ({ page }) => {
  const requests: string[] = [];
  page.context().on('request', r => requests.push(`${r.method()} ${r.url()}`));
  await hatch(page);
  await goToTab(page, 'Check-in');
  await page.getByLabel('Note (optional)').fill('SYNTHETIC-PRIVATE-NOTE-z81');
  await page.getByRole('button', { name: 'Log Check-in' }).click();
  await expect.poll(async () => (await saved(page)).symptomLogs[0]?.notes).toBe('SYNTHETIC-PRIVATE-NOTE-z81');
  await goToTab(page, 'Home');
  await openExpeditions(page);
  for (const expedition of EXPEDITIONS) {
    await sheet(page).locator(`[data-location="${expedition.id}"]`).click();
    await expect(sheet(page)).not.toContainText('SYNTHETIC-PRIVATE-NOTE-z81');
    await sheet(page).locator(`[data-choice="${expedition.choices[0].id}"]`).click();
    await expect(sheet(page).locator('[data-visit]')).toBeVisible();
    await expect(sheet(page)).not.toContainText('SYNTHETIC-PRIVATE-NOTE-z81');
    await expect(sheet(page).locator('a')).toHaveCount(0);
    await sheet(page).getByRole('button', { name: 'Explore somewhere else' }).click();
  }
  expect(requests.filter(r => !r.startsWith('GET ') || !/\/\/(localhost|127\.0\.0\.1)[:/]/.test(r))).toEqual([]);
  expect(requests.filter(r => r.includes('SYNTHETIC'))).toEqual([]);
});

for (const width of [360, 390]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`at ${width}px in ${scheme} mode, every expedition screen fits and is readable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.reload();
      await waitForApp(page);
      await hatch(page);
      const check = async (where: string) => {
        await settle(page);
        expect(await contrastProblems(page), `contrast: ${where}`).toEqual([]);
        if (scheme === 'dark') expect(await lightPanelsInDarkMode(page), `light panels: ${where}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `fits: ${where}`).toBe(true);
      };
      await openExpeditions(page);
      await check('map');
      await sheet(page).locator('[data-location="pebblebrook-crossing"]').click();
      await check('scene');
      await sheet(page).locator('[data-choice="hop-stones"]').click();
      await expect(sheet(page).locator('[data-visit]')).toBeVisible();
      await check('result');
      await sheet(page).getByRole('button', { name: 'Explore somewhere else' }).click();
      await sheet(page).getByRole('button', { name: "Ember's treasure shelf" }).click();
      await check('shelf');
    });
  }
}
