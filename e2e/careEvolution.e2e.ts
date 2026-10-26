import type { Page } from '@playwright/test';
import { bondOf, expect, openApp, readSave, test, waitForApp } from './fixtures';

// Daily care flags (#42) and evolution reveals (#45) together, across days,
// a backward clock, reloads, a second tab, a reset and a backup restore.
// Care itself doesn't count as an active day (only quests, focus and
// check-ins do), so each day pairs care with one quest.

const saved = async (page: Page) => (await readSave(page))!.state;
const invite = (page: Page) => page.locator('[data-evolution-invite]');
const reveal = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('#evolution-title') });

/** A local time `days` after today (always later than the save the test opened with). */
const later = (days: number, h: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, h);
};

async function at(page: Page, time: Date) {
  await page.clock.setFixedTime(time);
  await page.reload();
  await waitForApp(page);
}

/** Tries a care button; returns the Bond it paid (0 when it's not offered). */
async function care(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if (await button.isDisabled()) return 0;
  const before = await readSave(page);
  await button.click();
  await expect.poll(async () => (await readSave(page))!.rev).toBeGreaterThan(before!.rev);
  return Math.round((bondOf(await saved(page)) - bondOf(before!.state)) * 1000) / 1000;
}

async function questDone(page: Page, title: string) {
  const rev = (await readSave(page))!.rev;
  await page.getByText(title).click();
  await expect.poll(async () => (await readSave(page))!.rev).toBeGreaterThan(rev);
}

test('care on two days, a backward clock in between, then hatching: the reveal survives being set aside, a reload, a second tab and a backup restore, finishes once, and replays for free', async ({ page, context }) => {
  test.slow();
  await openApp(page);
  await waitForApp(page);

  // Day A: both care actions pay, and one quest makes it an active day.
  await at(page, later(2, 9));
  expect([await care(page, 'Clean & Hydrate'), await care(page, 'Incubate')]).toEqual([2, 5]);
  await questDone(page, 'Morning Routine');
  expect((await saved(page)).stage).toBe('Egg');

  // The clock moves back to the evening before: nothing pays, nothing evolves.
  await at(page, later(1, 20));
  expect([await care(page, 'Clean & Hydrate'), await care(page, 'Incubate')]).toEqual([0, 0]);

  // Day B: care pays again; the day's quest is the second active day, and Ember hatches.
  await at(page, later(3, 9));
  expect([await care(page, 'Clean & Hydrate'), await care(page, 'Incubate')]).toEqual([2, 5]);
  await questDone(page, 'Morning Routine');
  await expect.poll(async () => (await saved(page)).stage).toBe('Hatchling');
  await expect(invite(page)).toBeVisible();
  // Today's care was already given to the egg, so petting the new hatchling waits for tomorrow.
  await expect(page.getByRole('button', { name: 'Pet Ember', exact: true })).toBeDisabled();
  const progress = async () => ({ bond: bondOf(await saved(page)), energy: (await saved(page)).energy });
  const afterHatching = await progress();

  // Set aside with Escape: still waiting, and back after a reload.
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await expect(reveal(page)).toHaveAccessibleName('Ember is a Hatchling now!');
  await page.keyboard.press('Escape');
  await expect(reveal(page)).toHaveCount(0);
  await page.reload();
  await waitForApp(page);
  await expect(invite(page)).toBeVisible();
  expect((await saved(page)).stageSeen).toBe('Egg');

  // A second tab is invited too.
  const other = await context.newPage();
  await other.goto('/');
  await waitForApp(other);
  await expect(invite(other)).toBeVisible();

  // Start over, then restore the backup: the waiting reveal comes back with it.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');
  await expect(invite(other), 'the reset reaches the other tab').toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Restore a backup/ }).click();
  const backups = page.getByRole('dialog').filter({ has: page.locator('#save-dialog-title') });
  await backups.getByRole('button', { name: /Replaced by a reset/ }).click();
  await backups.getByRole('button', { name: 'Restore This Backup' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Hatchling');
  await expect(invite(page)).toBeVisible();
  await expect(invite(other)).toBeVisible();
  expect(await progress(), 'the restore brings back exactly what was earned').toEqual(afterHatching);

  // Finish in one tab: the other tab's invitation goes away.
  await invite(page).getByRole('button', { name: 'See what happened' }).click();
  await reveal(page).getByRole('button', { name: 'Finish' }).click();
  await expect.poll(async () => (await saved(page)).stageSeen).toBe('Hatchling');
  await expect(invite(other)).toHaveCount(0);

  // Replaying it changes nothing at all.
  const record = (await readSave(page))!;
  await page.getByRole('button', { name: 'Milestones', exact: true }).click();
  await page.getByRole('button', { name: 'Watch again: Hatchling' }).click();
  await reveal(page).getByRole('button', { name: 'Close' }).click();
  expect((await readSave(page))!.rev).toBe(record.rev);
  expect(await progress()).toEqual(afterHatching);

  // Day C: petting the hatchling pays, once.
  await at(page, later(4, 9));
  expect(await care(page, 'Pet Ember')).toBe(2);
  expect(await care(page, 'Pet Ember')).toBe(0);
  await other.close();
});
