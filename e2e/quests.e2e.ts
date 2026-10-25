import type { BrowserContext, Page } from '@playwright/test';
import { contrastProblems, settle } from './contrast';
import { bondOf, editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Phase 2D (#19): correcting quest taps, editing and deleting custom quests,
// the custom-quest energy cap, Zen Master, and check-in notes.

const quest = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(`^${title}`) });
const options = (page: Page, title: string) => page.getByRole('button', { name: `Options for ${title}` });
const dialog = (page: Page) => page.getByRole('dialog');
const saved = async (page: Page) => (await readSave(page))!.state;
const questIn = async (page: Page, id: string) => (await saved(page)).quests.find((q: { id: string }) => q.id === id);
/** What a player has earned: a correction or delete must never change it. */
const earned = async (page: Page) => {
  const s = await saved(page);
  return { energy: s.energy, scales: s.goldenScales, bond: bondOf(s), streak: s.currentStreak, days: s.activity.days, badges: s.badges.filter((b: { unlockedAt?: string }) => b.unlockedAt).length };
};

/** Adds a custom quest the way a player would. */
async function addCustomQuest(page: Page, title: string, target = 1) {
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await page.getByLabel('Quest Title').fill(title);
  await page.getByLabel(/Target Steps/).fill(String(target));
  await page.getByRole('button', { name: 'Add Quest' }).click();
  await expect(quest(page, title)).toBeVisible();
}

async function tapTimes(page: Page, title: string, times: number) {
  for (let i = 0; i < times; i++) {
    const before = (await readSave(page))!.rev;
    await quest(page, title).click();
    await expect.poll(async () => (await readSave(page))!.rev).toBeGreaterThan(before);
  }
}

/**
 * 23:59:30 local time on the day after today, and 30 s past the midnight that
 * follows. Always later than the save the test opened with: moving the clock
 * backwards would (correctly) stop the app from starting a new day.
 */
