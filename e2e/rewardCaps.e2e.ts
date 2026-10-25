import type { BrowserContext, Page } from '@playwright/test';
import { bondOf, expect, openApp, readSave, statValue, test, waitForApp } from './fixtures';

// Custom-quest daily allowances, through the real UI (alpha feedback): all
// custom quests together earn at most 40 energy and 4 Bond per local day, no
// matter how many are created, in which category, or how they're completed.
// Each test records what the player sees and what's saved after every step.

const ENERGY_CAP = 40;
const BOND_CAP = 4;
const CATEGORIES = ['Routine', 'Vitality', 'Focus', 'Check-in', 'Custom'] as const;

const quest = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(`^${title}`) });
const saved = async (page: Page) => (await readSave(page))!.state;

interface Row {
  step: string;
  energy: number;
  bond: number;
  shownEnergy: string;
  customQuestEnergy: number;
  customQuestGrowth: number;
}

async function snapshot(page: Page, step: string): Promise<Row> {
  const s = await saved(page);
  return {
    step,
    energy: s.energy,
    bond: Math.round(bondOf(s) * 1000) / 1000,
    shownEnergy: ((await statValue(page, 'Energy').textContent()) ?? '').trim(),
    customQuestEnergy: s.daily.customQuestEnergy,
    customQuestGrowth: s.daily.customQuestGrowth,
  };
}

/** Adds a custom quest through the Add Custom Quest dialog. */
async function addCustomQuest(page: Page, title: string, { target = 1, category = 'Custom' as string } = {}) {
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await page.getByLabel('Quest Title').fill(title);
  await page.getByRole('dialog').getByRole('button', { name: category, exact: true }).click();
  await page.getByLabel(/Target Steps/).fill(String(target));
  await page.getByRole('button', { name: 'Add Quest' }).click();
  await expect(quest(page, title)).toBeVisible();
}

/** Taps a quest once and waits for the save to change. */
async function tap(page: Page, title: string) {
  const before = (await readSave(page))!.rev;
  await quest(page, title).click();
  await expect.poll(async () => (await readSave(page))!.rev).toBeGreaterThan(before);
}

