import type { Page } from '@playwright/test';
import { editSave, expect, goToTab, openApp, test, waitForApp } from './fixtures';

// Privacy hygiene (#32): the app makes no third-party requests. Images and
// fonts are bundled, and it stays fully usable with every outside host blocked.

const isLocal = (url: string) => {
  const { protocol, hostname } = new URL(url);
  return protocol === 'data:' || protocol === 'blob:' || hostname === 'localhost' || hostname === '127.0.0.1';
};

/** Blocks every outside host and records what the page tried to reach. */
async function blockOutside(page: Page) {
  const attempted: string[] = [];
  await page.context().route(url => !isLocal(url.toString()), route => {
    attempted.push(route.request().url());
    return route.abort();
  });
  return attempted;
}

test('no third-party requests on any screen or dialog, and everything still works', async ({ page }) => {
  const attempted = await blockOutside(page);
  await openApp(page);
  await waitForApp(page);
  // Hatched, with every cosmetic owned and some equipped, so their images show too.
  await editSave(page, "state.stage = 'Drake'; state.goldenScales = 1000; state.inventory = ['hat_wizard','hat_crown','scarf_red','nest_moss','nest_cloud']; state.equipped = { hat: 'hat_crown', scarf: 'scarf_red', nest: 'nest_moss' };");
  await page.reload();
  await waitForApp(page);

  // Every image on screen loaded (from this app), and none is broken.
  const images = page.locator('img');
  await expect.poll(() => images.evaluateAll(imgs => imgs.every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);

  await page.getByText('Morning Routine').click();
  await expect(page.getByRole('status')).toContainText('Today counts');
  // The Shop is hidden for the alpha; wardrobe.e2e.ts checks its pictures are local.
  for (const tab of ['Focus', 'Check-in'] as const) await goToTab(page, tab);
  await expect(page.getByRole('heading', { name: 'Daily Check-in' })).toBeVisible();
  await expect.poll(() => images.evaluateAll(imgs => imgs.every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await goToTab(page, 'Check-in');
  await page.getByRole('button', { name: 'Log Check-in' }).click();
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Health Insights' })).toBeVisible();
  await page.getByRole('button', { name: 'Milestones' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await goToTab(page, 'Home');
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await expect(page.getByRole('dialog', { name: 'Add Custom Quest' })).toBeVisible();
  await page.keyboard.press('Escape');

  expect(attempted, 'third-party requests').toEqual([]);
});

test('fonts are bundled: both families load with outside hosts blocked', async ({ page }) => {
  const attempted = await blockOutside(page);
  await openApp(page);
  await waitForApp(page);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([document.fonts.load('400 16px "Inter Variable"'), document.fonts.load('700 24px "Cormorant Garamond"')]);
    return {
      inter: document.fonts.check('400 16px "Inter Variable"'),
      cormorant: document.fonts.check('700 24px "Cormorant Garamond"'),
      faces: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family),
    };
  });
  expect(loaded.inter).toBe(true);
  expect(loaded.cormorant).toBe(true);
  expect(loaded.faces.join(' ')).toMatch(/Inter Variable/);
  expect(loaded.faces.join(' ')).toMatch(/Cormorant Garamond/);
  expect(attempted).toEqual([]);
});
