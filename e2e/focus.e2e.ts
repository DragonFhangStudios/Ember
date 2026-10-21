import { bondOf, editSave, expect, focusTimerText, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
  await goToTab(page, 'Focus');
});

test('a running timer survives a reload with the correct remaining time', async ({ page }) => {
  await page.locator('button:has(svg.lucide-play)').click();
  await expect(page.locator('button:has(svg.lucide-pause)')).toBeVisible();
  await page.waitForTimeout(2_200);
  await page.reload();
  await waitForApp(page);
  await goToTab(page, 'Focus');
  await expect(focusTimerText(page)).toHaveText(/^9:5\d$/);
  await expect(page.locator('button:has(svg.lucide-pause)')).toBeVisible();
});

test('a paused timer stays paused after a reload, and only the transition is saved', async ({ page }) => {
  await page.locator('button:has(svg.lucide-play)').click();
  await page.waitForTimeout(1_200);
  await page.locator('button:has(svg.lucide-pause)').click();
  const pausedAt = await focusTimerText(page).textContent();
  await page.waitForTimeout(1_200);
  await page.reload();
  await waitForApp(page);
  await goToTab(page, 'Focus');
  await expect(focusTimerText(page)).toHaveText(pausedAt!);
  await expect(page.locator('button:has(svg.lucide-play)')).toBeVisible();
  expect((await readSave(page))?.state.focus.status).toBe('paused');
});

test('a session that ended while Ember was closed is rewarded exactly once on return', async ({ page, context }) => {
  await page.locator('button:has(svg.lucide-play)').click();
  await expect.poll(async () => (await readSave(page))?.state.focus?.status).toBe('running');
  const bondBefore = bondOf((await readSave(page))!.state);
  await page.close();

  // While closed, the session's end time passes.
  const returning = await context.newPage();
  await returning.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await returning.goto('/blank');
  await editSave(returning, 'state.focus.endsAt = Date.now() - 60000;');
  await returning.unrouteAll();
  await returning.goto('/');
  await waitForApp(returning);

  await expect.poll(async () => (await readSave(returning))?.state.focus?.status).toBe('finished');
  let state = (await readSave(returning))!.state;
  expect(state.completedFocusSessions).toHaveLength(1);
  expect(bondOf(state)).toBe(bondBefore + 3);

  await returning.reload();
  await waitForApp(returning);
  state = (await readSave(returning))!.state;
  expect(bondOf(state)).toBe(bondBefore + 3);
});
