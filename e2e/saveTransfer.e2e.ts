import { readFile } from 'node:fs/promises';
import type { BrowserContext, Page } from '@playwright/test';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { bondOf, editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';

// Save export, import and backups (#32): nothing is ever replaced without a
// confirmation, the replaced save is always kept, and a bad file changes nothing.

const settings = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Settings' });
};
const saveDialog = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('#save-dialog-title') });
const saved = async (page: Page) => (await readSave(page))!.state;

/** Exports through Settings and returns the downloaded file's text. */
async function exportSave(page: Page) {
  const sheet = await settings(page);
  const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Export save' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^ember-save-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  const text = await readFile((await download.path())!, 'utf8');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  return text;
}

/** Picks a file in Settings → Import save… (the dialog that follows is returned). */
async function importText(page: Page, text: string, name = 'ember-save.json') {
  const sheet = await settings(page);
  await sheet.getByLabel('Choose a save file to import').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(saveDialog(page)).toBeVisible();
  return saveDialog(page);
}

/** Real progress: a Drake with Bond, scales, a streak, a check-in note and a custom quest. */
async function makeProgress(page: Page) {
  await editSave(page, `
    state.stage = 'Drake';
    state.bond = { other: 120 };
    state.goldenScales = 77;
    state.currentStreak = 4; state.bestStreak = 9;
    state.activity = { days: ['2026-10-01', '2026-10-02'], legacy: [{ floor: 40, before: '2026-10-01' }] };
    state.symptomLogs = [{ date: new Date().toISOString(), energy: 2, mood: 4, notes: 'Slept better' }];
    state.quests.push({ id: 'custom_1', title: 'Stretch', description: '', type: 'custom', completed: false, points: 30, isDaily: true, isCustom: true, progress: 1, target: 3 });
    state.inventory = ['hat_wizard'];
  `);
  await page.reload();
  await waitForApp(page);
}

