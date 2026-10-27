import type { Page } from '@playwright/test';
import { editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';

// A crafted save with "__proto__" as a quest id and as a reward-ledger key
// (privacy audit finding): it loads as ordinary data, the quest pays a normal,
// finite reward, and the same holds after a reset and a backup restore.
// Synthetic data only.

const saved = async (page: Page) => (await readSave(page))!.state;

async function plantHostileSave(page: Page) {
  await editSave(page, `
    state.quests.push({ id: '__proto__', title: 'Stretch gently', description: '', type: 'custom', completed: false, points: 30, isDaily: true, isCustom: true, progress: 0, target: 3 });
    state.daily.questRewards = JSON.parse('{"__proto__":{"q1":{"energy":999,"growth":999,"scales":999}}}');
  `);
  await page.reload();
  await waitForApp(page);
}

/** Taps a quest once; returns the energy it paid. */
async function tap(page: Page, title: string) {
  const before = await saved(page);
  await page.getByText(title, { exact: true }).click();
  await expect.poll(async () => (await saved(page)).energy).not.toBe(before.energy);
  return (await saved(page)).energy - before.energy;
}

test('a crafted "__proto__" quest and ledger key load as ordinary data, pay a normal reward, and survive reset and backup restore', async ({ page }) => {
  test.slow();
  await openApp(page);
  await waitForApp(page);
  await plantHostileSave(page);

  const paid = await tap(page, 'Stretch gently');
  expect(Number.isFinite(paid), `paid ${paid}`).toBe(true);
  expect(paid).toBeGreaterThan(0);
  expect(Number.isFinite((await saved(page)).energy)).toBe(true);
  expect(await tap(page, 'Morning Routine'), 'a crafted ledger entry changes no other quest').toBe(10);
  const polluted = await page.evaluate(() => ({ object: ({} as { q1?: unknown }).q1 ?? null }));
  expect(polluted).toEqual({ object: null });

  // Reset (the save is kept as a backup), then restore it: still ordinary data.
  const beforeReset = await saved(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await saved(page)).quests.some((q: { id: string }) => q.id === '__proto__')).toBe(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Restore a backup/ }).click();
  const backups = page.getByRole('dialog').filter({ has: page.locator('#save-dialog-title') });
  await backups.getByRole('button', { name: /Replaced by a reset/ }).click();
  await backups.getByRole('button', { name: 'Restore This Backup' }).click();
  await expect.poll(async () => (await saved(page)).energy).toBe(beforeReset.energy);
  await page.reload();
  await waitForApp(page);
  const restored = await saved(page);
  expect(Number.isFinite(restored.energy)).toBe(true);
  expect(await tap(page, 'Stretch gently'), 'the restored quest still pays normally').toBeGreaterThan(0);
});
