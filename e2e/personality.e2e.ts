import type { BrowserContext, Page } from '@playwright/test';
import { DragonStage } from '../src/types';
import { DialogueContext, LIBRARY } from '../src/lib/dialogue/library';
import { editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Ember's personality (#18): what he says and how he reacts. Lines are
// checked by id against the pool for the moment, so tests don't depend on
// which line the light randomness picks.

const talk = (page: Page) => page.getByRole('button', { name: 'Talk to Ember' });
const spoken = (page: Page) => page.getByRole('status').locator('[data-line]');

/**
 * Taps Ember while a wellness message shows: the tap should do nothing. A
 * replaced message would still show during its 0.15s fade-out, so check well
 * after that.
 */
async function expectTapIgnored(page: Page, text: string) {
  const line = (await spoken(page).getAttribute('data-line'))!;
  await talk(page).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('status'), 'the message is unchanged').toContainText(text);
  await expect(spoken(page)).toHaveAttribute('data-line', line);
}

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
  const allowed = pool('idle', DragonStage.HATCHLING);
  // Hatching's milestone message holds: a tap doesn't replace it.
  await expect(page.getByRole('status')).toContainText('Milestone unlocked');
  await expectTapIgnored(page, 'Milestone unlocked');
  await messageGone(page);
  let last = '';
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

