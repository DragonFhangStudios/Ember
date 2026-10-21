import { factForDay } from '../src/lib/dragonFacts/daily';
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
