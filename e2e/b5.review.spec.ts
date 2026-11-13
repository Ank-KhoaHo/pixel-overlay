// Claude's review tests for ticket B5 (keyboard and screen reader pass). agy: never edit this file.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

declare const chrome: {
  tabs: { query(q: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>> };
};

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;

// Two layers: 'design' (L1, bottom) and 'second' (L2, top, in the list first). L1 is active.
async function open() {
  const png = await screenshotDataUrl(s.page, 200, 100);
  const st = oneLayerState({ naturalWidth: 200, naturalHeight: 100, opacity: 0.5, group: 'home' });
  st.layers.push({ ...st.layers[0]!, id: 'L2', name: 'second', group: 'login' });
  await s.seed(st, { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  return s.page.locator('pixel-overlay-panel');
}

async function openSide(): Promise<Page> {
  const tabId = await s.worker.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, s.page.url());
  const side = await s.context.newPage();
  await side.goto(`chrome-extension://${s.extensionId}/sidepanel.html?tabId=${tabId}`);
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(2);
  return side;
}

// A control a screen reader reads as just "button" or "combobox", or as a symbol.
function unnamed(snapshot: string): string[] {
  return snapshot
    .split('\n')
    .filter((l) => /^\s*- (button|combobox|spinbutton|slider|checkbox|textbox)\s*(:|$)/.test(l) || /- button "[▴▾×↑↓½]"/.test(l));
}

test('every control in the panel and the side panel has a name, not a symbol', async () => {
  const panel = await open();
  expect(unnamed(await panel.ariaSnapshot())).toEqual([]);
  const side = await openSide();
  expect(unnamed(await side.locator('body').ariaSnapshot())).toEqual([]);
});

test('the lists and number boxes carry the names a screen reader needs', async () => {
  const panel = await open();
  const has = async (role: Parameters<Locator['getByRole']>[0], name: string, po: string) =>
    expect(panel.getByRole(role, { name, exact: true })).toHaveAttribute('data-po', po);
  await has('combobox', 'Blend mode', 'blend-mode');
  await has('combobox', 'Show group', 'group-filter');
  await has('spinbutton', 'Opacity', 'opacity');
  await has('slider', 'Opacity', 'opacity-slider');
  await has('spinbutton', 'Scale', 'scale');
  await has('button', 'Collapse panel', 'collapse');
  await has('button', 'Close panel', 'close');
  await panel.getByRole('button', { name: 'Collapse panel', exact: true }).click();
  await has('button', 'Expand panel', 'collapse');
});

test('each row button says which layer it acts on', async () => {
  const panel = await open();
  const row = panel.locator('[data-po="layer-row"]', { hasText: 'second' });
  await expect(row.getByRole('button', { name: 'Hide second', exact: true })).toHaveAttribute('data-po', 'eye');
  await expect(row.getByRole('button', { name: 'Move second up', exact: true })).toHaveAttribute('data-po', 'up');
  await expect(row.getByRole('button', { name: 'Move second down', exact: true })).toHaveAttribute('data-po', 'down');
  await expect(row.getByRole('button', { name: 'Delete second', exact: true })).toHaveAttribute('data-po', 'delete');
  await row.getByRole('button', { name: 'Hide second', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Show second', exact: true })).toHaveAttribute('data-po', 'eye');
  // Delete takes two presses; after the first, the name says the next one deletes.
  await row.locator('[data-po="delete"]').click();
  await expect(row.locator('[data-po="delete"]')).toHaveAccessibleName(/again.*second|second.*again/i);
  expect((await s.state())?.layers).toHaveLength(2);
});

test('a layer can be made active from the keyboard, and the active one is marked', async () => {
  const panel = await open();
  const second = panel.getByRole('button', { name: 'second', exact: true });
  const design = panel.getByRole('button', { name: 'design', exact: true });
  await expect(design).toHaveAttribute('aria-current', 'true');
  await expect(second).not.toHaveAttribute('aria-current', 'true');
  await second.focus();
  await s.page.keyboard.press('Enter');
  await expect.poll(async () => (await s.state())?.activeLayerId).toBe('L2');
  await expect(second).toHaveAttribute('aria-current', 'true');
  await expect(design).not.toHaveAttribute('aria-current', 'true');
  await design.focus();
  await s.page.keyboard.press('Space');
  await expect.poll(async () => (await s.state())?.activeLayerId).toBe('L1');
});

test('a layer can be renamed from the keyboard with F2', async () => {
  const panel = await open();
  await panel.getByRole('button', { name: 'second', exact: true }).focus();
  await s.page.keyboard.press('F2');
  const box = panel.getByRole('textbox', { name: 'Layer name', exact: true });
  await expect(box).toBeFocused();
  await box.fill('renamed');
  await s.page.keyboard.press('Enter');
  await expect.poll(async () => (await s.state())?.layers.find((l) => l.id === 'L2')?.name).toBe('renamed');
  // Focus comes back to the layer, not to the page.
  await expect(panel.getByRole('button', { name: 'renamed', exact: true })).toBeFocused();
});

test('double-click still renames a layer', async () => {
  const panel = await open();
  // The top row is 'second'. (A row being renamed no longer has the name as text.)
  const row = panel.locator('[data-po="layer-row"]').first();
  await expect(row).toContainText('second');
  await row.locator('.layer-name').dblclick();
  await expect(row.locator('.layer-rename-input')).toBeVisible();
});

test('Lock is one toggle with a fixed name', async () => {
  const panel = await open();
  const lock = panel.getByRole('button', { name: 'Lock', exact: true });
  await expect(lock).toHaveAttribute('data-po', 'lock');
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await s.state())?.layers.find((l) => l.id === 'L1')?.locked).toBe(true);
});

test('the panel is a named region with a heading, in the page and the side panel', async () => {
  const panel = await open();
  await expect(panel.getByRole('region', { name: 'Pixel Veil', exact: true })).toHaveCount(1);
  await expect(panel.getByRole('heading', { name: 'Pixel Veil', exact: true })).toHaveCount(1);
  const side = await openSide();
  await expect(side.getByRole('heading', { name: 'Pixel Veil', exact: true })).toHaveCount(1);
});

test('the panel shows where focus is when it gets focus from the keyboard', async () => {
  const panel = await open();
  const region = panel.getByRole('region', { name: 'Pixel Veil', exact: true });
  await s.page.locator(P('title')).click();
  await s.page.keyboard.press('Tab');
  await s.page.keyboard.press('Shift+Tab');
  await expect(region).toBeFocused();
  const outline = await region.evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(outline).not.toBe('none');
});

test('an image error is announced', async () => {
  const panel = await open();
  const chooser = s.page.waitForEvent('filechooser');
  await s.page.locator(P('add')).click();
  await (await chooser).setFiles({
    name: 'x.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
  });
  await expect(panel.getByRole('alert')).toContainText('SVG');
});
