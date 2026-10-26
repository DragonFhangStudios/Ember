import type { Page } from '@playwright/test';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// The Dragon Wardrobe is hidden for the closed alpha (#32) until original art
// (#20). Golden Scales, owned items and what's equipped stay in the save.
// Development and test builds can switch it back on (`__emberWardrobe`), so
// its screen and purchase rules stay covered for when it returns; production
// builds compile that switch out.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const saved = async (page: Page) => (await readSave(page))!.state;

/** A player who already has scales, an owned hat (equipped) and an owned nest. */
async function withCosmetics(page: Page) {
  await editSave(page, `
    state.stage = 'Hatchling';
    state.goldenScales = 60;
    state.inventory = ['hat_wizard', 'nest_moss'];
    state.equipped = { hat: 'hat_wizard' };
  `);
  await page.reload();
  await waitForApp(page);
}

test.describe('in the alpha (hidden)', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await waitForApp(page);
    await withCosmetics(page);
  });

  test('there is no Shop, and no placeholder cosmetics are drawn on Ember', async ({ page }) => {
    await expect(nav(page).getByRole('button')).toHaveText(['Home', 'Focus', 'Check-in']);
    await expect(page.getByRole('heading', { name: 'Dragon Wardrobe' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Hat', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Buy |^Equip / })).toHaveCount(0);
  });

  test('Golden Scales, owned items and what is equipped stay in the save, through play, reloads and export', async ({ page }) => {
    await page.getByText('Morning Routine').click();
    await expect.poll(async () => (await saved(page)).quests.find((q: { id: string }) => q.id === 'q1').completed).toBe(true);
    await page.reload();
    await waitForApp(page);
    const s = await saved(page);
    expect([s.goldenScales, s.inventory, s.equipped]).toEqual([60, ['hat_wizard', 'nest_moss'], { hat: 'hat_wizard' }]);
    await expect(page.locator('p', { hasText: /^Scales$/ }).locator('xpath=following-sibling::p')).toHaveText('60');
  });
});

test.describe('when switched back on (development and test builds only)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      (window as { __emberWardrobe?: boolean }).__emberWardrobe = true;
    });
    await openApp(page);
    await waitForApp(page);
    await withCosmetics(page);
  });

  test('the Shop is back, with the equipped hat drawn on Ember', async ({ page }) => {
    await expect(nav(page).getByRole('button')).toHaveText(['Home', 'Focus', 'Check-in', 'Shop']);
    await expect(page.getByRole('img', { name: 'Hat', exact: true })).toBeVisible();
    await goToTab(page, 'Shop');
    await expect(page.getByRole('heading', { name: 'Dragon Wardrobe' })).toBeVisible();
  });

  test('buying needs enough Golden Scales, and equipping toggles what Ember wears', async ({ page }) => {
    await goToTab(page, 'Shop');
    await expect(page.getByRole('button', { name: 'Buy Golden Crown for 150 Golden Scales' }), 'too expensive').toBeDisabled();
    await page.getByRole('button', { name: 'Buy Red Cozy Scarf for 30 Golden Scales' }).click();
    await expect.poll(async () => (await saved(page)).goldenScales).toBe(30);
    expect((await saved(page)).inventory).toEqual(['hat_wizard', 'nest_moss', 'scarf_red']);

    await page.getByRole('button', { name: 'Tiny Wizard Hat, equipped' }).click();
    await expect.poll(async () => (await saved(page)).equipped.hat).toBeUndefined();
    await page.getByRole('button', { name: 'Equip Tiny Wizard Hat' }).click();
    await expect.poll(async () => (await saved(page)).equipped.hat).toBe('hat_wizard');
    await expect(page.getByRole('button', { name: 'Tiny Wizard Hat, equipped' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('its pictures are local, and it is readable and named in light and dark mode', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await waitForApp(page);
    await goToTab(page, 'Shop');
    const images = page.locator('main img');
    await expect(images.first()).toBeVisible();
    for (const img of await images.all()) {
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0 && !/^https?:/.test(el.getAttribute('src') ?? ''))).toBe(true);
    }
    const tree = await page.locator('body').ariaSnapshot();
    expect(tree.split('\n').filter(l => /^\s*- (button|img)\b(?! ")/.test(l)), 'every button and image has a name').toEqual([]);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await settle(page);
      // The tab fades in with a script-driven animation that settle() can't see, so wait for it.
      await expect.poll(() => contrastProblems(page), { message: `${scheme} contrast` }).toEqual([]);
      expect(await lightPanelsInDarkMode(page), `${scheme} panels`).toEqual([]);
    }
  });
});
