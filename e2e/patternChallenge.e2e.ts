import type { Locator, Page } from '@playwright/test';
import { PADS, PadId, ROUND_LENGTHS, newPattern } from '../src/lib/patternChallenge';
import { seededRandom } from '../src/lib/seededRandom';
import { editSave, expect, openApp, readSave, test, waitForApp } from './fixtures';
import { everythingSaved, makeBackup } from './saveSnapshot';

// Pattern Challenge: watch a pattern light up, repeat it; three rounds of
// two, three and four symbols. A known seed makes the patterns predictable.
// Playing never changes the save or its backups.

const SEED = 4;
/** The patterns the app will hand out, game by game, for this seed. */
const patterns = () => {
  const random = seededRandom(SEED);
  return [newPattern(random), newPattern(random)];
};
const nameOf = (id: PadId) => PADS.find(p => p.id === id)!.name;

const game = (page: Page) => page.getByRole('dialog', { name: 'Pattern Challenge' });
const pad = (page: Page, id: PadId) => game(page).locator(`[data-pad="${id}"]`);
const phase = (page: Page) => game(page).locator('[data-pattern-phase]');
const opener = (page: Page) => page.getByRole('group', { name: /Just for fun with/ }).getByRole('button', { name: 'Pattern Challenge' });

/** Taps on touch devices, clicks elsewhere. */
const press = (target: Locator) => (test.info().project.use.hasTouch ? target.tap() : target.click());

/** Watches this round's pattern through, then repeats it. */
async function playRound(page: Page, pattern: readonly PadId[], round: number) {
  await press(game(page).getByRole('button', { name: /Show the pattern|Watch it again/ }));
  await expect(phase(page)).toHaveAttribute('data-pattern-phase', 'repeat', { timeout: 10_000 });
  for (const id of pattern.slice(0, ROUND_LENGTHS[round])) await press(pad(page, id));
}

async function playGame(page: Page, pattern: readonly PadId[]) {
  for (let round = 0; round < 3; round++) {
    await playRound(page, pattern, round);
    if (round < 2) await press(game(page).getByRole('button', { name: 'Next round' }));
  }
  await expect(phase(page)).toHaveAttribute('data-pattern-phase', 'won');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(seed => {
    (window as { __emberPatternSeed?: number }).__emberPatternSeed = seed;
  }, SEED);
  await openApp(page);
  await waitForApp(page);
});

