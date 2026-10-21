import { test as base, expect, type Page } from '@playwright/test';

/** The save record as stored in IndexedDB (see src/lib/store.ts). */
export interface SaveRecord {
  state: Record<string, any>;
  rev: number;
  migratedFromLocalStorage?: boolean;
  legacySaveUnreadable?: boolean;
}

export const LEGACY_KEY = 'ember_user_state_v2';

/**
 * Every page blocks third-party images and fonts (speed, determinism), and
 * an uncaught error in any tab of the context (the main page, extra tabs,
 * popups) fails the test.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({}, use) => {
    await use([]);
  },
  context: async ({ context, pageErrors }, use) => {
    await context.route(/picsum\.photos|fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
    // No random Easter eggs: tests that want Ember's keyboard set this to 1.
    await context.addInitScript(() => {
      (window as { __emberEasterEggChance?: number }).__emberEasterEggChance = 0;
    });
    let tabs = 0;
    const watch = (page: Page) => {
      const tab = ++tabs;
      page.on('pageerror', error => pageErrors.push(`tab ${tab}: ${error.message}`));
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use(context);
    expect(pageErrors, 'uncaught errors in any tab').toEqual([]);
  },
});

export { expect };

/** Waits until the main game screen is ready. */
export async function waitForApp(page: Page) {
  await expect(page.getByText('Daily Quests')).toBeVisible();
}

/** Opens Ember with optional localStorage seeding before the app starts. */
export async function openApp(page: Page, seed?: { legacy?: string }) {
  if (seed?.legacy !== undefined) {
    await page.addInitScript(([key, value]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, value);
      }
    }, [LEGACY_KEY, seed.legacy] as const);
  }
  await page.goto('/');
}

/** Reads the save record straight from IndexedDB (undefined if there is none). */
export function readSave(page: Page): Promise<SaveRecord | undefined> {
  return page.evaluate(
    () =>
      new Promise<any>(resolve => {
        const open = indexedDB.open('ember');
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => resolve(undefined);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.close();
            resolve(undefined);
            return;
          }
          const get = db.transaction('saves').objectStore('saves').get('player');
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => {
            db.close();
            resolve(undefined);
          };
        };
      }),
  );
}

/** Edits the stored save directly (e.g. to simulate time passing while Ember was closed). */
export async function editSave(page: Page, edit: string) {
  await page.evaluate(
    source =>
      new Promise<void>((resolve, reject) => {
        const apply = new Function('state', source) as (state: any) => void;
        const open = indexedDB.open('ember');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('saves', 'readwrite');
          const store = tx.objectStore('saves');
          const get = store.get('player');
          get.onsuccess = () => {
            const record = get.result;
            apply(record.state);
            record.rev += 1;
            store.put(record, 'player');
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    edit,
  );
}

/** Total Bond in a stored state. */
export const bondOf = (state: Record<string, any>) =>
  Object.values(state.bond as Record<string, number>).reduce((sum, v) => sum + v, 0);

/** The value shown in a stats tile (e.g. "Energy"). */
export const statValue = (page: Page, label: string) =>
  page.locator('p', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::p');

export const goToTab = (page: Page, name: 'Home' | 'Focus' | 'Check-in' | 'Shop') =>
  page.getByRole('button', { name, exact: true }).click();

export const focusTimerText = (page: Page) => page.locator('span.font-mono');
