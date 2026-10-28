import type { Page } from '@playwright/test';
import { LIBRARY } from '../src/lib/dialogue/library';
import { REST_MS } from '../src/lib/moments';
import { bondOf, editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';

// Dragon Moments (Boop, Play, Rest Together): little things to do with Ember,
// as often as you like. They never change the save, earn nothing, and leave
// care, quests and evolution exactly as they were.

const ids = (context: keyof typeof LIBRARY, egg: boolean) =>
  LIBRARY[context].filter(l => (l.stages ? l.stages.includes('Egg' as never) === egg : !egg)).map(l => l.id);
const line = (page: Page) => page.getByRole('status').locator('[data-line]');
const moment = (page: Page, name: 'Boop' | 'Play' | 'Rest together') => page.getByRole('group', { name: /Just for fun with/ }).getByRole('button', { name, exact: true });

/** Waits until no message is showing, so a moment's words aren't held back by the opening message. */
async function quiet(page: Page) {
  await expect(page.getByRole('status')).toHaveText('', { timeout: 10_000 });
}

/** Presses a moment's button the way this project's device would (tap on touch screens). */
async function press(page: Page, name: 'Boop' | 'Play' | 'Rest together') {
  const button = moment(page, name);
  if (test.info().project.use.hasTouch) await button.tap();
  else await button.click();
}

async function hatch(page: Page, stage = 'Hatchling') {
  await editSave(page, `state.stage = '${stage}'; state.stageSeen = '${stage}';`);
  await page.reload();
  await waitForApp(page);
  await quiet(page);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('the egg answers from inside its shell, a hatchling answers in its own way, and nothing is saved or earned', async ({ page }) => {
  test.slow();
  await quiet(page);
  const before = (await readSave(page))!;
  for (const [name, context] of [['Boop', 'moment.boop'], ['Play', 'moment.play'], ['Rest together', 'moment.rest']] as const) {
    await press(page, name);
    const allowed = [...ids(context, true), ...ids('moment.surprise', true)];
    await expect.poll(async () => allowed.includes((await line(page).getAttribute('data-line'))!), `${name} (egg)`).toBe(true);
  }

  await hatch(page);
  const hatched = (await readSave(page))!;
  for (const [name, context] of [['Boop', 'moment.boop'], ['Play', 'moment.play'], ['Rest together', 'moment.rest']] as const) {
    await page.waitForTimeout(SNEEZE_SAFE_GAP);
    await press(page, name);
    const allowed = [...ids(context, false), ...ids('moment.surprise', false)];
    await expect.poll(async () => allowed.includes((await line(page).getAttribute('data-line'))!), `${name} (hatchling)`).toBe(true);
  }
  // Nothing was written: the same save revision, energy, Bond, scales and active days.
  const after = (await readSave(page))!;
  expect(after.rev).toBe(hatched.rev);
  const essentials = (s: Record<string, any>) => ({ energy: s.energy, bond: bondOf(s), scales: s.goldenScales, days: s.activity.days.length, daily: s.daily });
  expect(essentials(after.state)).toEqual(essentials(hatched.state));
  expect(before.state.activity.days).toEqual([]);
});

/** Long enough between boops that they never count as "quick" (see SNEEZE_WINDOW_MS). */
const SNEEZE_SAFE_GAP = 50;

test('pressing again and again keeps it fresh: no line twice in a row', async ({ page }) => {
  await hatch(page);
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    await press(page, 'Play');
    await expect.poll(async () => line(page).getAttribute('data-line')).not.toBe(seen.at(-1) ?? null);
    seen.push((await line(page).getAttribute('data-line'))!);
  }
  for (let i = 1; i < seen.length; i++) expect(seen[i], seen.join(', ')).not.toBe(seen[i - 1]);
  expect(new Set(seen).size).toBeGreaterThan(1);
});

/** Three boops in one go (one browser tick), so they always count as quick, however slowly the test runs. */
async function tripleBoop(page: Page) {
  await moment(page, 'Boop').evaluate(button => {
    for (let i = 0; i < 3; i++) (button as HTMLButtonElement).click();
  });
}

test('the hidden sparkle sneeze: three quick boops, on the egg and on a hatchling', async ({ page }) => {
  await quiet(page);
  await tripleBoop(page);
  await expect(line(page)).toHaveAttribute('data-line', 'sneeze-egg');
  await hatch(page);
  await tripleBoop(page);
  await expect.poll(async () => ids('moment.sneeze', false).includes((await line(page).getAttribute('data-line'))!)).toBe(true);
});

test('Rest Together: Ember rests quietly for a little while, then carries on', async ({ page }) => {
  await hatch(page);
  const resting = page.locator('[data-resting]');
  await expect(resting).toHaveCount(0);
  await press(page, 'Rest together');
  await expect(resting).toHaveCount(1);
  await expect(resting).toHaveCount(0, { timeout: REST_MS + 3000 });
});

test('every moment works from the keyboard, and the group is named for screen readers', async ({ page }) => {
  await hatch(page);
  const group = page.getByRole('group', { name: 'Just for fun with Ember' });
  await expect(group.getByRole('button')).toHaveCount(6); // Boop, Play, Rest together, Explore, Pattern Challenge, Trick Time
  await moment(page, 'Boop').focus();
  await page.keyboard.press('Enter');
  await expect(line(page)).toBeVisible();
  const first = await line(page).getAttribute('data-line');
  await page.keyboard.press('Tab');
  await expect(moment(page, 'Play')).toBeFocused();
  await page.keyboard.press('Space');
  await expect.poll(async () => line(page).getAttribute('data-line')).not.toBe(first);
  await page.keyboard.press('Tab');
  await expect(moment(page, 'Rest together')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-resting]')).toHaveCount(1);
});

test('with reduced motion, resting is a still glow: nothing moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hatch(page);
  await press(page, 'Rest together');
  const resting = page.locator('[data-resting]');
  await expect(resting).toHaveCount(1);
  const transforms: string[] = [];
  for (let i = 0; i < 5; i++) {
    transforms.push(await resting.evaluate(el => getComputedStyle(el).transform));
    await page.waitForTimeout(200);
  }
  expect(new Set(transforms).size, transforms.join(' | ')).toBe(1);
});

test('moments never get in the way of care or a wellness message', async ({ page }) => {
  await hatch(page);
  // A quest's message keeps its time: a Boop gets a reaction, not new words.
  await page.getByText('Morning Routine').click();
  await expect(page.getByRole('status')).not.toHaveText('');
  const message = await page.getByRole('status').textContent();
  await press(page, 'Boop');
  await expect(page.locator('[data-reaction]')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText(message!);

  // Petting still pays, once, as before.
  const bond = bondOf((await readSave(page))!.state);
  await page.getByRole('button', { name: 'Pet Ember', exact: true }).click();
  await expect.poll(async () => bondOf((await readSave(page))!.state)).toBe(bond + 2);
  await press(page, 'Boop');
  await press(page, 'Play');
  await expect(page.getByRole('button', { name: 'Pet Ember', exact: true })).toBeDisabled();
});
