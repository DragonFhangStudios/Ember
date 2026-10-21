import { expect, openApp, readSave, test, waitForApp } from './fixtures';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('a failed save changes nothing, says so, and a retry succeeds', async ({ page }) => {
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      IDBObjectStore.prototype.put = put; // fail once
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    } as typeof put;
  });
  await page.getByText('Morning Routine').click();
  await expect(page.getByText("couldn't save that just now", { exact: false })).toBeVisible();
  const saved = (await readSave(page))!.state;
  expect(saved.energy).toBe(50);
  expect(saved.quests.find((q: any) => q.id === 'q1').completed).toBe(false);
  await expect(page.locator('h3', { hasText: 'Morning Routine' })).not.toHaveClass(/line-through/);

  await page.getByText('Morning Routine').click();
  await expect.poll(async () => (await readSave(page))?.state.energy).toBe(60);
  await expect(page.getByText("couldn't save", { exact: false })).toHaveCount(0);
});

test('a failed cross-tab notification is not reported as a failed save', async ({ page }) => {
  await page.evaluate(() => {
    BroadcastChannel.prototype.postMessage = function () {
      throw new DOMException('BroadcastChannel is closed.', 'InvalidStateError');
    };
  });
  await page.getByText('Clean & Hydrate').click();
  await expect.poll(async () => (await readSave(page))?.state.petCount).toBe(1);
  await expect(page.getByText('You carefully clean the shell', { exact: false })).toBeVisible();
  await expect(page.getByText("couldn't save", { exact: false })).toHaveCount(0);
});
