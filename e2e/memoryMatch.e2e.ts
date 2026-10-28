import type { Locator, Page } from '@playwright/test';
import { MISMATCH_MS, Round, SYMBOLS, newRound, seededRandom } from '../src/lib/memoryMatch';
import { contrastProblems, lightPanelsInDarkMode, settle } from './contrast';
import { editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';

// Memory Match: a cozy card game in the "Just for fun" group. A known seed
// makes the deal predictable, so tests can play perfect games. Playing never
// changes the save or its backups.

const SEED = 7;
/** The deals the app will hand out, in order, for this seed. */
const deals = () => {
  const random = seededRandom(SEED);
  return [newRound(random), newRound(random)];
};
const pairsIn = (round: Round) => SYMBOLS.map(({ id }) => round.cards.flatMap((card, i) => (card.symbol === id ? [i] : [])));
const mismatchIn = (round: Round): [number, number] => [0, round.cards.findIndex(card => card.symbol !== round.cards[0].symbol)];

const game = (page: Page) => page.getByRole('dialog', { name: 'Memory Match' });
const card = (page: Page, i: number) => game(page).locator(`[data-card="${i}"]`);
const opener = (page: Page) => page.getByRole('group', { name: /Just for fun with/ }).getByRole('button', { name: 'Memory Match' });

/** Taps on touch devices, clicks elsewhere. */
const press = (target: Locator) => (test.info().project.use.hasTouch ? target.tap() : target.click());

/** The save record and the kept backups, straight from IndexedDB. */
const everythingSaved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise(resolve => {
        const open = indexedDB.open('ember');
        open.onsuccess = () => {
          const store = open.result.transaction('saves').objectStore('saves');
          const player = store.get('player');
          const backups = store.get('backups');
          backups.onsuccess = () => {
            open.result.close();
            resolve({ player: player.result, backups: backups.result ?? null });
          };
        };
      }),
  );

async function playPerfectly(page: Page, round: Round) {
  for (const [a, b] of pairsIn(round)) {
    await press(card(page, a));
    await press(card(page, b));
    await expect(card(page, b)).toHaveAttribute('data-state', 'matched');
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(seed => {
    (window as { __emberMemoryMatchSeed?: number }).__emberMemoryMatchSeed = seed;
  }, SEED);
  await openApp(page);
  await waitForApp(page);
});