test('a whole game, a wrong guess, replays, then another game: offline, on the egg, and nothing saved changes', async ({ page }) => {
  test.slow();
  const [first, second] = patterns();
  await makeBackup(page);
  expect((await readSave(page))!.state.stage).toBe('Egg');
  const before = await everythingSaved(page);
  const requests: string[] = [];
  page.context().on('request', r => requests.push(r.url()));
  await page.context().setOffline(true);

  await press(opener(page));
  await expect(game(page)).toBeVisible();
  await expect(game(page).locator('[data-round]')).toHaveText('Round 1 of 3');
  // Nothing to press until the pattern has been shown (the symbols say so: aria-disabled).
  await pad(page, first[0]).click({ force: true });
  await expect(game(page).locator('[data-entered]')).toHaveAttribute('data-entered', '0');

  // A wrong guess: a gentle note, then the same round again. Watching again is unlimited.
  await playRound(page, [PADS.find(p => p.id !== first[0])!.id], 0);
  await expect(game(page).getByRole('status')).toHaveText("Not quite, and that's okay. Try again from the start, or watch it again.");
  await expect(game(page).locator('[data-round]')).toHaveText('Round 1 of 3');
  for (let i = 0; i < 2; i++) {
    await press(game(page).getByRole('button', { name: 'Watch it again' }));
    await expect(phase(page)).toHaveAttribute('data-pattern-phase', 'repeat', { timeout: 10_000 });
  }
  await playGame(page, first);
  const done = game(page).locator('[data-pattern-complete]');
  await expect(done).toContainText('All three patterns remembered!');
  await expect(done).toContainText('Somewhere inside the egg, Ember is cheering for you.');
  await expect(game(page).getByRole('heading', { name: 'All three patterns remembered!' })).toBeFocused();

  // Play Again: a new pattern from round one.
  await press(game(page).getByRole('button', { name: 'Play Again' }));
  await expect(game(page).locator('[data-round]')).toHaveText('Round 1 of 3');
  await expect(game(page).getByRole('button', { name: 'Show the pattern' })).toBeFocused();
  expect(second).not.toEqual(first);
  await playGame(page, second);

  await press(game(page).getByRole('button', { name: 'Close', exact: true }));
  await expect(game(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  expect(requests, 'no network needed').toEqual([]);
  await page.context().setOffline(false);
  expect(await everythingSaved(page), 'the save and its backups are untouched').toEqual(before);
});

test('keyboard and screen readers: named symbols, the pattern in words and as it plays, focus kept, closing mid-pattern (hatched, reduced motion)', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await editSave(page, "state.stage = 'Hatchling'; state.stageSeen = 'Hatchling';");
  await page.reload();
  await waitForApp(page);
  const rev = (await readSave(page))!.rev;
  const [pattern] = patterns();

  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(game(page).getByRole('button', { name: 'Close Pattern Challenge' })).toBeFocused();
  await expect(game(page).getByRole('list', { name: 'Symbols' }).getByRole('button')).toHaveCount(4);
  for (const { id, name } of PADS) {
    await expect(pad(page, id)).toHaveAccessibleName(name);
    await expect(pad(page, id), 'not their turn yet').toHaveAttribute('aria-disabled', 'true');
  }

  // The pattern in words, on request, as often as wanted.
  const words = game(page).getByRole('button', { name: 'Read it as words' });
  await expect(words).toHaveAttribute('aria-expanded', 'false');
  await words.focus();
  await page.keyboard.press('Enter');
  await expect(game(page).locator('[data-pattern-words]')).toHaveText(`The pattern: ${nameOf(pattern[0])}, then ${nameOf(pattern[1])}.`);
  await expect(game(page).getByRole('button', { name: 'Hide the words' })).toHaveAttribute('aria-expanded', 'true');

  // Showing: each step is named in the status as it lights; reduced motion lights it without moving.
  // Every message is recorded as it appears (a step only shows for a moment): each is said once, in order.
  const status = game(page).getByRole('status');
  await status.evaluate(el => {
    const said: string[] = ((window as { said?: string[] }).said = []);
    new MutationObserver(() => said.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await game(page).getByRole('button', { name: 'Show the pattern' }).focus();
  await page.keyboard.press('Enter');
  await expect(pad(page, pattern[0])).toHaveAttribute('data-lit', 'true');
  expect(await pad(page, pattern[0]).evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await expect(status).toHaveText('Your turn: tap the symbols in the same order.');
  expect(await page.evaluate(() => (window as { said?: string[] }).said)).toEqual([
    'Watch closely…', `1 of 2: ${nameOf(pattern[0])}`, `2 of 2: ${nameOf(pattern[1])}`, 'Your turn: tap the symbols in the same order.',
  ]);
  await expect(game(page).getByRole('button', { name: 'Watch it again' }), 'focus stays on the button').toBeFocused();

  // Closing mid-pattern stops it; reopening is calm and ready to show it again.
  await page.keyboard.press('Enter');
  await expect(game(page).locator('[data-lit]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(game(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await expect(phase(page)).toHaveAttribute('data-pattern-phase', 'ready');
  await expect(game(page).locator('[data-lit]')).toHaveCount(0);

  // Play every round by keyboard: Next round takes focus, then Show; the win message takes focus at the end.
  for (let round = 0; round < 3; round++) {
    await game(page).getByRole('button', { name: /Show the pattern|Watch it again/ }).focus();
    await page.keyboard.press('Enter');
    await expect(phase(page)).toHaveAttribute('data-pattern-phase', 'repeat', { timeout: 10_000 });
    for (const [i, id] of pattern.slice(0, ROUND_LENGTHS[round]).entries()) {
      await pad(page, id).focus();
      await page.keyboard.press(i % 2 ? ' ' : 'Enter');
    }
    if (round < 2) {
      await expect(status).toHaveText('Lovely! You remembered it.');
      await expect(game(page).getByRole('button', { name: 'Next round' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(game(page).getByRole('button', { name: 'Show the pattern' })).toBeFocused();
    }
  }
  await expect(game(page).getByRole('heading', { name: 'All three patterns remembered!' })).toBeFocused();
  await expect(game(page).locator('[data-pattern-complete]')).toContainText('Ember is so proud of you.');
  await page.keyboard.press('Escape');
  await expect(opener(page)).toBeFocused();
  expect((await readSave(page))!.rev, 'nothing saved').toBe(rev);
});
