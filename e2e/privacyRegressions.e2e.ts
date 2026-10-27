import type { Page, Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { factForDay } from '../src/lib/dragonFacts/daily';
import { FACTS } from '../src/lib/dragonFacts/facts';
import { editSave, expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Privacy regression guards for the alpha. Synthetic data only: every
// "sensitive" value below is a made-up marker, never a real player's words.
//
// What these prove (in Chromium, for the screens and actions exercised):
// - a check-in note, a custom quest title and the dragon's name never appear
//   in any request URL, request body or header, the address bar or the title;
// - the app needs no server once loaded (it works with the network off; a
//   reload does need it, as there's no service worker);
// - an imported save can't run script or load outside resources, its text is
//   shown as text, and it can't pollute JavaScript prototypes;
// - every outbound link is https, to an allowlisted publisher domain, opens in
//   a new tab with noopener and noreferrer, and carries no player data.
// What they don't prove: anything about other browsers, browser extensions,
// the hosting provider, the device, or screens these tests don't visit; or
// that the linked pages themselves are family-friendly (not yet reviewed).

const MARKERS = {
  note: 'SYNTHETIC-NOTE-q7v2 felt anxious before class',
  quest: 'SYNTHETIC-QUEST-k3p9',
  name: 'Synthdragonx',
};
const secretBits = ['SYNTHETIC-NOTE-q7v2', 'anxious', 'SYNTHETIC-QUEST-k3p9', 'Synthdragonx'];

/** Records every request the page makes: URL, method, headers and body. */
function recordRequests(page: Page) {
  const seen: { url: string; method: string; text: string }[] = [];
  page.context().on('request', (request: Request) => {
    const headers = JSON.stringify(request.headers());
    seen.push({ url: request.url(), method: request.method(), text: `${request.url()}\n${headers}\n${request.postData() ?? ''}` });
  });
  return seen;
}

const leaks = (seen: { text: string }[]) =>
  seen.flatMap(r => secretBits.filter(bit => r.text.toLowerCase().includes(bit.toLowerCase())).map(bit => `${bit} in ${r.text.split('\n')[0]}`));

/** Renames the dragon to a marker (a reload applies it). */
async function renameDragon(page: Page) {
  await editSave(page, `state.dragonName = ${JSON.stringify(MARKERS.name)};`);
  await page.reload();
  await waitForApp(page);
}

/** A check-in with a note and a custom quest, both made of markers. */
async function addSensitiveData(page: Page) {
  await goToTab(page, 'Check-in');
  await page.getByLabel('Note (optional)').fill(MARKERS.note);
  await page.getByRole('button', { name: 'Log Check-in' }).click();
  await expect.poll(async () => (await readSave(page))!.state.symptomLogs[0]?.notes).toBe(MARKERS.note);
  await goToTab(page, 'Home');
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await page.getByLabel('Quest title').fill(MARKERS.quest);
  await page.getByRole('button', { name: 'Add Quest' }).click();
  await expect(page.getByText(MARKERS.quest)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

test('wellness data never appears in any request, the address bar or the page title', async ({ page }) => {
  test.slow();
  const seen = recordRequests(page);
  await renameDragon(page);
  await addSensitiveData(page);
  // Every screen and dialog that shows or handles it.
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('region', { name: 'Recent Check-ins' })).toContainText('SYNTHETIC-NOTE-q7v2');
  await page.getByRole('button', { name: 'Milestones', exact: true }).click();
  for (const tab of ['Focus', 'Check-in', 'Home'] as const) await goToTab(page, tab);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await sheet.getByRole('button', { name: /Privacy/ }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await waitForApp(page);

  expect(seen.length, 'the app was loaded over the network').toBeGreaterThan(0);
  expect(leaks(seen)).toEqual([]);
  expect(seen.filter(r => r.method !== 'GET').map(r => `${r.method} ${r.url}`), 'nothing is ever posted').toEqual([]);
  const where = await page.evaluate(() => `${location.href}\n${document.title}\n${history.length}`);
  for (const bit of secretBits) expect(where).not.toContain(bit);
});

test('once loaded, Ember needs no server: check-ins, quests and export all work offline', async ({ page, context }) => {
  // (Reloading needs the network: there's no service worker, so the app's files aren't cached offline.)
  await renameDragon(page);
  await context.setOffline(true);
  await addSensitiveData(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Export save' }).click()]);
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.state.symptomLogs[0].notes, 'the export is a local file with the note in it').toBe(MARKERS.note);
  const stored = (await readSave(page))!.state;
  expect(stored.quests.some((q: { title: string }) => q.title === MARKERS.quest)).toBe(true);
  await context.setOffline(false);
});

test('an imported save cannot run script, load outside resources or pollute prototypes; its text stays text', async ({ page }) => {
  test.slow();
  const outside: string[] = [];
  await page.context().route(url => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'), route => {
    outside.push(route.request().url());
    return route.abort();
  });
  const dialogs: string[] = [];
  page.on('dialog', d => {
    dialogs.push(d.message());
    void d.dismiss();
  });

  // Hostile strings in every free-text field a save carries, then a real export
  // (so the file's checksum is valid), a reset, and an import of that file.
  const xss = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  await editSave(page, `
    state.dragonName = 'Ember<svg onload="window.__pwned=3">';
    state.quests.push({ id: 'custom_x', title: ${JSON.stringify(xss)}, description: ${JSON.stringify(xss)}, type: 'custom', completed: false, points: 10, isDaily: true, isCustom: true, progress: 0, target: 1 });
    state.symptomLogs = [{ date: new Date().toISOString(), energy: 3, mood: 3, notes: ${JSON.stringify(xss)} }];
    state.themeColor = 'red;background-image:url(https://evil.example/leak)';
    state.bond = Object.assign({ local: 5 }, JSON.parse('{"__proto__":{"polluted":"bond"}}'));
    state.daily.questRewards = JSON.parse('{"__proto__":{"polluted":"questRewards"}}');
    state.constructor = { prototype: { polluted: 'constructor' } };
  `);
  await page.reload();
  await waitForApp(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Export save' }).click()]);
  const file = await readFile((await download.path())!, 'utf8');
  await sheet.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await readSave(page))!.state.quests.some((q: { id: string }) => q.id === 'custom_x')).toBe(false);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await sheet.getByLabel('Choose a save file to import').setInputFiles({ name: 'ember-save.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await page.getByRole('button', { name: 'Replace My Save' }).click();
  await expect.poll(async () => (await readSave(page))!.state.quests.some((q: { id: string }) => q.id === 'custom_x')).toBe(true);
  await page.reload();
  await waitForApp(page);

  // The hostile text is shown, literally, wherever it appears.
  await expect(page.getByText('<img src=x onerror="window.__pwned=1">', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByRole('region', { name: 'Recent Check-ins' })).toContainText('<script>window.__pwned=2</script>');

  const result = await page.evaluate(() => ({
    pwned: (window as { __pwned?: number }).__pwned ?? null,
    injected: document.querySelectorAll('main img[src="x"], main script, svg[onload]').length,
    polluted: ({} as { polluted?: string }).polluted ?? null,
    arrayPolluted: ([] as unknown as { polluted?: string }).polluted ?? null,
  }));
  expect(result).toEqual({ pwned: null, injected: 0, polluted: null, arrayPolluted: null });
  expect(dialogs, 'no alert, confirm or prompt').toEqual([]);
  expect(outside, 'nothing was fetched from outside').toEqual([]);
});

test('every outbound link is https to an allowlisted publisher domain, opens safely and carries no player data', async ({ page }) => {
  // An allowlist of publisher domains, not a review of the pages: the linked
  // pages haven't yet been checked one by one as family-friendly.
  const allowlisted = new Set(['nationalzoo.si.edu', 'www.nationalzoo.si.edu', 'www.montereybayaquarium.org', 'animaldiversity.org', 'www.nhm.ac.uk', 'www.kew.org']);
  // The data: every real fact's source.
  for (const fact of FACTS) {
    if (fact.kind !== 'real') continue;
    const url = new URL(fact.source.url);
    expect(url.protocol, fact.id).toBe('https:');
    expect(allowlisted.has(url.hostname), `${fact.id} links to ${url.hostname}`).toBe(true);
    expect(url.search + url.hash, `${fact.id} has no query or fragment`).toBe('');
  }

  // The screen: on a day with a real fact (found from the fact rotation), the link's attributes.
  const realDay = Array.from({ length: 60 }, (_, i) => new Date(2026, 9, 1 + i, 12)).find(d => factForDay(d).kind === 'real')!;
  await page.clock.setFixedTime(realDay);
  await editSave(page, `state.dragonName = ${JSON.stringify(MARKERS.name)};`);
  await page.reload();
  await waitForApp(page);
  const links = page.locator('a[href^="http"]');
  await expect(links).not.toHaveCount(0);
  for (const link of await links.all()) {
    const href = (await link.getAttribute('href'))!;
    expect(href.startsWith('https://'), href).toBe(true);
    expect(allowlisted.has(new URL(href).hostname), href).toBe(true);
    expect(href).not.toContain(MARKERS.name);
    await expect(link).toHaveAttribute('target', '_blank');
    const rel = (await link.getAttribute('rel')) ?? '';
    expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
  }
});
