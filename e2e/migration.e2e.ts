import { LEGACY_KEY, expect, openApp, readSave, statValue, test, waitForApp } from './fixtures';

const today = () => new Date().toDateString();

test('a legacy localStorage save migrates into IndexedDB once and the backup is untouched', async ({ page }) => {
  const legacy = JSON.stringify({
    version: 6, dragonName: 'Ember', stage: 'Hatchling', energy: 77, goldenScales: 33, bond: { legacy: 40 },
    activity: { days: [], legacy: [{ floor: 2, before: '2000-01-01' }] }, lastLogin: today(),
    isNapping: false, quests: [], symptomLogs: [], inventory: [], equipped: {}, badges: [], petCount: 0,
    customQuestTypes: [], currentStreak: 0, bestStreak: 0,
  });
  await openApp(page, { legacy });
  await waitForApp(page);

  const record = await readSave(page);
  expect(record?.migratedFromLocalStorage).toBe(true);
  expect(record?.state.goldenScales).toBe(33);
  await expect(statValue(page, 'Energy')).toHaveText('77');
  expect(await page.evaluate(k => localStorage.getItem(k), LEGACY_KEY)).toBe(legacy);

  // Reloading reads IndexedDB; it doesn't migrate the backup again.
  await page.getByRole('button', { name: 'Pet Ember' }).click(); // a Hatchling, so "Pet" rather than the egg's "Clean & Hydrate"
  await expect.poll(async () => (await readSave(page))?.state.petCount).toBe(1);
  await page.reload();
  await waitForApp(page);
  expect((await readSave(page))?.state.petCount).toBe(1);
  expect(await page.evaluate(k => localStorage.getItem(k), LEGACY_KEY)).toBe(legacy);
});

test('an original (unversioned) save is recognized and migrated with its progress', async ({ page }) => {
  await openApp(page, {
    legacy: JSON.stringify({
      dragonName: 'Ember', stage: 'Fledgling', energy: 140, goldenScales: 61, growthProgress: 48,
      lastLogin: today(), isNapping: false, quests: [], symptomLogs: [], inventory: ['scarf_red'],
      equipped: {}, badges: [], petCount: 4,
    }),
  });
  await waitForApp(page);
  const record = await readSave(page);
  expect(record?.state.stage).toBe('Fledgling');
  expect(record?.state.goldenScales).toBe(61);
  expect(record?.state.inventory).toEqual(['scarf_red']);
});

test('with no legacy save, a new player starts normally', async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  const record = await readSave(page);
  expect(record?.migratedFromLocalStorage).toBe(false);
  expect(record?.legacySaveUnreadable).toBeUndefined();
  await expect(statValue(page, 'Energy')).toHaveText('50');
});
