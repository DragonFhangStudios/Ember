import { LEGACY_KEY, expect, readSave, statValue, test, waitForApp } from './fixtures';

const BLOCK_FLAG = 'e2e:blockIndexedDB';

test('without IndexedDB, Ember shows a read-only preview with retry, and never saves', async ({ page }) => {
  const legacy = JSON.stringify({ version: 6, stage: 'Egg', energy: 64, goldenScales: 9, lastLogin: new Date().toDateString(), quests: [], badges: [] });
  await page.addInitScript(([key, value, flag]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(flag, '1');
    }
    const real = indexedDB;
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        open: (...args: Parameters<IDBFactory['open']>) => {
          if (localStorage.getItem(flag) === '1') throw new DOMException('Storage is blocked.', 'SecurityError');
          return real.open(...args);
        },
        deleteDatabase: (...args: Parameters<IDBFactory['deleteDatabase']>) => real.deleteDatabase(...args),
      },
    });
  }, [LEGACY_KEY, legacy, BLOCK_FLAG] as const);
  await page.goto('/');

  await expect(page.getByText("Preview mode: progress can't be saved right now")).toBeVisible();
  await expect(statValue(page, 'Energy')).toHaveText('64');

  await page.getByText('Clean & Hydrate').click();
  await expect(page.getByText("Preview mode: that wasn't saved.")).toBeVisible();
  await expect(statValue(page, 'Energy')).toHaveText('64');
  expect(await page.evaluate(k => localStorage.getItem(k), LEGACY_KEY)).toBe(legacy);

  await page.evaluate(flag => localStorage.removeItem(flag), BLOCK_FLAG);
  await page.getByRole('button', { name: 'Try again' }).click();
  await waitForApp(page);
  await expect(page.getByText('Preview mode: progress', { exact: false })).toHaveCount(0);
  await expect.poll(async () => (await readSave(page))?.state.goldenScales).toBe(9);
});
