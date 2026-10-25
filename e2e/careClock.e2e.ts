import type { Page } from '@playwright/test';
import { bondOf, expect, openApp, readSave, test, waitForApp } from './fixtures';

// Once-a-day care (#42): cleaning/petting and incubating pay once per day, and
// moving the device clock back across midnight (or ahead and back) never pays
// again. A real new day still does. Every clock change reloads the app.

const saved = async (page: Page) => (await readSave(page))!.state;

/** A local time `days` after today (always later than the save the test opened with). */
const later = (days: number, h: number, m = 0) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, h, m);
};

async function at(page: Page, time: Date) {
  await page.clock.setFixedTime(time);
  await page.reload();
  await waitForApp(page);
}

/** Tries a care button; returns the Bond it paid (0 when refused or not offered). */
async function care(page: Page, name: 'Clean & Hydrate' | 'Incubate') {
  const before = await saved(page);
  const button = page.getByRole('button', { name, exact: true });
  if (await button.isDisabled()) return 0;
  const rev = (await readSave(page))!.rev;
  await button.click();
  // Either the care was saved, or Ember says it's already done today.
  await expect
    .poll(async () => (await readSave(page))!.rev > rev || /already/i.test((await page.getByRole('status').textContent()) ?? ''))
    .toBe(true);
  return Math.round((bondOf(await saved(page)) - bondOf(before)) * 1000) / 1000;
}

/** Both care actions, as [clean, incubate] Bond paid. */
const careBoth = async (page: Page) => [await care(page, 'Clean & Hydrate'), await care(page, 'Incubate')];

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('cleaning and incubating pay once a day, and the clock moving back and forward never pays again', async ({ page }) => {
  test.slow(); // several reloads
  await at(page, later(2, 0, 30));
  expect(await careBoth(page), 'first care of the day').toEqual([2, 5]);
  expect(await careBoth(page), 'again, same day').toEqual([0, 0]);

  await at(page, later(1, 23, 30)); // the evening before
  expect(await careBoth(page), 'clock moved back').toEqual([0, 0]);
  await at(page, later(2, 1, 0));
  expect(await careBoth(page), 'clock forward again').toEqual([0, 0]);

  await at(page, later(3, 9, 0));
  expect(await careBoth(page), 'a real new day').toEqual([2, 5]);
});

test('a new day without care, the clock back to the last care day, then forward again: one reward for that day', async ({ page }) => {
  test.slow();
  await at(page, later(2, 9, 0)); // day A: cared for
  expect(await careBoth(page)).toEqual([2, 5]);
  await at(page, later(3, 8, 0)); // day B begins, no care yet
  const start = bondOf(await saved(page));

  await at(page, later(2, 20, 0)); // clock back to day A
  const back = await careBoth(page);
  await at(page, later(3, 9, 0)); // clock returns to day B
  const returned = await careBoth(page);
  await page.reload();
  await waitForApp(page);
  const reloaded = await careBoth(page);

  const total = [back, returned, reloaded].flat().reduce((a, b) => a + b, 0);
  expect(total, `one clean and one incubation for day B (back ${back}, returned ${returned}, reloaded ${reloaded})`).toBe(7);
  expect(Math.round((bondOf(await saved(page)) - start) * 1000) / 1000).toBe(7);

  await at(page, later(4, 9, 0)); // day C
  expect(await careBoth(page), "day C's own care").toEqual([2, 5]);
});

test('a save cared for in New York and reopened in Los Angeles pays no second time, and a real new day still pays', async ({ browser }, testInfo) => {
  test.slow();
  const { baseURL, viewport } = testInfo.project.use;
  // Oct 25 00:30 in New York is Oct 24 21:30 in Los Angeles; the save's day is Oct 25.
  const ny = await browser.newContext({ baseURL, viewport, timezoneId: 'America/New_York' });
  const nyPage = await ny.newPage();
  await nyPage.clock.setFixedTime(new Date('2026-10-25T04:30:00Z'));
  await nyPage.goto('/');
  await waitForApp(nyPage);
  expect(await careBoth(nyPage), 'cared for in New York').toEqual([2, 5]);
  const saveFile = await ny.storageState({ indexedDB: true });
  await ny.close();

  const la = await browser.newContext({ baseURL, viewport, timezoneId: 'America/Los_Angeles', storageState: saveFile });
  const page = await la.newPage();
  await page.clock.setFixedTime(new Date('2026-10-25T04:45:00Z'));
  await page.goto('/');
  await waitForApp(page);
  expect((await saved(page)).lastLogin, 'the same save, still on Oct 25').toMatch(/Oct 25 2026/);
  await expect(page.getByRole('button', { name: 'Clean & Hydrate', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Incubate', exact: true })).toBeDisabled();
  expect(await careBoth(page), 'reopened in Los Angeles').toEqual([0, 0]);

  await at(page, new Date('2026-10-26T16:00:00Z')); // Oct 26 09:00 in Los Angeles
  expect(await careBoth(page), 'a real new day').toEqual([2, 5]);
  await la.close();
});
