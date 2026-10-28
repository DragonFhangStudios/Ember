import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** The save record and the kept backups, straight from IndexedDB, for "nothing changed" checks. */
export const everythingSaved = (page: Page) =>
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

/** Resets progress through Settings, which keeps the old save as a backup: something real to guard. */
export async function makeBackup(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => ((await everythingSaved(page)) as { backups: unknown[] | null }).backups?.length).toBe(1);
}
