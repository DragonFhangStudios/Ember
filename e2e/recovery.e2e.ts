import type { Page } from '@playwright/test';
import { LEGACY_KEY, expect, openApp, readSave, test, waitForApp } from './fixtures';

const FAIL_FLAG = 'e2e:failLegacyRead';

/** Makes reading the legacy save throw (like blocked storage) while the flag is set. */
async function simulateBlockedLegacyRead(page: Page) {
  await page.addInitScript(
    ([key, flag]) => {
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (this: Storage, name: string) {
        if (name === key && getItem.call(this, flag) === '1') throw new DOMException('The operation is insecure.', 'SecurityError');
        return getItem.call(this, name);
      };
    },
    [LEGACY_KEY, FAIL_FLAG] as const,
  );
}

const rawLegacy = (page: Page) =>
  page.evaluate(([key, flag]) => {
    const previous = localStorage.getItem(flag);
    localStorage.removeItem(flag);
    const value = localStorage.getItem(key);
    if (previous !== null) localStorage.setItem(flag, previous);
    return value;
  }, [LEGACY_KEY, FAIL_FLAG] as const);

async function expectRecoveryWithNothingCreated(page: Page, original: string) {
  await expect(page.getByText("We couldn't read your Ember save")).toBeVisible();
  await expect(page.getByText('Daily Quests')).toHaveCount(0);
  expect(await readSave(page)).toBeUndefined();
  expect(await rawLegacy(page)).toBe(original);
}

const retry = (page: Page) => page.getByRole('button', { name: 'Try again' }).click();

test('a transient storage error shows recovery, creates nothing, and a retry migrates the real save', async ({ page }) => {
  const legacy = JSON.stringify({ version: 6, stage: 'Fledgling', energy: 140, goldenScales: 61, lastLogin: new Date().toDateString(), quests: [] });
  await simulateBlockedLegacyRead(page);
  await page.addInitScript(([key, value, flag]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(flag, '1');
    }
  }, [LEGACY_KEY, legacy, FAIL_FLAG] as const);
  await page.goto('/');
  await expectRecoveryWithNothingCreated(page, legacy);

  await retry(page); // still failing: still safe
  await expectRecoveryWithNothingCreated(page, legacy);

  await page.evaluate(flag => localStorage.removeItem(flag), FAIL_FLAG);
  await retry(page);
  await waitForApp(page);
  const record = await readSave(page);
  expect(record?.migratedFromLocalStorage).toBe(true);
  expect(record?.state.stage).toBe('Fledgling');
  expect(record?.state.goldenScales).toBe(61);
});

for (const [label, value] of [
  ['corrupt JSON', '{"version":6,"energy":14'],
  ['JSON that is not an object', '"hello"'],
  ['an empty object', '{}'],
  ['an unrelated object', '{"unrelated":true}'],
] as const) {
  test(`${label} enters recovery instead of becoming a new save`, async ({ page }) => {
    await openApp(page, { legacy: value });
    await expectRecoveryWithNothingCreated(page, value);
    await retry(page);
    await expectRecoveryWithNothingCreated(page, value);
  });
}

test('starting fresh needs confirmation, is recorded, and keeps the old data as a backup', async ({ page }) => {
  const corrupt = '{"version":6,"energy":14';
  await openApp(page, { legacy: corrupt });
  await expectRecoveryWithNothingCreated(page, corrupt);

  await page.getByRole('button', { name: /Start a new save instead/ }).click();
  await expect(page.getByText('Your old save is not deleted', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await readSave(page)).toBeUndefined();

  await page.getByRole('button', { name: /Start a new save instead/ }).click();
  await page.getByRole('button', { name: 'Yes, start a new save' }).click();
  await waitForApp(page);
  const record = await readSave(page);
  expect(record?.legacySaveUnreadable).toBe(true);
  expect(record?.state.goldenScales).toBe(0);
  expect(await rawLegacy(page)).toBe(corrupt);
});
