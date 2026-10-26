import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { bondOf, editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';

// Evolution reveals: reaching a new stage can't be missed for good. A calm
// invitation waits (on any tab, wherever the page is scrolled) until the
// player chooses to see the reveal; it survives reloads and more taps, and
// the reveal stays replayable from Milestones. Viewing never grants anything.

const saved = async (page: Page) => (await readSave(page))!.state;
const invite = (page: Page) => page.locator('[data-evolution-invite]');
const reveal = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('#evolution-title') });
const progress = (s: Record<string, any>) => ({ energy: s.energy, bond: bondOf(s), scales: s.goldenScales, days: s.activity.days.length });

/** One active day yesterday, so today's first quest is the second: Ember hatches. */
async function almostHatched(page: Page) {
  await editSave(page, `
    const d = new Date(); d.setDate(d.getDate() - 1);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    state.activity = { days: [iso], legacy: [] };
  `);
  await page.reload();
  await waitForApp(page);
}

/** Hatches Ember by tapping a quest far down the page, as in the alpha report. */
async function hatchFromQuestList(page: Page) {
  const quest = page.getByText('Hydration Goal');
  await quest.scrollIntoViewIfNeeded();
  // Four steps; finishing it is today's meaningful activity.
  for (let step = 1; step <= 4; step++) {
    const rev = (await readSave(page))!.rev;
    await quest.click();
    await expect.poll(async () => (await readSave(page))!.rev).toBeGreaterThan(rev);
  }
  await expect.poll(async () => (await saved(page)).stage).toBe('Hatchling');
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  await almostHatched(page);
});

test('hatching while scrolled down to Daily Quests is never missed: the invitation waits through more taps and a reload', async ({ page }) => {
  test.slow();
  await hatchFromQuestList(page);
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled, 'scrolled away from Ember').toBeGreaterThan(200);

  // Long after any message would have faded, the invitation is still on screen.
  await page.waitForTimeout(6500);
  await expect(invite(page)).toBeInViewport();
  await expect(invite(page)).toContainText('Something wonderful is happening with Ember!');
  expect(await page.evaluate(() => window.scrollY), 'the page was not moved').toBe(scrolled);
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(reveal(page), 'nothing opens by itself').toHaveCount(0);

  // More quest taps right away don't erase it.
  for (const title of ['Morning Routine', 'Daily Vitality']) await page.getByText(title).click();
  await expect(invite(page)).toBeInViewport();
  await page.reload();
  await waitForApp(page);
  await expect(invite(page), 'it survives a reload').toBeVisible();
  expect((await saved(page)).stageSeen).toBe('Egg');

  // The reveal: the stage, what Ember says, and an explicit way to finish.
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await expect(reveal(page)).toHaveAccessibleName('Ember is a Hatchling now!');
  await expect(reveal(page)).toContainText("crack… crack… Hi! I'm here! You're even nicer in person!");
  await expect(reveal(page).getByRole('img', { name: 'Ember as a Hatchling' })).toBeVisible();
  await page.waitForTimeout(6500);
  await expect(reveal(page), 'no timer closes it').toBeVisible();
  await reveal(page).getByRole('button', { name: 'Finish' }).click();
  await expect(reveal(page)).toHaveCount(0);
  await expect(invite(page)).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).stageSeen).toBe('Hatchling');
  await page.reload();
  await waitForApp(page);
  await expect(invite(page), 'seen stays seen').toHaveCount(0);
});

