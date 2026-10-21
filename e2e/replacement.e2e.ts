import { expect, openApp, readSave, statValue, test, waitForApp } from './fixtures';

test('after the database is deleted and reopened, the screen matches the new save', async ({ page, context }) => {
  await openApp(page);
  await waitForApp(page);
  for (const quest of ['Morning Routine', 'Daily Vitality', 'Symptom Check-in']) await page.getByText(quest).click();
  await expect(statValue(page, 'Energy')).toHaveText('90');

  // Another tab deletes the database while Ember is open.
  const other = await context.newPage();
  await other.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await other.goto('/blank');
  await other.evaluate(
    () =>
      new Promise<void>(resolve => {
        const request = indexedDB.deleteDatabase('ember');
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      }),
  );
  await expect(page.getByText('Preview mode', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Try again' }).click();
  await waitForApp(page);
  await expect(statValue(page, 'Energy')).toHaveText('50'); // new store at revision 1 is shown
  await page.getByText('Hydration Goal').click();
  await expect(statValue(page, 'Energy')).toHaveText('55');
  expect((await readSave(page))?.state.energy).toBe(55);
});
