import type { Locator, Page } from '@playwright/test';
import { expect, goToTab, openApp, readSave, test, waitForApp } from './fixtures';

// Phone layout (#16). Runs at 390px, at 360px, and on an emulated Pixel 7
// (touch, mobile user agent, high-density screen); see playwright.config.ts.

const MIN_TAP_TARGET = 44;
/** iPhone-style notch and home indicator. */
const NOTCH = { top: 47, bottom: 34, left: 0, right: 0 };

/** What's wrong with the current screen on this phone: horizontal scrolling, cut-off text or controls, small tap targets. */
function layoutProblems(page: Page) {
  return page.evaluate(minTarget => {
    const width = document.documentElement.clientWidth;
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const describe = (e: Element) => {
      const r = e.getBoundingClientRect();
      const name = (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30);
      return `${e.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}×${Math.round(r.height)} at x=${Math.round(r.left)}`;
    };
    const controls = [...document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="switch"]')].filter(shown);
    const text = [...document.querySelectorAll('body *')].filter(
      e => shown(e) && [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()),
    );
    // Half a pixel of slack for subpixel layout.
    return {
      horizontalScroll: document.documentElement.scrollWidth > width,
      cutOff: [...new Set([...controls, ...text])]
        .filter(e => e.getBoundingClientRect().left < -0.5 || e.getBoundingClientRect().right > width + 0.5)
        .map(describe),
      smallTapTargets: controls
        .filter(e => e.getBoundingClientRect().width < minTarget - 0.5 || e.getBoundingClientRect().height < minTarget - 0.5)
        .map(describe),
    };
  }, MIN_TAP_TARGET);
}

/**
 * Waits for the screen's heading (tab content swaps in after the old tab's
 * exit animation, and an empty screen would pass trivially), then polls so
 * enter animations can finish.
 */
async function expectGoodLayout(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect
    .poll(() => layoutProblems(page), { message: `layout of ${heading}` })
    .toEqual({ horizontalScroll: false, cutOff: [], smallTapTargets: [] });
}

/** Taps on touch devices (the Pixel 7 project) and clicks elsewhere. */
const press = (locator: Locator) => (test.info().project.use.hasTouch ? locator.tap() : locator.click());

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'element is laid out').not.toBeNull();
  return b!;
}

async function emulateSafeArea(page: Page, insets: typeof NOTCH) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await waitForApp(page);
});

/** The heading each tab shows once its content is in. */
const TAB_HEADINGS = { Home: 'Daily Quests', Focus: 'Focus Quest', 'Check-in': 'Daily Check-in', Shop: 'Dragon Wardrobe' } as const;