const tomorrow = (h: number, m: number, s: number, extraDays = 0) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1 + extraDays, h, m, s);
};
const lateTonight = () => tomorrow(23, 59, 30);
const justAfterMidnight = () => tomorrow(0, 0, 30, 1);

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test.describe('correcting a mistaken tap', () => {
  test('tapping a done quest asks first; "Mark as not done" keeps everything earned, and redoing it earns nothing', async ({ page }) => {
    await tapTimes(page, 'Morning Routine', 1);
    const before = await earned(page);
    expect(before.energy).toBe(60);

    await quest(page, 'Morning Routine').click();
    await expect(dialog(page)).toHaveAccessibleName('Mark as not done?');
    await expect(dialog(page).getByRole('button', { name: 'Cancel' }), 'the safe choice is focused').toBeFocused();
    await dialog(page).getByRole('button', { name: 'Mark as not done' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Everything you earned stays yours');
    await expect.poll(async () => (await questIn(page, 'q1')).completed).toBe(false);
    expect(await earned(page)).toEqual(before);

    await tapTimes(page, 'Morning Routine', 1);
    await expect(page.getByRole('status')).toContainText("You'd already earned this step today");
    expect((await questIn(page, 'q1')).completed).toBe(true);
    expect(await earned(page)).toEqual(before);
  });

  test('Cancel and Escape keep the quest done, and focus returns to it', async ({ page }) => {
    await tapTimes(page, 'Morning Routine', 1);
    const rev = (await readSave(page))!.rev;
    await quest(page, 'Morning Routine').click();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await quest(page, 'Morning Routine').focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(quest(page, 'Morning Routine')).toBeFocused();
    expect((await readSave(page))!.rev, 'nothing was saved').toBe(rev);
  });

  test('a multi-step quest goes back one step from its options; redoing the step earns nothing', async ({ page }) => {
    await tapTimes(page, 'Hydration Goal', 3);
    const before = await earned(page);
    await options(page, 'Hydration Goal').click();
    await dialog(page).getByRole('button', { name: /Undo one step/ }).click();
    await expect(dialog(page)).toHaveAccessibleName('Undo one step?');
    await expect(dialog(page)).toContainText('goes back to 2/4');
    await dialog(page).getByRole('button', { name: 'Undo one step' }).click();
    await expect.poll(async () => (await questIn(page, 'q5')).progress).toBe(2);
    expect(await earned(page)).toEqual(before);

    await tapTimes(page, 'Hydration Goal', 1); // 3/4 again: already earned
    expect(await earned(page)).toEqual(before);
    await tapTimes(page, 'Hydration Goal', 1); // 4/4: new
    expect((await earned(page)).energy).toBe(before.energy + 5);
  });

  test('quests completed by a focus session or check-in have no correction', async ({ page }) => {
    await goToTab(page, 'Check-in');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await goToTab(page, 'Home');
    // Wait until the list shows it done, so a missing button means something.
    await expect(quest(page, 'Symptom Check-in')).toContainText('(done)');
    await expect(options(page, 'Symptom Check-in')).toHaveCount(0);
    await quest(page, 'Symptom Check-in').click();
    await page.waitForTimeout(400); // a dialog would open within a frame or two
    await expect(dialog(page)).toHaveCount(0);
  });

  test("yesterday's quests can't be corrected after midnight: the day starts fresh", async ({ page }) => {
    await page.clock.setFixedTime(lateTonight());
    await openApp(page);
    await waitForApp(page);
    await tapTimes(page, 'Morning Routine', 1);
    await expect(options(page, 'Morning Routine')).toBeVisible();
    const energy = (await saved(page)).energy;

    await page.clock.setFixedTime(justAfterMidnight());
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // the app's day check
    await expect.poll(async () => (await questIn(page, 'q1')).completed).toBe(false);
    await expect(quest(page, 'Morning Routine')).not.toContainText('(done)');
    await expect(options(page, 'Morning Routine')).toHaveCount(0);
    expect((await saved(page)).energy).toBe(energy);
  });

  test('a correction dialog left open past midnight changes nothing', async ({ page }) => {
    await page.clock.setFixedTime(lateTonight());
    await openApp(page);
    await waitForApp(page);
    await tapTimes(page, 'Hydration Goal', 2);
    await options(page, 'Hydration Goal').click();
    await dialog(page).getByRole('button', { name: /Undo one step/ }).click();
    await page.clock.setFixedTime(justAfterMidnight());
    await dialog(page).getByRole('button', { name: 'Undo one step' }).click();
    await expect(page.getByRole('status')).toContainText('nothing to correct');
    expect((await questIn(page, 'q5')).progress).toBe(0);
  });
});

test.describe('custom quest rewards on screen', () => {
  const note = (page: Page) => page.locator('#custom-quest-energy');

  test('show energy per step and the shared daily limit, never a total above it', async ({ page }) => {
    await expect(note(page), 'no note without custom quests').toHaveCount(0);
    await addCustomQuest(page, 'Big one', 6);
    await addCustomQuest(page, 'Small one');
    await expect(quest(page, 'Big one').locator('[data-reward]')).toHaveText('+10/step');
    await expect(quest(page, 'Small one').locator('[data-reward]')).toHaveText('+10');
    await expect(quest(page, 'Big one')).not.toContainText('+60');
    await expect(quest(page, 'Hydration Goal').locator('[data-reward]'), 'built-in quests unchanged').toHaveText('+20');
    await expect(note(page)).toHaveText('Custom quests: +10 energy per step, up to 40 a day together. 40 left today.');
    await expect(quest(page, 'Big one')).toHaveAccessibleDescription(/up to 40 a day together/);
    await expect(quest(page, 'Morning Routine')).not.toHaveAccessibleDescription(/40 a day/);

    await tapTimes(page, 'Big one', 3);
    await expect(note(page)).toContainText('10 left today.');
    await tapTimes(page, 'Big one', 1);
    await expect(note(page)).toContainText("Today's is all earned, and they still count for your streak.");
    expect((await saved(page)).energy, 'what was shown is what was paid').toBe(90);
  });

  test('are readable in light and dark mode', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await waitForApp(page);
    await addCustomQuest(page, 'Big one', 6);
    await tapTimes(page, 'Big one', 1);
    await expect(page.getByRole('status')).toHaveText('', { timeout: 10_000 }); // the message has gone
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await note(page).scrollIntoViewIfNeeded();
      await settle(page);
      expect(await contrastProblems(page), `${scheme} contrast`).toEqual([]);
    }
  });
});

