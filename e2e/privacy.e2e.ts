import type { Page } from '@playwright/test';
import { editSave, expect, openApp, test, waitForApp } from './fixtures';

// Privacy and feedback (#32): a plain explanation of what's kept and sent, and
// diagnostics the player copies themselves, never including wellness data.

async function openPrivacy(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const version = /Ember version (\S+?),? /.exec(((await settings.locator('[data-version]').textContent()) ?? '') + ' ')?.[1];
  await settings.getByRole('button', { name: 'Privacy and feedback…' }).click();
  const privacy = page.getByRole('dialog', { name: 'Privacy and your data' });
  await expect(privacy).toBeVisible();
  return { privacy, version };
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  // Real wellness data that must never appear in diagnostics.
  await editSave(page, `
    state.dragonName = 'Sparky';
    state.symptomLogs = [{ date: new Date().toISOString(), energy: 1, mood: 2, notes: 'SECRET-NOTE-123 rough night' }];
    state.quests.push({ id: 'custom_1', title: 'PRIVATE-QUEST-456', description: '', type: 'custom', completed: false, points: 10, isDaily: true, isCustom: true, progress: 0, target: 1 });
  `);
  await page.reload();
  await waitForApp(page);
});

test('explains plainly what is kept on the device and what is sent', async ({ page }) => {
  const { privacy } = await openPrivacy(page);
  await expect(privacy).toHaveAccessibleDescription(/stays on this device/);
  await expect(privacy).toContainText('no accounts, analytics, ads or tracking');
  await expect(privacy.getByRole('heading', { name: 'Kept on this device' })).toBeVisible();
  await expect(privacy.getByRole('heading', { name: 'Sent over the network' })).toBeVisible();
  await expect(privacy).toContainText('nothing is fetched from other sites');
  await expect(privacy).toContainText("isn't medical advice");
  // The medical disclaimer itself is still on Home.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Medical Disclaimer' })).toBeAttached();
});

test('diagnostics describe the app and browser only, never wellness data', async ({ page }) => {
  const { privacy, version } = await openPrivacy(page);
  const box = privacy.getByLabel('Diagnostics');
  await expect(box).toHaveValue(/^Ember diagnostics/);
  const text = await box.inputValue();
  expect(text).toContain(`App version: ${version} `);
  expect(text).toContain('Save format: v9');
  expect(text).toContain(await page.evaluate(() => navigator.userAgent));
  for (const secret of ['SECRET-NOTE-123', 'rough night', 'PRIVATE-QUEST-456', 'Sparky', 'mood', 'energy']) {
    expect(text.toLowerCase(), secret).not.toContain(secret.toLowerCase());
  }
});

test('copying puts exactly the shown text on the clipboard, and nothing is sent', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const sent: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'GET') sent.push(`${request.method()} ${request.url()}`);
  });
  const { privacy } = await openPrivacy(page);
  const shown = await privacy.getByLabel('Diagnostics').inputValue();
  await privacy.getByRole('button', { name: 'Copy diagnostics' }).click();
  await expect(privacy.locator('[data-copy-status]')).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
  expect(sent, 'no data sent anywhere').toEqual([]);
});

test('without clipboard access, the text can be selected and copied by hand', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  const { privacy } = await openPrivacy(page);
  await privacy.getByRole('button', { name: 'Copy diagnostics' }).click();
  await expect(privacy.locator('[data-copy-status]')).toContainText('copy it yourself');
  await privacy.getByLabel('Diagnostics').focus();
  const selected = await page.evaluate(() => {
    const el = document.activeElement as HTMLTextAreaElement;
    return el.selectionEnd - el.selectionStart === el.value.length;
  });
  expect(selected, 'focusing the box selects all of it').toBe(true);
});
