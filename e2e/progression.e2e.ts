import { expect, openApp, readSave, test, waitForApp } from './fixtures';

test('evolution, Bond, and streak are shown and update after a meaningful activity', async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  const stats = page.locator('main > div').first();
  await expect(stats).toContainText('0 / 2 days');
  await expect(stats).toContainText('0 lifetime active days');
  await expect(stats).toContainText(/Bond Lv 1/i);

  await page.getByText('Morning Routine').click();
  await expect(stats).toContainText('1 / 2 days');
  await expect(stats).toContainText('1 lifetime active day');
  await expect(page.getByText('Today counts!', { exact: false })).toBeVisible();
  const state = (await readSave(page))!.state;
  expect(state.currentStreak).toBe(1);
  expect(state.activity.days).toHaveLength(1);
});

test('player-facing text says Bond, never growth', async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.getByText('Bond-earning sessions left today', { exact: false })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/growth/i);
});