test.describe('custom quests', () => {
  test('can be edited (title, description, category, target), keeping their identity and progress', async ({ page }) => {
    await addCustomQuest(page, 'Stretch', 2);
    await tapTimes(page, 'Stretch', 1);
    const id = (await saved(page)).quests.find((q: { title: string }) => q.title === 'Stretch').id;
    const before = await earned(page);

    await options(page, 'Stretch').click();
    await dialog(page).getByRole('button', { name: 'Edit Quest' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Quest' });
    await expect(page.getByRole('dialog')).toHaveCount(1); // the options sheet has closed
    await expect(edit.getByLabel('Quest Title')).toHaveValue('Stretch');
    await page.getByLabel('Quest Title').fill('Gentle stretch');
    await page.getByLabel('Description (Optional)').fill('Shoulders and back');
    await page.getByLabel(/Target Steps/).fill('3');
    await edit.getByRole('button', { name: 'Routine' }).click();
    await expect(edit.getByRole('button', { name: 'Routine' })).toHaveAttribute('aria-pressed', 'true');
    await edit.getByRole('button', { name: 'Save Changes' }).click();

    await expect(quest(page, 'Gentle stretch')).toContainText('1/3');
    const edited = (await saved(page)).quests.find((q: { id: string }) => q.id === id);
    expect(edited).toMatchObject({ title: 'Gentle stretch', description: 'Shoulders and back', type: 'routine', target: 3, progress: 1, points: 30 });
    expect(await earned(page)).toEqual(before);
  });

  test('lowering the target below progress shows it done, without earning anything', async ({ page }) => {
    await addCustomQuest(page, 'Steps', 5);
    await tapTimes(page, 'Steps', 3);
    const before = await earned(page);
    await options(page, 'Steps').click();
    await dialog(page).getByRole('button', { name: 'Edit Quest' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Quest' });
    await edit.getByLabel(/Target Steps/).fill('2');
    await edit.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(async () => (await saved(page)).quests.find((q: { title: string }) => q.title === 'Steps')).toMatchObject({ progress: 2, target: 2, completed: true });
    expect(await earned(page)).toEqual(before);
  });

  test('delete asks first (Cancel focused) and keeps everything the quest earned', async ({ page }) => {
    await addCustomQuest(page, 'Journal');
    await tapTimes(page, 'Journal', 1);
    const before = await earned(page);

    await options(page, 'Journal').click();
    await dialog(page).getByRole('button', { name: 'Delete Quest' }).click();
    await expect(dialog(page)).toHaveAccessibleName('Delete this quest?');
    // Focus moves to the question (read out by screen readers), never to Delete.
    await expect(dialog(page).getByRole('heading', { name: 'Delete this quest?' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(quest(page, 'Journal'), 'Enter on the question deletes nothing').toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(quest(page, 'Journal')).toBeVisible();

    await options(page, 'Journal').click();
    await dialog(page).getByRole('button', { name: 'Delete Quest' }).click();
    await dialog(page).getByRole('button', { name: 'Delete Quest' }).click();
    await expect(quest(page, 'Journal')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Everything you earned from it stays yours');
    expect(await earned(page)).toEqual(before);
  });

  test('custom quests share 40 energy a day; deleting and re-adding can\'t get more', async ({ page }) => {
    await addCustomQuest(page, 'Big one', 6);
    await tapTimes(page, 'Big one', 6);
    await expect(page.getByRole('status')).toContainText("today's energy from custom quests");
    let s = await saved(page);
    expect(s.energy).toBe(50 + 40);
    expect(s.daily.customQuestEnergy).toBe(40);
    expect(s.currentStreak, 'still counts for the streak').toBe(1);

    await options(page, 'Big one').click();
    await dialog(page).getByRole('button', { name: 'Delete Quest' }).click();
    await dialog(page).getByRole('button', { name: 'Delete Quest' }).click();
    await addCustomQuest(page, 'Big one again', 4);
    await tapTimes(page, 'Big one again', 4);
    s = await saved(page);
    expect(s.energy).toBe(90);

    await tapTimes(page, 'Morning Routine', 1);
    expect((await saved(page)).energy, 'built-in quests are unaffected').toBe(100);
  });

  test('dialogs are readable in light and dark mode', async ({ page }) => {
    // Reduced motion from the start, so the audit sees settled colors (see contrast.ts).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await waitForApp(page);
    await addCustomQuest(page, 'Read');
    await tapTimes(page, 'Read', 1);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const step of ['menu', 'correct', 'delete', 'edit'] as const) {
        await options(page, 'Read').click();
        if (step === 'correct') await dialog(page).getByRole('button', { name: 'Mark as not done' }).click();
        if (step === 'delete') await dialog(page).getByRole('button', { name: 'Delete Quest' }).click();
        if (step === 'edit') await dialog(page).getByRole('button', { name: 'Edit Quest' }).click();
        await expect(dialog(page)).toHaveCount(1);
        await settle(page);
        expect(await contrastProblems(page), `${scheme} ${step}`).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(dialog(page)).toHaveCount(0);
      }
    }
  });
});

async function openTab(context: BrowserContext) {
  const tab = await context.newPage();
  await tab.goto('/');
  await waitForApp(tab);
  return tab;
}

test.describe('across tabs', () => {
  test('a correction confirmed in two tabs takes off one step, not two', async ({ page, context }) => {
    await tapTimes(page, 'Hydration Goal', 3);
    const other = await openTab(context);
    await expect(quest(other, 'Hydration Goal')).toContainText('3/4');
    for (const tab of [page, other]) {
      await options(tab, 'Hydration Goal').click();
      await dialog(tab).getByRole('button', { name: /Undo one step/ }).click();
    }
    await dialog(page).getByRole('button', { name: 'Undo one step' }).click();
    await expect.poll(async () => (await questIn(page, 'q5')).progress).toBe(2);
    await dialog(other).getByRole('button', { name: 'Undo one step' }).click();
    await expect(other.getByRole('status')).toContainText('nothing to correct');
    expect((await questIn(page, 'q5')).progress).toBe(2);
  });

  test('the energy cap holds when two tabs complete custom quests at once', async ({ page, context }) => {
    await editSave(page, `for (let i = 0; i < 6; i++) state.quests.push({ id: 'c' + i, title: 'Task ' + i, description: '', type: 'custom', completed: false, points: 10, isDaily: true, isCustom: true, progress: 0, target: 1 });`);
    await page.reload();
    await waitForApp(page);
    const other = await openTab(context);
    // Both tabs tap at the same time (each tab one quest after another).
    const tapAll = async (tab: Page, ids: number[]) => {
      for (const i of ids) await tab.getByText(`Task ${i}`, { exact: true }).click();
    };
    await Promise.all([tapAll(page, [0, 2, 4]), tapAll(other, [1, 3, 5])]);
    await expect.poll(async () => (await saved(page)).quests.filter((q: { isCustom?: boolean; completed: boolean }) => q.isCustom && q.completed).length).toBe(6);
    const s = await saved(page);
    expect(s.energy).toBe(50 + 40);
    expect(s.daily.customQuestEnergy).toBe(40);
  });
});

test('an upgraded save keeps today\'s progress rewarded once', async ({ page }) => {
  // A version 8 save with today's quests partly done and energy already earned.
  await editSave(page, `
    state.version = 8;
    delete state.focusSessionsCompleted;
    delete state.daily.questRewards;
    delete state.daily.customQuestEnergy;
    delete state.daily.autoCompletedQuests;
    state.energy = 200;
    state.quests = state.quests.map(q => q.id === 'q5' ? { ...q, progress: 3 } : q.id === 'q2' ? { ...q, progress: 1, completed: true } : q);
    state.goldenScales = 10;
  `);
  await page.reload();
  await waitForApp(page);
  await tapTimes(page, 'Hydration Goal', 1); // only the 4th glass pays
  expect((await saved(page)).version).toBe(9);
  expect((await saved(page)).energy).toBe(205);
  await quest(page, 'Daily Vitality').click();
  await dialog(page).getByRole('button', { name: 'Mark as not done' }).click();
  await expect.poll(async () => (await questIn(page, 'q2')).completed).toBe(false);
  await tapTimes(page, 'Daily Vitality', 1);
  const s = await saved(page);
  expect([s.energy, s.goldenScales]).toEqual([205, 10]);
});

test('Zen Master unlocks at the fifth completed focus session, settled when the app opens', async ({ page }) => {
  await editSave(page, `
    state.focusSessionsCompleted = 4;
    state.focus = { id: 'fifth', status: 'running', durationMs: 600000, remainingMs: 600000, endsAt: Date.now() - 1000 };
  `);
  await page.reload();
  await waitForApp(page);
  await expect.poll(async () => (await saved(page)).focusSessionsCompleted).toBe(5);
  await page.getByRole('button', { name: 'Milestones' }).click();
  const zen = page.getByRole('heading', { name: 'Zen Master' }).locator('..');
  await expect(zen).toContainText('Unlocked!');
  await expect(zen).toContainText('Complete 5 focus sessions.');
  // Reloading settles again, but the session counts once.
  await page.reload();
  await waitForApp(page);
  expect((await saved(page)).focusSessionsCompleted).toBe(5);
});

test.describe('check-in notes', () => {
  test('an optional note is saved privately and shown in Insights as plain text', async ({ page }) => {
    await goToTab(page, 'Check-in');
    const note = page.getByLabel('Note (optional)');
    await expect(note).toHaveAttribute('maxlength', '280');
    await note.fill('Slept better. <b>not bold</b>\nShort walk.');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await expect.poll(async () => (await saved(page)).symptomLogs[0]?.notes).toBe('Slept better. <b>not bold</b>\nShort walk.');

    await page.getByRole('button', { name: 'Insights' }).click();
    const recent = page.getByRole('region', { name: 'Recent Check-ins' });
    await expect(recent).toContainText('Slept better. <b>not bold</b>');
    await expect(recent.locator('b')).toHaveCount(0);
    await expect(recent).toContainText('Energy 3/5 · Mood 3/5');
  });

  test('updating today\'s check-in starts from its note, and a blank note is no note', async ({ page }) => {
    await goToTab(page, 'Check-in');
    await page.getByLabel('Note (optional)').fill('first');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await page.getByRole('button', { name: "Update today's check-in" }).click();
    await expect(page.getByLabel('Note (optional)')).toHaveValue('first');
    await page.getByLabel('Note (optional)').fill('   ');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await expect.poll(async () => 'notes' in (await saved(page)).symptomLogs[0]).toBe(false);
    expect((await saved(page)).symptomLogs).toHaveLength(1);
  });

  test('after reopening the app, editing only the note keeps the saved energy and mood', async ({ page }) => {
    await goToTab(page, 'Check-in');
    const rating = (n: number, group: 'energy' | 'mood') =>
      page.getByRole('button', { name: String(n), exact: true }).nth(group === 'energy' ? 0 : 1);
    await rating(1, 'energy').click();
    await rating(2, 'mood').click();
    await page.getByLabel('Note (optional)').fill('first');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await expect.poll(async () => (await saved(page)).symptomLogs[0]).toMatchObject({ energy: 1, mood: 2, notes: 'first' });

    await page.reload();
    await waitForApp(page);
    await goToTab(page, 'Check-in');
    await page.getByRole('button', { name: "Update today's check-in" }).click();
    await expect(rating(1, 'energy')).toHaveAttribute('aria-pressed', 'true');
    await expect(rating(2, 'mood')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Note (optional)')).toHaveValue('first');
    await page.getByLabel('Note (optional)').fill('first, and a nap');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await expect.poll(async () => (await saved(page)).symptomLogs[0]?.notes).toBe('first, and a nap');
    const s = await saved(page);
    expect(s.symptomLogs).toHaveLength(1);
    expect(s.symptomLogs[0]).toMatchObject({ energy: 1, mood: 2 });
  });

  test("yesterday's check-in form doesn't carry into a new day", async ({ page }) => {
    await page.clock.setFixedTime(lateTonight());
    await openApp(page);
    await waitForApp(page);
    await goToTab(page, 'Check-in');
    await page.getByRole('button', { name: '1', exact: true }).nth(0).click();
    await page.getByLabel('Note (optional)').fill('late night');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await page.getByRole('button', { name: "Update today's check-in" }).click();
    await expect(page.getByLabel('Note (optional)')).toHaveValue('late night');

    await page.clock.setFixedTime(justAfterMidnight());
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // the app's day check
    await expect(page.getByLabel('Note (optional)')).toHaveValue('');
    await expect(page.getByRole('button', { name: '3', exact: true }).nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '3', exact: true }).nth(1)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await expect.poll(async () => (await saved(page)).symptomLogs).toHaveLength(2);
    const [yesterday, today] = (await saved(page)).symptomLogs;
    expect(yesterday).toMatchObject({ energy: 1, notes: 'late night' });
    expect(today).toMatchObject({ energy: 3, mood: 3 });
    expect(today).not.toHaveProperty('notes');
  });

  test('a check-in without a note works as before', async ({ page }) => {
    await goToTab(page, 'Check-in');
    await page.getByRole('button', { name: 'Log Check-in' }).click();
    await expect(page.getByRole('heading', { name: 'Check-in saved!' })).toBeVisible();
    await expect(page.getByText("Thanks for taking a moment to see how you're feeling today. ❤️")).toBeVisible();
    await expect(page.getByText(/doctor/)).toHaveCount(0);
    const s = await saved(page);
    expect(s.symptomLogs[0]).not.toHaveProperty('notes');
    expect(s.energy).toBe(55);
  });
});