test('Ember can be talked to from the keyboard, even while he says hello', async ({ page }) => {
  await expect(spoken(page), 'the hello when the app opens').toBeVisible();
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
  await messageGone(page); // the check-in's message holds until it's done

  const gentle = pool('idle', DragonStage.HATCHLING, true);
  let before = '';
  for (let i = 0; i < 6; i++) {
    await talk(page).click();
    await expect(spoken(page)).not.toHaveAttribute('data-line', before);
    await expectSays(page, gentle, 'gentle musing');
    before = (await spoken(page).getAttribute('data-line'))!;
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

/** Makes the keyboard Easter egg certain (or impossible) from now on. */
const easterEggChance = (page: Page, chance: number) =>
  page.evaluate(c => {
    (window as { __emberEasterEggChance?: number }).__emberEasterEggChance = c;
  }, chance);

const keyboard = (page: Page) => page.locator('[data-keyboard]');

/** The Easter egg never interrupts another moment, so wait until its message has gone. */
const messageGone = (page: Page) => expect(page.getByRole('status')).toHaveText('', { timeout: 10_000 });

test.describe('the keyboard Easter egg', () => {
  test('Ember gets caught "helping" build himself, then hides the keyboard, without touching the save', async ({ page }) => {
    await asHatchling(page);
    await messageGone(page); // the greeting
    await easterEggChance(page, 1);
    const revBefore = (await readSave(page))!.rev;

    await talk(page).click();
    await expect(spoken(page)).toHaveAttribute('data-line', 'founder-helping');
    await expect(spoken(page)).toContainText("Dad went to work, so I'm helping build myself!");
    await expect(keyboard(page)).toHaveAttribute('data-keyboard', 'typing');
    await expect(talk(page)).toHaveAttribute('data-antic', 'typing');

    await talk(page).click(); // caught!
    await expect(spoken(page)).toHaveAttribute('data-line', 'founder-caught');
    await expect(spoken(page)).toContainText('I WAS JUST LOOKING!!!');
    await expect(keyboard(page)).toHaveAttribute('data-keyboard', 'busted');
    await expect(talk(page)).toHaveAttribute('data-reaction', 'surprise');

    await expect(keyboard(page), 'the keyboard goes away after a moment').toHaveCount(0, { timeout: 6000 });
    expect((await readSave(page))!.rev, 'nothing was saved').toBe(revBefore);
  });

  test('never for the egg', async ({ page }) => {
    await messageGone(page);
    await easterEggChance(page, 1);
    await talk(page).click();
    await expectSays(page, pool('idle', DragonStage.EGG), 'egg musing');
    await expect(keyboard(page)).toHaveCount(0);
  });

  test('never during a focus session, running or paused', async ({ page }) => {
    await asHatchling(page);
    await easterEggChance(page, 1);
    await goToTab(page, 'Focus');
    await page.getByRole('button', { name: 'Start focus' }).click();
    await messageGone(page);
    await talk(page).click();
    await expectSays(page, pool('idle', DragonStage.HATCHLING), 'musing during focus');
    await expect(keyboard(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Pause focus' }).click();
    await messageGone(page);
    await talk(page).click();
    await expectSays(page, pool('idle', DragonStage.HATCHLING), 'musing while focus is paused');
    await expect(keyboard(page)).toHaveCount(0);
  });

  test("a tap never replaces a wellness message or makes it stay longer", async ({ page }) => {
    await asHatchling(page);
    await messageGone(page);
    await easterEggChance(page, 1);
    // Note when the quest message appears and when it goes (page time).
    await page.evaluate(() => {
      const status = document.querySelector('[role="status"]')!;
      const w = window as { questShown?: number; questGone?: number };
      new MutationObserver(() => {
        const showing = status.textContent!.includes('Today counts!');
        if (showing && w.questShown === undefined) w.questShown = performance.now();
        if (!showing && w.questShown !== undefined && w.questGone === undefined) w.questGone = performance.now();
      }).observe(status, { childList: true, subtree: true, characterData: true });
    });
    const shownFor = () => page.evaluate(() => {
      const w = window as { questShown?: number };
      return w.questShown === undefined ? 0 : performance.now() - w.questShown;
    });

    await page.getByText('Morning Routine').click();
    await expect(page.getByRole('status')).toContainText('Today counts!');
    const line = await spoken(page).getAttribute('data-line');
    expect(pool('quest.first', DragonStage.HATCHLING), 'Ember speaks with the quest message').toContain(line);

    // Tap early, and again later in the message's time.
    for (const at of [500, 3500]) {
      await expect.poll(shownFor).toBeGreaterThanOrEqual(at);
      await expectTapIgnored(page, 'Today counts!');
      await expect(spoken(page)).toHaveAttribute('data-line', line!);
      await expect(keyboard(page)).toHaveCount(0);
    }

    await messageGone(page);
    const shown = await page.evaluate(() => {
      const w = window as unknown as { questShown: number; questGone: number };
      return w.questGone - w.questShown;
    });
    // 5.5s plus the fade; a tap restarting the timer would make it 9s or more.
    expect(shown, 'the message kept its normal duration').toBeGreaterThan(5000);
    expect(shown, 'the message kept its normal duration').toBeLessThan(7500);
  });

  test('never after a low-mood check-in', async ({ page }) => {
    await asHatchling(page);
    await easterEggChance(page, 1);
    await goToTab(page, 'Check-in');
    await page.getByRole('button', { name: '1', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await messageGone(page);
    await talk(page).click();
    await expectSays(page, pool('idle', DragonStage.HATCHLING, true), 'gentle musing');
    await expect(keyboard(page)).toHaveCount(0);
  });

  test('with reduced motion, the keyboard and the guilty pose are still (and the words are there)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await asHatchling(page);
    await messageGone(page);
    await easterEggChance(page, 1);
    const pose = () => keyboard(page).evaluate(k => [k, ...k.querySelectorAll('*')].map(e => getComputedStyle(e).transform).join('|'));

    await talk(page).click();
    await expect(keyboard(page)).toHaveAttribute('data-keyboard', 'typing');
    const typing = await pose();
    await page.waitForTimeout(400);
    expect(await pose(), 'typing pose is still').toBe(typing);

    await talk(page).click();
    await expect(keyboard(page)).toHaveAttribute('data-keyboard', 'busted');
    await expect(spoken(page)).toContainText('I WAS JUST LOOKING!!!');
    await expect.poll(pose, { message: 'tucked away, not where it was' }).not.toBe(typing);
    const busted = await pose();
    await page.waitForTimeout(400);
    expect(await pose(), 'guilty pose is still').toBe(busted);
  });
});

/** Part A of the Easter egg, then makes a fresh Part A impossible: any later founder line could only be Part B. */
async function startEasterEgg(page: Page) {
  await asHatchling(page);
  await messageGone(page);
  await easterEggChance(page, 1);
  await talk(page).click();
  await expect(spoken(page)).toHaveAttribute('data-line', 'founder-helping');
  await expect(keyboard(page)).toHaveAttribute('data-keyboard', 'typing');
  await easterEggChance(page, 0);
}

async function openAnotherTab(context: BrowserContext) {
  const other = await context.newPage();
  await other.goto('/');
  await waitForApp(other);
  return other;
}

/** Tapping now is an ordinary musing: Ember is not "caught". */
async function expectNotCaught(page: Page, soft = false) {
  await talk(page).click();
  await expectSays(page, pool('idle', DragonStage.HATCHLING, soft), 'an ordinary musing, not Part B');
  await expect(keyboard(page)).toHaveCount(0);
}

test.describe('the keyboard Easter egg gives way to something meaningful', () => {
  test('a low-mood check-in (here, from another tab) puts the keyboard away, and no Part B follows', async ({ page, context }) => {
    await startEasterEgg(page);
    const other = await openAnotherTab(context);
    await goToTab(other, 'Check-in');
    await other.getByRole('button', { name: '1', exact: true }).nth(1).click();
    await other.getByRole('button', { name: 'Log Check-in' }).click();
    await expect(keyboard(page), 'put away as soon as the check-in arrives').toHaveCount(0);
    await expectNotCaught(page, true);
  });

  test('a focus session starting (here, in another tab) puts the keyboard away, and no Part B follows', async ({ page, context }) => {
    await startEasterEgg(page);
    const other = await openAnotherTab(context);
    await goToTab(other, 'Focus');
    await other.getByRole('button', { name: 'Start focus' }).click();
    await expect(keyboard(page), 'put away as soon as focus starts').toHaveCount(0);
    await expectNotCaught(page);
  });

  test('a paused focus session still counts: no Part B', async ({ page, context }) => {
    await startEasterEgg(page);
    const other = await openAnotherTab(context);
    await goToTab(other, 'Focus');
    await other.getByRole('button', { name: 'Start focus' }).click();
    await other.getByRole('button', { name: 'Pause focus' }).click();
    await expect.poll(async () => (await readSave(page))!.state.focus?.status).toBe('paused');
    await expect(keyboard(page)).toHaveCount(0);
    await expectNotCaught(page);
  });

  test('completing a quest puts the keyboard away; its message stays, and no Part B follows', async ({ page }) => {
    await startEasterEgg(page);
    await page.getByText('Morning Routine').click();
    await expect(page.getByRole('status')).toContainText('Today counts!');
    await expect(keyboard(page), 'put away as the quest message appears').toHaveCount(0);
    await expectTapIgnored(page, 'Today counts!');
    await messageGone(page);
    await expectNotCaught(page);
  });

  test('going to another tab puts the keyboard away, and no Part B follows on return', async ({ page }) => {
    await startEasterEgg(page);
    await goToTab(page, 'Check-in');
    await expect(keyboard(page)).toHaveCount(0);
    await goToTab(page, 'Home');
    await expectNotCaught(page);
  });
});
