import type { Page } from '@playwright/test';
import { DragonStage } from '../src/types';
import { DialogueContext, LIBRARY } from '../src/lib/dialogue/library';
import { editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Ember's personality (#18): what he says and how he reacts. Lines are
// checked by id against the pool for the moment, so tests don't depend on
// which line the light randomness picks.

const talk = (page: Page) => page.getByRole('button', { name: 'Talk to Ember' });
const spoken = (page: Page) => page.getByRole('status').locator('[data-line]');

/**
 * Ids Ember could say in this moment, read straight from the line data (the
 * rules restated here, so a bug in the app's selection can't hide itself):
 * lines without stages are for hatched dragons; a hard day uses gentle lines,
 * or supportive ones when a moment has none.
 */
function pool(context: DialogueContext, stage: DragonStage, soft = false): string[] {
  const forStage = (c: DialogueContext) => LIBRARY[c].filter(l => (l.stages ? l.stages.includes(stage) : stage !== DragonStage.EGG));
  const lines = forStage(context);
  if (!soft) return lines.map(l => l.id);
  const gentle = lines.filter(l => l.gentle);
  return (gentle.length ? gentle : forStage('support')).map(l => l.id);
}

async function expectSays(page: Page, ids: string[], what: string) {
  await expect(spoken(page), what).toHaveAttribute('data-line', new RegExp(`^(${ids.join('|')})$`));
}

/** Makes Ember a Hatchling (stages never go down, so this sticks). */
async function asHatchling(page: Page) {
  await editSave(page, "state.stage = 'Hatchling';");
  await page.reload();
  await waitForApp(page);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('Ember says hello for the time of day when the app opens', async ({ page }) => {
  const hour = await page.evaluate(() => new Date().getHours());
  const time = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 21 ? 'evening' : 'lateNight';
  await expectSays(page, pool(`greeting.${time}` as DialogueContext, DragonStage.EGG), `${time} greeting`);
});

test('tapping Ember gets a musing and a reaction, never the same line twice in a row, and never changes the save', async ({ page }) => {
  await asHatchling(page);
  const revBefore = (await readSave(page))!.rev;
  const allowed = [...pool('idle', DragonStage.HATCHLING), ...pool('founder', DragonStage.HATCHLING), ...pool('founder.caught', DragonStage.HATCHLING)];
  await expect(spoken(page), 'the greeting').toBeVisible();
  let last = (await spoken(page).getAttribute('data-line'))!;
  for (let i = 0; i < 8; i++) {
    await talk(page).click();
    await expect(spoken(page)).not.toHaveAttribute('data-line', last);
    const id = (await spoken(page).getAttribute('data-line'))!;
    expect(allowed, id).toContain(id);
    last = id;
  }
  await expect(talk(page)).toHaveAttribute('data-reaction', /.+/);
  expect((await readSave(page))!.rev, 'talking is not saved').toBe(revBefore);
});

test('Ember can be talked to from the keyboard', async ({ page }) => {
  await talk(page).focus();
  await page.keyboard.press('Enter');
  await expectSays(page, pool('idle', DragonStage.EGG), 'egg musing');
});

test('reacts to the first quest of the day alongside the streak message', async ({ page }) => {
  await asHatchling(page);
  await page.getByText('Morning Routine').click();
  await expect(page.getByRole('status')).toContainText('Today counts!');
  await expectSays(page, pool('quest.first', DragonStage.HATCHLING), 'first quest');
});

test('after a low-mood check-in, Ember is gentle for the rest of the day', async ({ page }) => {
  await asHatchling(page);
  await goToTab(page, 'Check-in');
  await page.getByRole('button', { name: '1', exact: true }).nth(1).click(); // mood 1
  await page.getByRole('button', { name: 'Log Check-in' }).click();
  await expectSays(page, pool('checkIn.low', DragonStage.HATCHLING), 'low-mood check-in');

  const gentle = pool('idle', DragonStage.HATCHLING, true);
  for (let i = 0; i < 6; i++) {
    const before = await spoken(page).getAttribute('data-line');
    await talk(page).click();
    await expect(spoken(page)).not.toHaveAttribute('data-line', before ?? '');
    await expectSays(page, gentle, 'gentle musing');
  }
});

test('welcomes the player back after a day away', async ({ page }) => {
  await editSave(page, 'const d = new Date(); d.setDate(d.getDate() - 1); state.lastLogin = d.toDateString();');
  await page.reload();
  await waitForApp(page);
  await expectSays(page, pool('return.oneDay', DragonStage.EGG), 'welcome back');
});

test('after a few days away Ember naps, and wakes gently when petted', async ({ page }) => {
  await editSave(page, "const d = new Date(); d.setDate(d.getDate() - 3); state.lastLogin = d.toDateString(); state.stage = 'Hatchling';");
  await page.reload();
  await waitForApp(page);
  await expectSays(page, pool('return.napping', DragonStage.HATCHLING), 'napping');
  await expect(page.getByText('Pet him or complete a quest to wake him up.')).toBeVisible();

  await page.getByRole('button', { name: 'Pet Ember' }).click();
  await expectSays(page, pool('return.wake', DragonStage.HATCHLING), 'waking up');
  await expect(page.getByText('curled up for a nap')).toHaveCount(0);
});

test('Ember keeps talking offline', async ({ page, context }) => {
  await context.setOffline(true);
  await talk(page).click();
  await expectSays(page, pool('idle', DragonStage.EGG), 'offline musing');
  await page.getByText('Morning Routine').click();
  await expectSays(page, pool('quest.first', DragonStage.EGG), 'offline quest');
  await context.setOffline(false);
});

test('with reduced motion, reactions show a badge but nothing moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await waitForApp(page);
  await talk(page).click();
  await expect(talk(page)).toHaveAttribute('data-reaction', /.+/);
  // The dragon image and every wrapper around it, up to the button.
  const transforms = () =>
    talk(page).evaluate(button => {
      const chain: string[] = [];
      for (let e: Element | null = button.querySelector('img'); e && e !== button; e = e.parentElement) chain.push(getComputedStyle(e).transform);
      return chain.join('|');
    });
  const first = await transforms();
  await page.waitForTimeout(400);
  expect(await transforms(), 'no element of the dragon moves').toBe(first);
});
