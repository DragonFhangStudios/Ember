import { factForDay } from '../src/lib/dragonFacts/daily';
import { contrastProblems, settle } from './contrast';
import { expect, openApp, test, waitForApp } from './fixtures';

// Daily Dragon Fact (#18): one fact per local calendar day, offline.

const card = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Daily Dragon Fact' });

test("shows today's fact on Home, labeled as lore or real-world, the same after a reload", async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  const today = factForDay(new Date());
  await expect(card(page)).toHaveAttribute('data-fact', today.id);
  await expect(card(page)).toContainText(today.text);
  await expect(card(page)).toContainText(today.kind === 'lore' ? 'Ember lore' : 'Real-world fact');
  if (today.kind === 'lore') await expect(card(page)).toContainText('Just for fun');

  await page.reload();
  await waitForApp(page);
  await expect(card(page)).toHaveAttribute('data-fact', today.id);
});

test('changes at local midnight, offline', async ({ page, context }) => {
  const beforeMidnight = new Date(2026, 9, 21, 23, 59, 50);
  const afterMidnight = new Date(2026, 9, 22, 0, 0, 10);
  await page.clock.setFixedTime(beforeMidnight);
  await openApp(page);
  await waitForApp(page);
  await expect(card(page)).toHaveAttribute('data-fact', factForDay(beforeMidnight).id);

  // Everything is bundled: no network needed for the next day's fact.
  await context.setOffline(true);
  await page.clock.setFixedTime(afterMidnight);
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // the app's regular day check
  await expect(card(page)).toHaveAttribute('data-fact', factForDay(afterMidnight).id);
  expect(factForDay(afterMidnight).id).not.toBe(factForDay(beforeMidnight).id);
  await context.setOffline(false);
});

/** The first date from 2026-10-21 whose fact is of this kind. */
function firstDayWith(kind: 'real' | 'lore') {
  for (let i = 0; i < 60; i++) {
    const date = new Date(2026, 9, 21 + i, 12);
    if (factForDay(date).kind === kind) return date;
  }
  throw new Error(`no ${kind} fact in 60 days`);
}

for (const kind of ['real', 'lore'] as const) {
  test(`a ${kind === 'real' ? 'real-world fact cites its source' : 'lore fact is labeled as fiction'}, readable in both themes`, async ({ page }) => {
    const date = firstDayWith(kind);
    const fact = factForDay(date);
    await page.clock.setFixedTime(date);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openApp(page);
      await waitForApp(page);
      await expect(card(page)).toHaveAttribute('data-fact', fact.id);
      if (fact.kind === 'real') {
        await expect(card(page)).toContainText('Real-world fact');
        const link = card(page).getByRole('link', { name: new RegExp(fact.source.publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
        await expect(link).toHaveAttribute('href', fact.source.url);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
        expect((await link.boundingBox())!.height, 'a comfortable tap target').toBeGreaterThanOrEqual(44);
      } else {
        await expect(card(page)).toContainText('Ember lore');
        await expect(card(page)).toContainText('Just for fun');
        await expect(card(page).getByRole('link')).toHaveCount(0);
      }
      await card(page).scrollIntoViewIfNeeded();
      await settle(page);
      expect(await contrastProblems(page), `${scheme} contrast`).toEqual([]);
    }
  });
}
