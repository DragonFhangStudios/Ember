import type { Page } from '@playwright/test';
import { ROUND_LENGTHS, newPattern } from '../src/lib/patternChallenge';
import { seededRandom } from '../src/lib/seededRandom';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { editSave, expect, openApp, test, waitForApp } from './fixtures';

// The "Just for fun" group and its two newest games, Pattern Challenge and
// Trick Time, at the smallest phone width and on a desktop, in light and
// dark: everything fits, reads clearly and is easy to tap.

const SEED = 4;
const group = (page: Page) => page.getByRole('group', { name: 'Just for fun with Ember' });

for (const [width, scheme] of [[320, 'light'], [320, 'dark'], [1280, 'light']] as const) {
  test(`at ${width}px in ${scheme} mode, Just for fun and its games fit, read clearly and are easy to tap`, async ({ page }) => {
    test.skip(width > 1000 && test.info().project.name !== 'chromium', 'desktop layout once, on desktop Chromium');
    test.slow();
    await page.addInitScript(seed => {
      (window as { __emberPatternSeed?: number }).__emberPatternSeed = seed;
    }, SEED);
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 640 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await openApp(page);
    await waitForApp(page);
    await editSave(page, "state.stage = 'Hatchling'; state.stageSeen = 'Hatchling';");
    await page.reload();
    await waitForApp(page);

    const check = async (where: string) => {
      await settle(page);
      expect(await contrastProblems(page), `contrast: ${where}`).toEqual([]);
      if (scheme === 'dark') expect(await lightPanelsInDarkMode(page), `light panels: ${where}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `fits: ${where}`).toBe(true);
    };

    // Every button in the group: comfortable to tap, label fully shown.
    const buttons = group(page).getByRole('button');
    await expect(buttons).toHaveText(['Boop', 'Play', 'Rest together', 'Explore', 'Pattern Challenge', 'Trick Time']);
    await group(page).scrollIntoViewIfNeeded();
    for (const button of await buttons.all()) {
      const box = (await button.boundingBox())!;
      expect(box.height, `${await button.textContent()} height`).toBeGreaterThanOrEqual(44);
      expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth), `${await button.textContent()} label fits`).toBe(true);
    }
    await check('home');

    // Pattern Challenge: ready, the pattern in words, then a full game to the finish.
    await group(page).getByRole('button', { name: 'Pattern Challenge' }).click();
    const pattern = page.getByRole('dialog', { name: 'Pattern Challenge' });
    await check('pattern: ready');
    for (const pad of await pattern.locator('[data-pad]').all()) expect((await pad.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await pattern.getByRole('button', { name: 'Read it as words' }).click();
    const symbols = newPattern(seededRandom(SEED));
    for (let round = 0; round < 3; round++) {
      await pattern.getByRole('button', { name: /Show the pattern|Watch it again/ }).click();
      await expect(pattern.locator('[data-pattern-phase="repeat"]')).toHaveCount(1, { timeout: 10_000 });
      if (round === 0) await check('pattern: your turn, with the words shown');
      for (const id of symbols.slice(0, ROUND_LENGTHS[round])) await pattern.locator(`[data-pad="${id}"]`).click();
      if (round < 2) await pattern.getByRole('button', { name: 'Next round' }).click();
    }
    await pattern.getByRole('button', { name: 'Play Again' }).scrollIntoViewIfNeeded();
    await check('pattern: complete');
    await pattern.getByRole('button', { name: 'Close', exact: true }).click();

    // Trick Time: the list, a response, a finale.
    await group(page).getByRole('button', { name: 'Trick Time' }).click();
    const tricks = page.getByRole('dialog', { name: 'Trick Time' });
    await check('tricks: list');
    await tricks.locator('[data-trick="twirl"]').click();
    await tricks.locator('[data-invite]').click();
    await check('tricks: response');
    await tricks.locator('[data-trick-choice="left"]').click();
    await tricks.getByRole('button', { name: 'Done' }).scrollIntoViewIfNeeded();
    await check('tricks: finale');
  });
}