test('"Later" puts it off without losing it: Milestones offers it, and the keyboard can open and close it', async ({ page }) => {
  await hatchFromQuestList(page);
  await invite(page).getByRole('button', { name: 'Later' }).click();
  await expect(invite(page)).toHaveCount(0);
  expect((await saved(page)).stageSeen, 'putting it off saves nothing').toBe('Egg');

  const milestones = page.getByRole('button', { name: 'Milestones (something new)' });
  await milestones.click();
  const waiting = page.getByRole('button', { name: 'See what happened: Ember became a Hatchling' });
  await waiting.focus();
  await page.keyboard.press('Enter');
  await expect(reveal(page)).toBeVisible();
  await expect(reveal(page).getByRole('button', { name: 'Finish' }), 'focus starts on Finish').toBeFocused();
  await page.keyboard.press('Escape');
  await expect(reveal(page)).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).stageSeen, 'closing it counts as seen').toBe('Hatchling');
  await expect(page.getByRole('button', { name: 'Milestones', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Watch again: Hatchling' }), 'focus returns to the journey').toBeFocused();
});

test('replaying a reveal from Milestones grants nothing and changes nothing', async ({ page }) => {
  await hatchFromQuestList(page);
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await reveal(page).getByRole('button', { name: 'Finish' }).click();
  await expect.poll(async () => (await saved(page)).stageSeen).toBe('Hatchling');
  const record = (await readSave(page))!;

  await page.getByRole('button', { name: 'Milestones', exact: true }).click();
  const journey = page.getByRole('region', { name: "Ember's journey" });
  await expect(journey.getByRole('listitem')).toHaveCount(2);
  await expect(journey.locator('[data-journey-stage="Hatchling"]')).toContainText('Reached on');
  for (const stage of ['Hatchling', 'Egg', 'Hatchling']) {
    await page.getByRole('button', { name: `Watch again: ${stage}` }).click();
    await expect(reveal(page).locator('[data-replay]')).toBeVisible();
    await reveal(page).getByRole('button', { name: 'Close' }).click();
    await expect(reveal(page)).toHaveCount(0);
  }
  await expect(reveal(page)).toHaveCount(0);
  const after = (await readSave(page))!;
  expect(after.rev, 'nothing was saved').toBe(record.rev);
  expect(progress(after.state)).toEqual(progress(record.state));
});

test('two tabs agree: seeing it in one clears it in the other, and finishing in both changes nothing more', async ({ page, context }) => {
  const other = await context.newPage();
  await other.goto('/');
  await waitForApp(other);
  await hatchFromQuestList(page);
  await expect(invite(other), 'the other tab is invited too').toBeVisible();
  const before = progress(await saved(page));

  // Both open it; both finish, rapidly (a double tap in one of them).
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await invite(other).getByRole('button', { name: 'See what happened' }).click();
  await reveal(page).getByRole('button', { name: 'Finish' }).dblclick();
  await reveal(other).getByRole('button', { name: 'Finish' }).click();
  await expect.poll(async () => (await saved(page)).stageSeen).toBe('Hatchling');
  for (const tab of [page, other]) await expect(invite(tab)).toHaveCount(0);
  expect(progress(await saved(page)), 'no rewards from seeing it').toEqual(before);
});

test('an advanced save from before reveals announces nothing, and a restored backup keeps what it had seen', async ({ page }) => {
  await editSave(page, `
    state.stage = 'Drake';
    state.activity = { days: ['2026-10-01'], legacy: [{ floor: 24, before: '2026-10-01' }] };
    delete state.stageSeen; delete state.stageReachedOn;
  `);
  await page.reload();
  await waitForApp(page);
  await expect(invite(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Milestones', exact: true }).click();
  for (const stage of ['Drake', 'Fledgling', 'Hatchling', 'Egg']) await expect(page.getByRole('button', { name: `Watch again: ${stage}` })).toBeVisible();
  await expect(page.getByRole('region', { name: "Ember's journey" }), 'no invented dates').not.toContainText('Reached on');

  // Start over (the Drake is kept as a backup), then restore it.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');
  await expect(invite(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Restore a backup/ }).click();
  const backups = page.getByRole('dialog').filter({ has: page.locator('#save-dialog-title') });
  await backups.getByRole('button', { name: /Replaced by a reset/ }).click();
  await backups.getByRole('button', { name: 'Restore This Backup' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Drake');
  await expect(invite(page)).toHaveCount(0);
});

test('a save exported while a reveal was waiting still offers it after importing, with its real date', async ({ page }) => {
  await hatchFromQuestList(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Export save' }).click()]);
  const file = await readFile((await download.path())!, 'utf8');
  await sheet.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await sheet.getByLabel('Choose a save file to import').setInputFiles({ name: 'ember-save.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await page.getByRole('button', { name: 'Replace My Save' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Hatchling');
  await expect(invite(page)).toBeVisible();
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await expect(reveal(page)).toContainText('Reached on');
});

test('with reduced motion, the reveal only glows: nothing moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hatchFromQuestList(page);
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await expect(reveal(page)).toBeVisible();
  await expect(reveal(page).locator('[data-celebration]')).toBeVisible();
  await expect(reveal(page).locator('[data-celebration] span'), 'no sparkles').toHaveCount(0);
});

for (const width of [360, 390]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`at ${width}px in ${scheme} mode, the invitation and the reveal fit and are readable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.reload();
      await waitForApp(page);
      await hatchFromQuestList(page);
      // The avatar's existing 1.5 s evolution banner has faded by now.
      await expect(page.getByText('Evolution Milestone!')).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      await expect(invite(page)).toBeInViewport({ ratio: 1 });
      expect(await fits(), 'no sideways scrolling').toBe(true);
      await settle(page);
      expect(await contrastProblems(page)).toEqual([]);

      await invite(page).getByRole('button', { name: 'See what happened' }).click();
      await expect(reveal(page).getByRole('button', { name: 'Finish' })).toBeVisible();
      await settle(page);
      expect(await contrastProblems(page)).toEqual([]);
      if (scheme === 'dark') expect(await lightPanelsInDarkMode(page)).toEqual([]);
      expect(await fits()).toBe(true);
    });
  }
}
