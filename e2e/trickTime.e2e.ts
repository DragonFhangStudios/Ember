import type { Locator, Page } from '@playwright/test';
import { TRICKS, TRICK_IDS, fillName } from '../src/lib/tricks';
import { editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';
import { everythingSaved, makeBackup } from './saveSnapshot';

// Trick Time: Little Wave and Tiny Twirl, told as tiny stories. Repeatable
// forever, nothing to fail or master, nothing saved. The egg gets a gentle
// note instead.

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Trick Time' });
const opener = (page: Page) => page.getByRole('group', { name: /Just for fun with/ }).getByRole('button', { name: 'Trick Time' });
const step = (page: Page) => sheet(page).locator('[data-trick-step]');

/** Taps on touch devices, clicks elsewhere. */
const press = (target: Locator) => (test.info().project.use.hasTouch ? target.tap() : target.click());

async function hatch(page: Page) {
  await editSave(page, "state.stage = 'Hatchling'; state.stageSeen = 'Hatchling';");
  await page.reload();
  await waitForApp(page);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('the egg gets a gentle note; a hatchling does both tricks every way, again and again, offline, and nothing saved changes', async ({ page }) => {
  test.slow();
  await press(opener(page));
  await expect(sheet(page).locator('[data-tricks-egg]')).toContainText('Little tricks begin once Ember hatches.');
  await expect(sheet(page).locator('[data-trick]')).toHaveCount(0);
  await press(sheet(page).getByRole('button', { name: 'Close Trick Time' }));
  await expect(opener(page)).toBeFocused();

  await makeBackup(page);
  await hatch(page);
  const before = await everythingSaved(page);
  const requests: string[] = [];
  page.context().on('request', r => requests.push(r.url()));
  await page.context().setOffline(true);

  await press(opener(page));
  await press(sheet(page).locator('[data-trick="wave"]'));
  // Every way each trick can go, moving between them with "again" and "Try …".
  for (const [n, id] of [...TRICK_IDS, ...TRICK_IDS].entries()) {
    const trick = TRICKS[id];
    const choice = trick.choices[n < 2 ? 0 : 1];
    await expect(step(page)).toHaveAttribute('data-trick-step', 'invite');
    await expect(sheet(page)).toContainText(fillName(trick.scene, 'Ember'));
    await press(sheet(page).locator('[data-invite]'));
    await expect(sheet(page)).toContainText(fillName(trick.response, 'Ember'));
    await press(sheet(page).locator(`[data-trick-choice="${choice.id}"]`));
    const finale = sheet(page).locator(`[data-trick-finale="${choice.id}"]`);
    await expect(finale).toBeVisible();
    const silly = (await finale.getAttribute('data-silly')) === 'true';
    await expect(finale).toContainText(fillName(silly ? choice.silly : choice.story, 'Ember'));
    // Once more of the same trick, then over to the other one.
    await press(sheet(page).getByRole('button', { name: `${trick.name} again` }));
    await press(sheet(page).locator('[data-invite]'));
    await press(sheet(page).locator(`[data-trick-choice="${choice.id}"]`));
    await expect(finale).toBeVisible();
    const other = TRICKS[TRICK_IDS.find(t => t !== id)!];
    await press(sheet(page).getByRole('button', { name: `Try ${other.name}` }));
  }
  await press(sheet(page).getByRole('button', { name: 'Back to the tricks' }));
  await expect(step(page)).toHaveAttribute('data-trick-step', 'pick');
  await press(sheet(page).getByRole('button', { name: 'Close Trick Time' }));
  await expect(opener(page)).toBeFocused();
  expect(requests, 'no network needed').toEqual([]);
  await page.context().setOffline(false);
  expect(await everythingSaved(page), 'the save and its backups are untouched').toEqual(before);
});

test('keyboard and screen readers: each step is announced by focus, Ember is named as the speaker, and every visit starts fresh (reduced motion)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hatch(page);
  const rev = (await readSave(page))!.rev;

  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('button', { name: 'Close Trick Time' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(sheet(page).locator('[data-trick="wave"]')).toBeFocused();
  await expect(sheet(page).locator('[data-trick="wave"]')).toHaveAccessibleName(/Little Wave/);
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Little Wave' })).toBeFocused();
  await sheet(page).locator('[data-invite]').focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Little Wave' })).toBeFocused();
  await expect(sheet(page)).toContainText('Ember says:');
  const choices = sheet(page).getByRole('group', { name: TRICKS.wave.question });
  await expect(choices.getByRole('button')).toHaveCount(2);

  // Closing mid-trick, then reopening: a fresh start from the list.
  await page.keyboard.press('Escape');
  await expect(opener(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(step(page)).toHaveAttribute('data-trick-step', 'pick');

  await sheet(page).locator('[data-trick="twirl"]').focus();
  await page.keyboard.press('Enter');
  await sheet(page).locator('[data-invite]').focus();
  await page.keyboard.press(' ');
  await sheet(page).locator('[data-trick-choice="right"]').focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Tiny Twirl' })).toBeFocused();
  await expect(sheet(page).locator('[data-celebration] span'), 'reduced motion: a glow, no sparkles').toHaveCount(0);

  // Back to the list puts focus on the title, not nowhere.
  await sheet(page).getByRole('button', { name: 'Back to the tricks' }).focus();
  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Trick Time' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener(page)).toBeFocused();
  expect((await readSave(page))!.rev, 'nothing saved').toBe(rev);
});
