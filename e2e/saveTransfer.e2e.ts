import { readFile } from 'node:fs/promises';
import type { BrowserContext, Page } from '@playwright/test';
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
  await expect(dialog.getByRole('note')).toContainText('less progress');
  await expect(dialog.getByRole('note')).toContainText('an earlier stage (Egg instead of Drake)');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(saveDialog(page)).toHaveCount(0);
  expect((await readSave(page))!.rev, 'nothing was written').toBe(rev);
  expect((await saved(page)).stage).toBe('Drake');
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