test('every screen and dialog fits the phone, with tap targets of at least 44×44px', async ({ page }) => {
  await expectGoodLayout(page, TAB_HEADINGS.Home);
  for (const tab of ['Focus', 'Check-in', 'Shop'] as const) {
    await goToTab(page, tab);
    await expectGoodLayout(page, TAB_HEADINGS[tab]);
  }

  // Log a check-in so the logged view and the Insights charts are covered too.
  await goToTab(page, 'Check-in');
  await page.getByRole('button', { name: 'Log Check-in' }).click();
  await expectGoodLayout(page, 'Check-in Logged');
  await page.getByRole('button', { name: 'Insights' }).click();
  await expectGoodLayout(page, 'Health Insights');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await expectGoodLayout(page, 'Milestones');

  await page.getByRole('button', { name: 'Settings' }).click();
  await expectGoodLayout(page, 'Settings');
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await expectGoodLayout(page, 'Reset Progress?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();

  await goToTab(page, 'Home');
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await expectGoodLayout(page, 'Add Custom Quest');
  await page.getByRole('button', { name: 'New Type' }).click();
  await expectGoodLayout(page, 'New Quest Type');
});

test('the header shows the logo and three controls, all fully on screen', async ({ page }) => {
  const header = page.locator('header');
  await expect(header.getByRole('heading', { name: 'Ember' })).toBeInViewport({ ratio: 1 });
  await expect(header.getByRole('button')).toHaveCount(3);
  for (const name of ['Insights', 'Milestones', 'Settings']) {
    await expect(header.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
  }
});

test('the bottom navigation never covers content, including on notched phones', async ({ page }) => {
  const viewportHeight = page.viewportSize()!.height;
  for (const insets of [null, NOTCH]) {
    if (insets) await emulateSafeArea(page, insets);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    const navBox = await box(nav(page));
    const lastContent = await box(page.locator('main > *').last());
    expect(lastContent.y + lastContent.height, 'end of the page clears the nav').toBeLessThanOrEqual(navBox.y);

    for (const name of ['Home', 'Focus', 'Check-in', 'Shop']) {
      const button = await box(nav(page).getByRole('button', { name, exact: true }));
      expect(button.y + button.height, `${name} clears the home indicator`).toBeLessThanOrEqual(viewportHeight - (insets?.bottom ?? 0));
    }
    const settings = await box(page.getByRole('button', { name: 'Settings' }));
    expect(settings.y, 'header controls clear the notch').toBeGreaterThanOrEqual(insets?.top ?? 0);
  }
});

test('reward and streak messages appear near the quest that was tapped', async ({ page }) => {
  // The last one-step quest, at the bottom of the list.
  const quest = page.getByRole('button', { name: /Symptom Check-in/ });
  await quest.scrollIntoViewIfNeeded();
  await press(quest);

  const message = page.getByRole('status').getByText('Today counts!', { exact: false });
  await expect(message).toBeInViewport({ ratio: 1 });
  await expect(quest, 'the page stays where the player tapped').toBeInViewport();
  const toast = await box(message);
  expect(toast.y + toast.height, 'above the nav').toBeLessThanOrEqual((await box(nav(page))).y);
});

test('Settings holds background color and appearance, and saves them', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await expect(sheet.getByRole('button', { name: 'Warm White' })).toHaveAttribute('aria-pressed', 'true');

  await press(sheet.getByRole('button', { name: 'Lavender' }));
  await expect(sheet.getByRole('button', { name: 'Lavender' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readSave(page))?.state.themeColor).toBe('#F5F3FF');

  // A new player follows the system until choosing.
  await expect(sheet.getByRole('radio', { name: 'System' })).toBeChecked();
  const dark = sheet.getByRole('radio', { name: 'Dark' });
  await press(dark);
  await expect(dark).toBeChecked();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(async () => (await readSave(page))?.state.theme).toBe('dark');

  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings' }), 'focus returns to where it was').toBeFocused();
});

test('reset in Settings still asks first, and Cancel keeps all progress', async ({ page }) => {
  await page.getByText('Morning Routine').click();
  await expect.poll(async () => (await readSave(page))?.state.energy).toBe(60);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await expect(page.getByText('Reset Progress?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Reset Progress?')).toHaveCount(0);
  expect((await readSave(page))!.state.energy).toBe(60);

  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, Reset Everything' }).click();
  await expect.poll(async () => (await readSave(page))?.state.quests.find((q: any) => q.id === 'q1').completed).toBe(false);
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
});

test('the Focus tab brings large, one-handed timer controls into view', async ({ page }) => {
  await goToTab(page, 'Focus');
  const start = page.getByRole('button', { name: 'Start focus' });
  await expect(start).toBeInViewport({ ratio: 1 });
  const size = await box(start);
  expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(64);

  await press(start);
  await expect(page.getByRole('button', { name: 'Pause focus' })).toBeInViewport({ ratio: 1 });

  await goToTab(page, 'Home');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('text follows the browser font size and still fits', async ({ page }) => {
  const label = page.getByText('Streak', { exact: true });
  const fontSize = () => label.evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  const normal = await fontSize();
  await page.addStyleTag({ content: 'html { font-size: 125%; }' });
  await expect.poll(fontSize).toBeCloseTo(normal * 1.25);

  for (const tab of ['Home', 'Focus'] as const) {
    await goToTab(page, tab);
    await expect(page.getByRole('heading', { name: TAB_HEADINGS[tab] })).toBeVisible();
    await expect
      .poll(async () => {
        const { horizontalScroll, cutOff } = await layoutProblems(page);
        return { horizontalScroll, cutOff };
      }, { message: `${tab} at 125% text` })
      .toEqual({ horizontalScroll: false, cutOff: [] });
  }
});

test('quests also work from the keyboard (Enter or Space)', async ({ page }) => {
  await page.getByRole('button', { name: /Morning Routine/ }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSave(page))?.state.energy).toBe(60);
});