/** Everything custom quests have paid since `base`, checked against the saved counters. */
function expectWithinAllowance(base: Row, row: Row) {
  const energy = row.energy - base.energy;
  const bond = Math.round((row.bond - base.bond) * 1000) / 1000;
  expect(energy, `${row.step}: energy from custom quests`).toBeLessThanOrEqual(ENERGY_CAP);
  expect(bond, `${row.step}: Bond from custom quests`).toBeLessThanOrEqual(BOND_CAP);
  // What was paid is exactly what the daily counters recorded: nothing slipped past them.
  expect(energy, `${row.step}: energy paid = counter`).toBe(row.customQuestEnergy - base.customQuestEnergy);
  expect(bond, `${row.step}: Bond paid = counter`).toBeCloseTo(row.customQuestGrowth - base.customQuestGrowth, 6);
  expect(row.shownEnergy, `${row.step}: header shows the saved energy`).toBe(String(row.energy));
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('eight new one-step custom quests in every category earn 40 energy and 4 Bond in total, then nothing more today', async ({ page }, info) => {
  test.slow(); // many dialog round trips and reloads: slow under parallel load, not a sign of a problem
  const base = await snapshot(page, 'start');
  const rows: Row[] = [base];
  for (let i = 1; i <= 10; i++) {
    const title = `Tiny task ${i}`;
    await addCustomQuest(page, title, { category: CATEGORIES[i % CATEGORIES.length] });
    await tap(page, title);
    const row = await snapshot(page, `complete #${i} (${CATEGORIES[i % CATEGORIES.length]})`);
    rows.push(row);
    expectWithinAllowance(base, row);
  }
  await info.attach('reward-table.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
  const last = rows[rows.length - 1];
  // 10 energy and 2 Bond per one-step quest: the energy allowance fills on the 4th, Bond on the 2nd.
  expect(rows.map(r => r.energy - base.energy)).toEqual([0, 10, 20, 30, 40, 40, 40, 40, 40, 40, 40]);
  expect(rows.map(r => Math.round((r.bond - base.bond) * 1000) / 1000)).toEqual([0, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  expect([last.customQuestEnergy, last.customQuestGrowth]).toEqual([ENERGY_CAP, BOND_CAP]);
  await expect(page.getByRole('status')).toContainText("You've earned today's energy and Bond from custom quests");
});

test('the allowance holds across reloads, multi-step quests, and deleting and recreating quests', async ({ page }) => {
  test.slow(); // many dialog round trips and reloads: slow under parallel load, not a sign of a problem
  const base = await snapshot(page, 'start');
  for (let i = 1; i <= 4; i++) {
    await addCustomQuest(page, `Warm-up ${i}`);
    await tap(page, `Warm-up ${i}`);
  }
  expectWithinAllowance(base, await snapshot(page, 'allowance used'));

  await page.reload();
  await waitForApp(page);
  await addCustomQuest(page, 'After reload');
  await tap(page, 'After reload');
  expectWithinAllowance(base, await snapshot(page, 'after reload'));

  await addCustomQuest(page, 'Three steps', { target: 3 });
  for (let i = 0; i < 3; i++) await tap(page, 'Three steps');
  expectWithinAllowance(base, await snapshot(page, 'multi-step quest'));

  // Delete a completed quest and add it again with the same name.
  await page.getByRole('button', { name: 'Options for Warm-up 1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete Quest' }).click(); // opens the confirmation
  await page.getByRole('dialog').getByRole('button', { name: 'Delete Quest' }).click(); // confirms
  await expect(quest(page, 'Warm-up 1')).toHaveCount(0);
  await addCustomQuest(page, 'Warm-up 1');
  await tap(page, 'Warm-up 1');
  const row = await snapshot(page, 'deleted and recreated');
  expectWithinAllowance(base, row);
  expect(row.energy - base.energy).toBe(ENERGY_CAP);
});

test('rapid taps on a multi-step quest pay each step once, within the allowance', async ({ page }) => {
  const base = await snapshot(page, 'start');
  await addCustomQuest(page, 'Quick steps', { target: 6 });
  const card = quest(page, 'Quick steps');
  for (let i = 0; i < 6; i++) await card.click({ delay: 0 });
  await expect.poll(async () => (await saved(page)).quests.find((q: { title: string }) => q.title === 'Quick steps')?.progress).toBe(6);
  const row = await snapshot(page, 'six rapid taps');
  expectWithinAllowance(base, row);
  // 6 steps × 10 energy is more than the allowance: only 40 is paid.
  expect(row.energy - base.energy).toBe(ENERGY_CAP);
});

async function openTab(context: BrowserContext) {
  const tab = await context.newPage();
  await tab.goto('/');
  await waitForApp(tab);
  return tab;
}

test('two tabs completing different custom quests share one allowance', async ({ page, context }) => {
  test.slow(); // many dialog round trips and reloads: slow under parallel load, not a sign of a problem
  const base = await snapshot(page, 'start');
  const other = await openTab(context);
  for (let i = 1; i <= 4; i++) {
    await addCustomQuest(page, `Tab A ${i}`);
    await addCustomQuest(other, `Tab B ${i}`);
  }
  // Alternate between the tabs, tapping as fast as each save allows.
  for (let i = 1; i <= 4; i++) {
    await quest(page, `Tab A ${i}`).click();
    await quest(other, `Tab B ${i}`).click();
  }
  await expect
    .poll(async () => (await saved(page)).quests.filter((q: { title: string; completed: boolean }) => q.title.startsWith('Tab') && q.completed).length)
    .toBe(8);
  await page.reload();
  await waitForApp(page);
  expectWithinAllowance(base, await snapshot(page, 'after two tabs'));
});

/** A local time `days` after today (always later than the save the test opened with). */
const later = (days: number, h: number, m: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, h, m);
};

test("moving the device clock back across midnight (and forward again) doesn't refill the allowance", async ({ page }) => {
  test.slow(); // many dialog round trips and reloads: slow under parallel load, not a sign of a problem
  // Quests are added first, on the real clock (their ids come from the time).
  const titles = Array.from({ length: 9 }, (_, i) => `Clock test ${i + 1}`);
  for (const title of titles) await addCustomQuest(page, title);
  const next = (() => {
    let i = 0;
    return () => titles[i++];
  })();
  const at = async (time: Date) => {
    await page.clock.setFixedTime(time);
    await page.reload();
    await waitForApp(page);
  };

  // 00:30 on a day (later than the save's day, so it's a real new day).
  await at(later(2, 0, 30));
  const base = await snapshot(page, 'start');
  for (let i = 0; i < 4; i++) await tap(page, next());
  expectWithinAllowance(base, await snapshot(page, 'allowance used'));

  // 23:30 the evening before: flying west, or setting the clock back.
  await at(later(1, 23, 30));
  for (let i = 0; i < 3; i++) await tap(page, next());
  expectWithinAllowance(base, await snapshot(page, 'clock moved back'));

  // Forward again, still the same real day.
  await at(later(2, 1, 0));
  await tap(page, next());
  const row = await snapshot(page, 'clock forward again');
  expectWithinAllowance(base, row);
  expect(row.energy - base.energy).toBe(ENERGY_CAP);

  // The real next day brings a fresh allowance.
  await at(later(3, 9, 0));
  await tap(page, next());
  expect((await saved(page)).daily.customQuestEnergy).toBe(10);
});

test('built-in quests earn their own rewards and never use the custom-quest allowance', async ({ page }, info) => {
  // Alpha feedback context: energy and Bond also come from built-in quests (and
  // petting, feeding, focus and check-ins), each with its own rules. Rising
  // totals after the custom allowance is used can come from these.
  const base = await snapshot(page, 'start');
  for (let i = 1; i <= 4; i++) {
    await addCustomQuest(page, `Custom ${i}`);
    await tap(page, `Custom ${i}`);
  }
  const capped = await snapshot(page, 'custom allowance used');
  const rows: Row[] = [base, capped];
  for (const title of ['Morning Routine', 'Daily Vitality']) {
    await tap(page, title);
    rows.push(await snapshot(page, `built-in: ${title}`));
  }
  await info.attach('built-in-vs-custom.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
  const last = rows[rows.length - 1];
  expect(last.energy, 'built-in quests still earn energy').toBeGreaterThan(capped.energy);
  expect(last.bond, 'and Bond').toBeGreaterThan(capped.bond);
  expect([last.customQuestEnergy, last.customQuestGrowth], 'without touching the custom allowance').toEqual([ENERGY_CAP, BOND_CAP]);
});