const essentials = (s: Record<string, any>) => ({
  stage: s.stage,
  bond: bondOf(s),
  goldenScales: s.goldenScales,
  bestStreak: s.bestStreak,
  activity: s.activity,
  notes: s.symptomLogs.map((l: { notes?: string }) => l.notes),
  custom: s.quests.filter((q: { isCustom?: boolean }) => q.isCustom).map((q: { title: string; progress: number }) => [q.title, q.progress]),
  inventory: s.inventory,
});

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('export, reset, import: everything comes back, and the reset save is kept as a backup', async ({ page }) => {
  await makeProgress(page);
  const before = essentials(await saved(page));
  const file = await exportSave(page);
  expect(JSON.parse(file)).toMatchObject({ format: 'ember-save', formatVersion: 1, saveVersion: 9 });

  const sheet = await settings(page);
  await sheet.getByRole('button', { name: 'Reset progress…' }).click();
  await expect(page.getByRole('dialog', { name: 'Reset Progress?' })).toContainText('kept as a backup');
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');

  const dialog = await importText(page, file);
  await expect(dialog).toHaveAccessibleName('Replace your save?');
  await expect(dialog.getByRole('button', { name: 'Cancel' }), 'the safe choice is focused').toBeFocused();
  await expect(dialog.getByRole('row', { name: /Dragon/ })).toContainText('Ember, Egg');
  await expect(dialog.getByRole('row', { name: /Dragon/ })).toContainText('Ember, Drake');
  await dialog.getByRole('button', { name: 'Replace My Save' }).click();
  await expect(saveDialog(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Save imported');
  await expect.poll(async () => essentials(await saved(page))).toEqual(before);

  // Both replaced saves (the reset one and the pre-import egg) are restorable.
  const sheet2 = await settings(page);
  await expect(sheet2.getByRole('button', { name: /Restore a backup/ })).toContainText('2');
});

test('a file with less progress warns before replacing, and Cancel changes nothing', async ({ page }) => {
  const egg = await exportSave(page);
  await makeProgress(page);
  const rev = (await readSave(page))!.rev;
  const dialog = await importText(page, egg);
  const note = dialog.getByRole('note');
  await expect(note).toContainText("The file doesn't have everything that's on this device");
  // Briefly: the most personal first, the rest one tap away.
  await expect(note.locator('[data-loss]:visible')).toHaveText(['1 check-in (1 with a note)', 'the Drake stage (it has Egg)', 'your 4-day streak (it has 0)']);
  await expect(note.getByText('your Tiny Wizard Hat')).toBeHidden();
  await note.getByText(/^Show \d+ more$/).click();
  await expect(note.getByText('your Tiny Wizard Hat')).toBeVisible();
  await expect(note).toContainText('kept as a backup in this browser');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(saveDialog(page)).toHaveCount(0);
  expect((await readSave(page))!.rev, 'nothing was written').toBe(rev);
  expect((await saved(page)).stage).toBe('Drake');
});

test('a save with a shorter streak, a missing check-in, or an older version of a note warns about exactly that', async ({ page }) => {
  await makeProgress(page); // a 4-day streak and one check-in noted "Slept better"
  // The older save: a 2-day streak, and that check-in before its note was written.
  await editSave(page, 'state.currentStreak = 2; delete state.symptomLogs[0].notes;');
  await page.reload();
  await waitForApp(page);
  const older = await exportSave(page);
  // Since then: a 6-day streak, the note, and another check-in with a note. Nothing else changed.
  await editSave(page, `
    state.currentStreak = 6;
    state.symptomLogs[0].notes = 'Slept better';
    state.symptomLogs.push({ date: new Date(Date.now() + 60_000).toISOString(), energy: 3, mood: 3, notes: 'Called Mum' });
  `);
  await page.reload();
  await waitForApp(page);
  const rev = (await readSave(page))!.rev;

  const dialog = await importText(page, older);
  // The comparison counts the same check-ins either way; the warning says what really differs.
  await expect(dialog.getByRole('row', { name: /Streak/ })).toContainText('6 (9)');
  const note = dialog.getByRole('note');
  await expect(note.locator('[data-loss]')).toHaveText([
    '1 check-in (1 with a note)',
    "this device's notes or ratings for 1 check-in",
    'your 6-day streak (it has 2)',
  ]);
  await expect(note.getByText(/Show \d+ more/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await readSave(page))!.rev, 'nothing was written').toBe(rev);
});

test('the save dialogs and Settings explain what backups can and cannot protect against', async ({ page }) => {
  await makeProgress(page);
  const file = await exportSave(page);
  const limits = /up to 3 replaced saves in this browser.*site data deletes them.*exported file is a separate copy/;
  const sheet = await settings(page);
  await expect(sheet.locator('#your-save-description')).toContainText(/keeps up to 3 earlier ones here.*clearing the browser's site data deletes them all.*Export a copy to keep one separately/);
  await page.getByRole('button', { name: 'Close settings' }).click();

  const confirm = await importText(page, file);
  await expect(confirm.locator('[data-backup-limits]')).toHaveText(limits);
  await confirm.getByRole('button', { name: 'Replace My Save' }).click();
  await expect(page.getByRole('status')).toContainText('imported');
  await (await settings(page)).getByRole('button', { name: /Restore a backup/ }).click();
  await expect(saveDialog(page).locator('[data-backup-limits]')).toHaveText(limits);
});

test('the current save can be downloaded from the import confirmation first', async ({ page }) => {
  await makeProgress(page);
  const file = await exportSave(page);
  const dialog = await importText(page, file);
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download current save first' }).click()]);
  const current = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(current.state.stage).toBe('Drake');
  await expect(saveDialog(page), 'still asking').toBeVisible();
});

for (const [name, text, message] of [
  ['not a save at all', 'hello', "isn't an Ember save"],
  ['some other JSON', '{"name":"not ember"}', "isn't an Ember save"],
  ['an edited save', null, 'changed or damaged'],
  ['a save from a newer Ember', 'newer', 'newer version of Ember'],
] as const) {
  test(`refuses ${name} and changes nothing`, async ({ page }) => {
    await makeProgress(page);
    let content: string = text ?? '';
    if (text === null || text === 'newer') {
      const file = JSON.parse(await exportSave(page));
      if (text === null) file.state.goldenScales = 999999;
      else file.saveVersion = 99;
      content = JSON.stringify(file);
    }
    const rev = (await readSave(page))!.rev;
    const dialog = await importText(page, content);
    await expect(dialog).toHaveAccessibleName("Can't use that file");
    await expect(dialog).toContainText(message);
    await expect(dialog).toContainText("wasn't changed");
    await dialog.getByRole('button', { name: 'OK' }).click();
    expect((await readSave(page))!.rev).toBe(rev);
    expect((await saved(page)).stage).toBe('Drake');
  });
}

test('restoring a backup brings the replaced save back (and keeps the other one)', async ({ page }) => {
  await makeProgress(page);
  const sheet = await settings(page);
  await expect(sheet.getByRole('button', { name: /Restore a backup/ }), 'no backups yet').toHaveCount(0);
  await sheet.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');

  const sheet2 = await settings(page);
  await sheet2.getByRole('button', { name: /Restore a backup/ }).click();
  const dialog = saveDialog(page);
  await expect(dialog).toHaveAccessibleName('Restore a backup');
  await dialog.getByRole('button', { name: /Replaced by a reset/ }).click();
  await expect(dialog).toHaveAccessibleName('Restore this backup?');
  await dialog.getByRole('button', { name: 'Restore This Backup' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Drake');
  await expect(page.getByRole('status')).toContainText('Backup restored');
});

async function openTab(context: BrowserContext) {
  const tab = await context.newPage();
  await tab.goto('/');
  await waitForApp(tab);
  return tab;
}

test('a confirmation reviewed before another tab saved progress replaces nothing', async ({ page, context }) => {
  const egg = await exportSave(page);
  const dialog = await importText(page, egg);
  const other = await openTab(context);
  await other.getByText('Morning Routine').click(); // progress in another tab, after the review
  await expect.poll(async () => (await saved(page)).energy).toBe(60);
  await dialog.getByRole('button', { name: 'Replace My Save' }).click();
  await expect(saveDialog(page)).toHaveAccessibleName('Your save changed');
  expect((await saved(page)).energy, "the other tab's progress is kept").toBe(60);
});

test('an import in one tab shows up in the other', async ({ page, context }) => {
  await makeProgress(page);
  const file = await exportSave(page);
  await editSave(page, "state.stage = 'Hatchling'; state.goldenScales = 1;");
  await page.reload();
  await waitForApp(page);
  const other = await openTab(context);
  const dialog = await importText(page, file);
  await dialog.getByRole('button', { name: 'Replace My Save' }).click();
  await expect(other.getByRole('heading', { name: 'Drake', exact: true })).toBeVisible();
});

// --- Interrupted imports and full-fidelity round trips (Phase E) ---

/** The backups list as stored (raw IndexedDB). */
const storedBackups = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>(resolve => {
        const open = indexedDB.open('ember');
        open.onsuccess = () => {
          const get = open.result.transaction('saves').objectStore('saves').get('backups');
          get.onsuccess = () => {
            open.result.close();
            resolve(Array.isArray(get.result) ? get.result.length : 0);
          };
        };
      }),
  );

test('a write failure in the middle of an import changes nothing, and the import can simply be retried', async ({ page }) => {
  await makeProgress(page);
  const file = await exportSave(page);
  await editSave(page, "state.stage = 'Hatchling'; state.goldenScales = 5;");
  await page.reload();
  await waitForApp(page);
  const before = (await readSave(page))!;
  const dialog = await importText(page, file);
  // The next IndexedDB write fails, the way a full disk or a browser error would.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      IDBObjectStore.prototype.put = put;
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    } as typeof put;
  });
  await dialog.getByRole('button', { name: 'Replace My Save' }).click();
  await expect(saveDialog(page)).toHaveAccessibleName("Couldn't finish");
  await expect(saveDialog(page)).toContainText("wasn't changed");
  const after = (await readSave(page))!;
  expect([after.rev, after.state.stage, after.state.goldenScales]).toEqual([before.rev, 'Hatchling', 5]);
  expect(await storedBackups(page), 'no half-written backup').toBe(0);

  await saveDialog(page).getByRole('button', { name: 'OK' }).click();
  await expect(saveDialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close settings' }).click(); // still open underneath
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await (await importText(page, file)).getByRole('button', { name: 'Replace My Save' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Drake');
  expect(await storedBackups(page)).toBe(1);
});

test('closing the page while the confirmation is open changes nothing', async ({ page }) => {
  await makeProgress(page);
  const file = await exportSave(page);
  await editSave(page, "state.goldenScales = 5;");
  await page.reload();
  await waitForApp(page);
  const before = (await readSave(page))!;
  await importText(page, file);
  await page.reload(); // the player closes or reloads instead of answering
  await waitForApp(page);
  const after = (await readSave(page))!;
  expect([after.rev, after.state.goldenScales]).toEqual([before.rev, 5]);
  expect(await storedBackups(page)).toBe(0);
});

test('reloading right after confirming leaves either the old save or the new one, never a mix', async ({ page }) => {
  await makeProgress(page);
  const file = await exportSave(page);
  await editSave(page, "state.stage = 'Hatchling'; state.goldenScales = 5;");
  await page.reload();
  await waitForApp(page);
  const dialog = await importText(page, file);
  await dialog.getByRole('button', { name: 'Replace My Save' }).click({ noWaitAfter: true });
  await page.evaluate(() => location.reload());
  await waitForApp(page);
  const s = await saved(page);
  const backups = await storedBackups(page);
  const old = s.stage === 'Hatchling' && s.goldenScales === 5 && backups === 0;
  const replaced = s.stage === 'Drake' && s.goldenScales === 77 && backups === 1;
  expect(old || replaced, JSON.stringify({ stage: s.stage, scales: s.goldenScales, backups })).toBe(true);
});

test('every field of the save survives export and import exactly', async ({ page }) => {
  await makeProgress(page);
  // Fill in the rest of the save: theme, cosmetics, quests in progress, a focus history, badges.
  await editSave(page, `
    state.theme = 'dark'; state.themeColor = '#F5F3FF';
    state.equipped = { hat: 'hat_wizard' }; state.petCount = 12;
    state.focusSessionsCompleted = 7; state.completedFocusSessions = ['f1', 'f2'];
    state.customQuestTypes = [{ id: 'type_1', label: 'Hobbies', icon: 'Star', color: 'text-amber-500 bg-amber-50' }];
    state.badges = state.badges.map(b => b.id === 'badge_focus_5' ? { ...b, unlockedAt: '2026-10-20T09:00:00.000Z' } : b);
  `);
  await page.reload();
  await waitForApp(page);
  await page.getByText('Hydration Goal').click(); // today's reward ledger too
  await expect.poll(async () => (await saved(page)).daily.questRewards?.q5?.energy).toBe(5);
  const file = JSON.parse(await exportSave(page));

  const sheet = await settings(page);
  await sheet.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');
  await (await importText(page, JSON.stringify(file))).getByRole('button', { name: 'Replace My Save' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Drake');

  const { deviceId: _thisDevice, ...restored } = await saved(page);
  expect(restored).toEqual(file.state);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`every save dialog meets WCAG AA contrast in ${scheme} mode, with reduced motion`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const egg = await exportSave(page);
    await makeProgress(page); // reloads, so reduced motion is in place from the start
    const expectReadable = async (screen: string) => {
      await settle(page);
      expect(await contrastProblems(page), `${scheme} ${screen}`).toEqual([]);
      expect(await lightPanelsInDarkMode(page), `${scheme} ${screen}`).toEqual([]);
    };

    const sheet = await settings(page);
    await sheet.locator('[data-version]').scrollIntoViewIfNeeded();
    await expectReadable('Settings (Your save, This device)');
    await page.getByRole('button', { name: 'Close settings' }).click();

    const confirm = await importText(page, egg);
    await expect(confirm.getByRole('note')).toBeVisible();
    await expectReadable('import confirmation with loss warning');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(saveDialog(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Close settings' }).click();

    const problem = await importText(page, '{"format":"something-else"}');
    await expect(problem).toHaveAccessibleName("Can't use that file");
    await expectReadable('import problem');
    await problem.getByRole('button', { name: 'OK' }).click();
    await expect(saveDialog(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset progress…' }).click();
    await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
    await expect.poll(async () => (await saved(page)).stage).toBe('Egg');
    await (await settings(page)).getByRole('button', { name: /Restore a backup/ }).click();
    const backups = saveDialog(page);
    await expect(backups).toHaveAccessibleName('Restore a backup');
    await expectReadable('backups list');
    await backups.getByRole('button', { name: /Replaced by a reset/ }).click();
    await expect(backups).toHaveAccessibleName('Restore this backup?');
    await expectReadable('restore confirmation');
  });
}

/** Records whether the evolution banner ever shows (it only stays 1.5s, so a retrying check would wait it out). */
const watchForEvolutionBanner = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { evolutionShown: number };
    w.evolutionShown = 0;
    new MutationObserver(() => {
      if (document.body.textContent?.includes('Evolution Milestone!')) w.evolutionShown++;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
const evolutionShown = (page: Page) => page.evaluate(() => (window as unknown as { evolutionShown: number }).evolutionShown);

test("replacing the save (reset, import, restore) isn't celebrated as an evolution", async ({ page }) => {
  await makeProgress(page);
  const drake = await exportSave(page);
  await watchForEvolutionBanner(page);
  const sheet = await settings(page);
  await sheet.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect(page.getByRole('status')).toContainText('back to a new egg');
  expect(await evolutionShown(page), 'after a reset').toBe(0);

  await (await importText(page, drake)).getByRole('button', { name: 'Replace My Save' }).click();
  await expect(page.getByRole('status')).toContainText('imported');
  await expect.poll(async () => (await saved(page)).stage).toBe('Drake');
  expect(await evolutionShown(page), 'after an import').toBe(0);

  await (await settings(page)).getByRole('button', { name: /Restore a backup/ }).click();
  await saveDialog(page).getByRole('button', { name: /Replaced by an import/ }).click();
  await saveDialog(page).getByRole('button', { name: 'Restore This Backup' }).click();
  await expect(page.getByRole('status')).toContainText('Backup restored');
  expect(await evolutionShown(page), 'after a restore').toBe(0);
});

test("a reset in another tab isn't celebrated as an evolution here", async ({ page, context }) => {
  await makeProgress(page);
  await watchForEvolutionBanner(page);
  const other = await openTab(context);
  await other.getByRole('button', { name: 'Settings', exact: true }).click();
  await other.getByRole('button', { name: 'Reset progress…' }).click();
  await other.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect(other.getByRole('status')).toContainText('back to a new egg');
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');
  await page.waitForTimeout(500); // the change arrives here a moment later
  expect(await evolutionShown(page)).toBe(0);
});

test('a restore reviewed before another tab saved progress replaces nothing', async ({ page, context }) => {
  await makeProgress(page);
  await (await settings(page)).getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).stage).toBe('Egg');
  await (await settings(page)).getByRole('button', { name: /Restore a backup/ }).click();
  await saveDialog(page).getByRole('button', { name: /Replaced by a reset/ }).click();
  await expect(saveDialog(page)).toHaveAccessibleName('Restore this backup?');

  const other = await openTab(context);
  await other.getByText('Hydration Goal').click(); // progress, saved from the other tab
  await expect.poll(async () => (await saved(page)).daily.questRewards?.q5?.energy).toBe(5);
  const rev = (await readSave(page))!.rev;
  await saveDialog(page).getByRole('button', { name: 'Restore This Backup' }).click();
  await expect(saveDialog(page)).toHaveAccessibleName('Your save changed');
  expect((await readSave(page))!.rev, 'nothing was written').toBe(rev);
  expect((await saved(page)).stage).toBe('Egg');
});

test('the import confirmation is a labelled modal: focus starts on Cancel, stays inside, and Escape writes nothing', async ({ page }) => {
  const egg = await exportSave(page);
  await makeProgress(page);
  const rev = (await readSave(page))!.rev;
  const dialog = await importText(page, egg);
  await expect(dialog).toHaveAccessibleName('Replace your save?');
  await expect(dialog).toHaveAccessibleDescription(/.+/);
  await expect(dialog.getByRole('button', { name: 'Cancel' }), 'the safe choice has focus').toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(d => d.contains(document.activeElement)), 'focus stays in the dialog').toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(saveDialog(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Settings' }), 'back where the player was').toBeVisible();
  expect((await readSave(page))!.rev, 'nothing was written').toBe(rev);
});
