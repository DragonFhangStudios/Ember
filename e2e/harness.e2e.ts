import { expect, test } from './fixtures';

// Checks the test harness itself (see fixtures.ts).

test('an uncaught error in any tab, not only the first, is caught', async ({ context, page, pageErrors }) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await second.evaluate(() => {
    setTimeout(() => {
      throw new Error('boom in the second tab');
    });
  });
  await expect.poll(() => pageErrors).toEqual(['tab 2: boom in the second tab']);
  pageErrors.length = 0; // expected here, so it must not fail this test
});
