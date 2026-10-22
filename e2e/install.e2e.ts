import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, openApp, test, waitForApp } from './fixtures';

// Installability and storage (#32): a standards-shaped manifest with icons that
// load, a status-bar color that follows the theme, the build version, and
// storage protection that is only ever requested by the player.

const settings = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Settings' });
};
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute('content');

test('the manifest is linked, valid, and every icon loads at its declared size', async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await page.request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'Ember Wellness', short_name: 'Ember', start_url: '/', scope: '/', display: 'standalone' });
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose).sort()).toEqual(['any', 'any', 'maskable']);
  for (const icon of manifest.icons) {
    const [w, h] = icon.sizes.split('x').map(Number);
    const size = await page.evaluate(src => new Promise<number[]>(resolve => {
      const img = new Image();
      img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.onerror = () => resolve([0, 0]);
      img.src = src;
    }), icon.src);
    expect(size, icon.src).toEqual([w, h]);
  }
  for (const rel of ['icon', 'apple-touch-icon']) {
    const link = await page.locator(`link[rel="${rel}"]`).getAttribute('href');
    expect((await page.request.get(link!)).ok(), rel).toBe(true);
  }
});

test('the status-bar color follows light, dark and custom backgrounds', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  await waitForApp(page);
  expect(await themeColor(page)).toBe('#F5F5F0');
  const sheet = await settings(page);
  // The radios follow the saved theme, so click and wait (not .check(), which expects an instant change).
  await sheet.getByRole('radio', { name: 'Dark' }).click();
  await expect.poll(() => themeColor(page)).toBe('#121212');
  await sheet.getByRole('radio', { name: 'Light' }).click();
  await expect.poll(() => themeColor(page)).toBe('#F5F5F0');
  await sheet.getByRole('button', { name: 'Lavender' }).click();
  await expect.poll(() => themeColor(page)).toBe('#F5F3FF');
});

test('a dark-theme player sees a dark status bar from the first paint', async ({ page }) => {
  // What the head's startup script set, recorded before the app loads.
  await page.addInitScript(() => {
    localStorage.setItem('ember_theme', 'dark');
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { firstColor: string | null }).firstColor = document.querySelector('meta[name="theme-color"]')!.getAttribute('content');
    });
  });
  await page.goto('/');
  expect(await page.evaluate(() => (window as unknown as { firstColor: string }).firstColor)).toBe('#121212');
});

test('Settings shows the build version, and exported saves carry it', async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  const sheet = await settings(page);
  const label = (await sheet.locator('[data-version]').textContent())!;
  const version = /Ember version (\S+?),? /.exec(label + ' ')?.[1];
  expect(version, label).toBeTruthy();
  expect(version).not.toBe('dev');
  const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Export save' }).click()]);
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.appVersion).toBe(version);
});

/** Replaces the browser's storage-persistence API with a scripted one, and counts persist() calls. */
async function stubStorage(page: Page, { persisted, grant, supported = true }: { persisted: boolean; grant: boolean; supported?: boolean }) {
  await page.addInitScript(([persisted, grant, supported]) => {
    const w = window as unknown as { persistCalls: number };
    w.persistCalls = 0;
    const storage = navigator.storage as unknown as Record<string, unknown>;
    if (!supported) {
      Object.defineProperty(storage, 'persist', { value: undefined });
      Object.defineProperty(storage, 'persisted', { value: undefined });
      return;
    }
    let kept = persisted;
    Object.defineProperty(storage, 'persisted', { value: async () => kept });
    Object.defineProperty(storage, 'persist', {
      value: async () => {
        w.persistCalls += 1;
        kept = grant;
        return grant;
      },
    });
  }, [persisted, grant, supported] as const);
}
const persistCalls = (page: Page) => page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls);
const status = (page: Page) => page.locator('#storage-status');

test('storage protection is never requested automatically, only when the player asks (granted)', async ({ page }) => {
  await stubStorage(page, { persisted: false, grant: true });
  await openApp(page);
  await waitForApp(page);
  const sheet = await settings(page);
  await expect(status(page)).toHaveAttribute('data-storage', 'may-clear');
  await expect(status(page)).toContainText('may clear');
  expect(await persistCalls(page), 'no request on load or on opening Settings').toBe(0);
  await sheet.getByRole('button', { name: "Ask the browser to keep Ember's data" }).click();
  await expect(status(page)).toHaveAttribute('data-storage', 'kept');
  await expect(status(page)).toContainText('has agreed');
  await expect(status(page), 'never promised as a guarantee').toContainText('unless you clear it yourself');
  expect(await persistCalls(page)).toBe(1);
});

test('a declined request says so, without promising anything', async ({ page }) => {
  await stubStorage(page, { persisted: false, grant: false });
  await openApp(page);
  await waitForApp(page);
  const sheet = await settings(page);
  await sheet.getByRole('button', { name: "Ask the browser to keep Ember's data" }).click();
  await expect(status(page)).toContainText("didn't agree this time");
  await expect(sheet.getByRole('button', { name: "Ask the browser to keep Ember's data" })).toHaveCount(0);
});

test('browsers without the API, or already keeping the data, get no button', async ({ page, context }) => {
  await stubStorage(page, { persisted: false, grant: false, supported: false });
  await openApp(page);
  await waitForApp(page);
  let sheet = await settings(page);
  await expect(status(page)).toHaveAttribute('data-storage', 'unsupported');
  await expect(sheet.getByRole('button', { name: /Ask the browser/ })).toHaveCount(0);

  const kept = await context.newPage();
  await stubStorage(kept, { persisted: true, grant: true });
  await kept.goto('/');
  await waitForApp(kept);
  sheet = await settings(kept);
  await expect(status(kept)).toHaveAttribute('data-storage', 'kept');
  await expect(sheet.getByRole('button', { name: /Ask the browser/ })).toHaveCount(0);
});
