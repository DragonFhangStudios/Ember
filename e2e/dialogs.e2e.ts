import type { Locator, Page } from '@playwright/test';
import { expect, openApp, readSave, test, waitForApp } from './fixtures';

// Dialog accessibility (#17): Settings, Reset Progress (opened from Settings),
// and Add Custom Quest are labelled modal dialogs that hold keyboard focus,
// close with Escape, return focus to what opened them, and isolate the page.

const isFocusInside = (dialog: Locator) => dialog.evaluate(d => d.contains(document.activeElement));

/** Tab and Shift+Tab never leave the dialog (not to the page, not to the browser). */
async function expectFocusContained(page: Page, dialog: Locator) {
  expect(await isFocusInside(dialog), 'focus starts inside').toBe(true);
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 1; i <= 12; i++) {
      await page.keyboard.press(key);
      expect(await isFocusInside(dialog), `${key} #${i}`).toBe(true);
    }
  }
}

/** The page behind can't take focus, taps, or scrolling. */
async function expectBackgroundIsolated(page: Page) {
  const background = await page.evaluate(() => {
    const control = document.querySelector('nav button') as HTMLElement;
    control.focus();
    const r = control.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      takesFocus: document.activeElement === control,
      takesTaps: !!hit && control.contains(hit),
      scrolls: getComputedStyle(document.documentElement).overflow !== 'hidden',
    };
  });
  expect(background).toEqual({ takesFocus: false, takesTaps: false, scrolls: false });
}

const settingsButton = (page: Page) => page.locator('header').getByRole('button', { name: 'Settings' });

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('Settings is a labelled modal dialog that holds focus, closes with Escape, and returns focus', async ({ page }) => {
  await settingsButton(page).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Close settings' })).toBeFocused();
  await expectFocusContained(page, settings);
  await expectBackgroundIsolated(page);

  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(settingsButton(page)).toBeFocused();
});

test('Reset opens on top of Settings, and Escape steps back one dialog at a time', async ({ page }) => {
  await settingsButton(page).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const resetButton = settings.getByRole('button', { name: 'Reset progress…' });
  await resetButton.click();

  const reset = page.getByRole('dialog', { name: 'Reset Progress?' });
  await expect(reset).toHaveAccessibleDescription(/cannot be undone/);
  await expect(reset.getByRole('button', { name: 'Cancel' }), 'focus starts on the safe choice').toBeFocused();
  await expectFocusContained(page, reset);
  // Settings underneath is inert while Reset is open.
  const settingsTakesFocus = await settings.getByRole('button', { name: 'Close settings' }).evaluate(b => {
    (b as HTMLElement).focus();
    return document.activeElement === b;
  });
  expect(settingsTakesFocus).toBe(false);
  await expectBackgroundIsolated(page);

  await page.keyboard.press('Escape');
  await expect(reset).toHaveCount(0);
  await expect(settings).toBeVisible();
  await expect(resetButton, 'focus returns inside Settings').toBeFocused();

  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(settingsButton(page)).toBeFocused();
  expect((await readSave(page))!.state.energy, 'nothing was reset').toBe(50);
});

// With reduced motion the two dialogs can finish closing at different times,
// which exercises returning focus past a dialog that is already gone.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`confirming reset closes both dialogs and returns focus to the Settings button (motion: ${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.getByText('Morning Routine').click();
    await expect.poll(async () => (await readSave(page))?.state.energy).toBe(60);

    await settingsButton(page).click();
    await page.getByRole('button', { name: 'Reset progress…' }).click();
    await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(settingsButton(page)).toBeFocused();
    await expect.poll(async () => (await readSave(page))?.state.energy).toBe(50);
  });
}

test('Add Custom Quest holds focus in both of its views and returns focus on Escape', async ({ page }) => {
  const addCustom = page.getByRole('button', { name: 'Add Custom' });
  await addCustom.click();
  const form = page.getByRole('dialog', { name: 'Add Custom Quest' });
  await expect(form).toBeVisible();
  await expectFocusContained(page, form);
  await expectBackgroundIsolated(page);

  // The "New Type" button disappears, so focus moves to the new view's heading.
  await form.getByRole('button', { name: 'New Type' }).click();
  const newType = page.getByRole('dialog', { name: 'New Quest Type' });
  await expect(newType.getByRole('heading', { name: 'New Quest Type' })).toBeFocused();
  await expectFocusContained(page, newType);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(addCustom).toBeFocused();
});

test('tapping outside a dialog closes it', async ({ page }) => {
  await settingsButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.mouse.click(20, 20); // above the sheet
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(settingsButton(page)).toBeFocused();
});
