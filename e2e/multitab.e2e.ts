import type { BrowserContext, Page } from '@playwright/test';
import { bondOf, editSave, expect, focusTimerText, goToTab, readSave, statValue, test, waitForApp } from './fixtures';

async function openTabs(context: BrowserContext, first: Page, count: number) {
  await first.goto('/');
  await waitForApp(first);
  const tabs = [first];
  for (let i = 1; i < count; i++) {
    const tab = await context.newPage();
    await tab.goto('/');
    await waitForApp(tab);
    tabs.push(tab);
  }
  return tabs;
}

test('a change in one tab appears in another without reloading', async ({ page, context }) => {
  const [a, b] = await openTabs(context, page, 2);
  await a.getByText('Morning Routine').click();
  await expect(statValue(b, 'Energy')).toHaveText('60');
});

test('concurrent actions from three tabs are all saved', async ({ page, context }) => {
  const [a, b, c] = await openTabs(context, page, 3);
  await Promise.all([
    a.getByText('Daily Vitality').click(),
    b.getByText('Symptom Check-in').click(),
    c.getByText('Hydration Goal').click(),
  ]);
  await expect.poll(async () => (await readSave(a))?.state.energy).toBe(50 + 25 + 5 + 5);
  for (const tab of [a, b, c]) await expect(statValue(tab, 'Energy')).toHaveText('85');
});

test('a shared focus session ending with three tabs open is rewarded exactly once', async ({ page, context }) => {
  const tabs = await openTabs(context, page, 3);
  for (const tab of tabs) await goToTab(tab, 'Focus');
  await tabs[0].locator('button:has(svg.lucide-play)').click();
  for (const tab of tabs.slice(1)) await expect(tab.locator('button:has(svg.lucide-pause)')).toBeVisible();

  const bondBefore = bondOf((await readSave(tabs[0]))!.state);
  // Bring the end time close, then let every tab reach it.
  await editSave(tabs[0], 'state.focus.endsAt = Date.now() + 1500;');
  for (const tab of tabs) {
    await tab.reload();
    await waitForApp(tab);
    await goToTab(tab, 'Focus');
  }
  for (const tab of tabs) await expect(focusTimerText(tab)).toHaveText('0:00', { timeout: 8_000 });
  await expect.poll(async () => (await readSave(tabs[0]))?.state.focus?.status).toBe('finished');

  const state = (await readSave(tabs[0]))!.state;
  expect(state.completedFocusSessions).toHaveLength(1);
  expect(state.daily.focusRewards).toBe(1);
  expect(bondOf(state)).toBe(bondBefore + 3);
});