test('a whole game, then another, works offline for the egg and changes nothing saved, backups included', async ({ page }) => {
  test.slow();
  const [first, second] = deals();
  // Make a backup to guard (Reset keeps the old save as one).
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => ((await everythingSaved(page)) as { backups: unknown[] | null }).backups?.length).toBe(1);
  await page.keyboard.press('Escape');
  expect((await readSave(page))!.state.stage).toBe('Egg');
  const before = await everythingSaved(page);

  const requests: string[] = [];
  page.context().on('request', r => requests.push(r.url()));
  await page.context().setOffline(true);

  await press(opener(page));
  await expect(game(page)).toBeVisible();
  await expect(game(page).locator('[data-pairs-found]')).toHaveText('Pairs found: 0/6');
  await expect(game(page).locator('[data-state="down"]')).toHaveCount(12);

  // A mismatch shows both cards, blocks other picks, then turns back.
  const [a, b] = mismatchIn(first);
  await press(card(page, a));
  await press(card(page, a)); // the same card again: no match, nothing changes
  await expect(game(page).locator('[data-state="up"]')).toHaveCount(1);
  await press(card(page, b));
  await expect(game(page).locator('[data-memory-message]')).toContainText("aren't a match");
  const third = first.cards.findIndex((_, i) => i !== a && i !== b);
  await press(card(page, third));
  await expect(card(page, third), 'blocked while the mismatch shows').toHaveAttribute('data-state', 'down');
  await expect(game(page).locator('[data-state="up"]')).toHaveCount(0, { timeout: MISMATCH_MS + 2000 });

  await playPerfectly(page, first);
  await expect(game(page).locator('[data-pairs-found]')).toHaveText('Pairs found: 6/6');
  const done = game(page).locator('[data-memory-complete]');
  await expect(done).toContainText('All six pairs found!');
  await expect(done).toContainText("Ember's egg gives a happy little wiggle.");
  await expect(game(page).getByRole('heading', { name: 'All six pairs found!' })).toBeFocused();

  // Play Again: a fresh, reshuffled deal, and another full game.
  await press(game(page).getByRole('button', { name: 'Play Again' }));
  await expect(game(page).locator('[data-state="down"]')).toHaveCount(12);
  await expect(game(page).locator('[data-pairs-found]')).toHaveText('Pairs found: 0/6');
  await expect(card(page, 0)).toBeFocused();
  expect(second.cards.map(c => c.symbol)).not.toEqual(first.cards.map(c => c.symbol));
  await playPerfectly(page, second);
  await expect(done).toBeVisible();

  await press(game(page).getByRole('button', { name: 'Close', exact: true }));
  await expect(game(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  expect(requests, 'no network needed').toEqual([]);
  await page.context().setOffline(false);
  expect(await everythingSaved(page), 'the save and its backups are untouched').toEqual(before);
});

test('keyboard and screen readers: positions and states, nothing hidden announced, focus kept, round resumed (hatched, reduced motion)', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await editSave(page, "state.stage = 'Hatchling'; state.stageSeen = 'Hatchling';");
  await page.reload();
  await waitForApp(page);
  const rev = (await readSave(page))!.rev;
  const [deal] = deals();
  const names = SYMBOLS.map(s => s.name);
  const spoken = async () => game(page).ariaSnapshot();

  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(game(page)).toBeVisible();
  await expect(game(page).getByRole('button', { name: 'Close Memory Match' })).toBeFocused();
  await expect(card(page, 0)).toHaveAccessibleName('Row 1, column 1: face down');
  await expect(card(page, 11)).toHaveAccessibleName('Row 3, column 4: face down');
  const tree = await spoken();
  expect(names.filter(n => new RegExp(`\\b${n}\\b`).test(tree)), 'no symbol is exposed while face down').toEqual([]);

  // Tab and Shift+Tab move through the cards and wrap within the dialog.
  await page.keyboard.press('Tab');
  await expect(card(page, 0)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(card(page, 11)).toBeFocused();

  // Reveal with Enter and Space; the match is announced and the cards say so.
  const [[p1, p2]] = pairsIn(deal);
  const name = SYMBOLS.find(s => s.id === deal.cards[p1].symbol)!.name;
  await card(page, p1).focus();
  await page.keyboard.press('Enter');
  await expect(card(page, p1)).toHaveAccessibleName(new RegExp(`: ${name}$`));
  await expect(game(page).getByRole('status')).toHaveText(`${name}. Now find its partner.`);
  // Reduced motion: the card changes without a turning animation.
  expect(await card(page, p1).locator('span').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await card(page, p2).focus();
  await page.keyboard.press(' ');
  await expect(card(page, p2)).toHaveAccessibleName(new RegExp(`: ${name}, matched$`));
  await expect(card(page, p2)).toHaveAttribute('aria-disabled', 'true');
  await expect(card(page, p2)).toBeFocused();
  await expect(game(page).getByRole('status')).toHaveText(`A match: ${name}! 1 of 6 pairs found.`);

  // Escape closes; focus goes back to the button; reopening resumes the round.
  await page.keyboard.press('Escape');
  await expect(game(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(game(page).locator('[data-pairs-found]')).toHaveText('Pairs found: 1/6');
  await expect(game(page).locator('[data-state="matched"]')).toHaveCount(2);

  // Closing while a mismatch shows turns it back at once.
  const others = deal.cards.flatMap((c, i) => (c.symbol !== deal.cards[p1].symbol ? [i] : []));
  const b = others.find(i => deal.cards[i].symbol !== deal.cards[others[0]].symbol)!;
  await card(page, others[0]).focus();
  await page.keyboard.press('Enter');
  await card(page, b).focus();
  await page.keyboard.press('Enter');
  await expect(game(page).locator('[data-memory-status="mismatch"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(opener(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(game(page)).toBeVisible();
  await expect(game(page).locator('[data-state="up"]')).toHaveCount(0);
  await expect(game(page).locator('[data-state="matched"]')).toHaveCount(2);

  // Finish by keyboard: the completion message gets focus, so it's heard.
  for (const [x, y] of pairsIn(deal).slice(1)) {
    for (const i of [x, y]) {
      await card(page, i).focus();
      await page.keyboard.press('Enter');
    }
  }
  await expect(game(page).getByRole('heading', { name: 'All six pairs found!' })).toBeFocused();
  await expect(game(page).locator('[data-memory-complete]')).toContainText('Ember does a happy little dance.');
  await expect(game(page).locator('[data-celebration] span'), 'reduced motion: a glow, no sparkles').toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(opener(page)).toBeFocused();
  expect((await readSave(page))!.rev, 'nothing saved').toBe(rev);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`at 320px in ${scheme} mode the board fits, cards are easy to tap, and every state is readable`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.reload();
    await waitForApp(page);
    const [deal] = deals();
    const check = async (where: string) => {
      await settle(page);
      expect(await contrastProblems(page), `contrast: ${where}`).toEqual([]);
      if (scheme === 'dark') expect(await lightPanelsInDarkMode(page), `light panels: ${where}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `fits: ${where}`).toBe(true);
    };
    await opener(page).click();
    await check('new board');
    const box = (await card(page, 0).boundingBox())!;
    expect(Math.min(box.width, box.height), 'touch target').toBeGreaterThanOrEqual(44);
    const [a, b] = mismatchIn(deal);
    await card(page, a).click();
    await card(page, b).click();
    await check('a mismatch showing');
    await expect(game(page).locator('[data-state="up"]')).toHaveCount(0, { timeout: MISMATCH_MS + 2000 });
    await playPerfectly(page, deal);
    await game(page).getByRole('button', { name: 'Play Again' }).scrollIntoViewIfNeeded();
    await check('complete');
  });
}
