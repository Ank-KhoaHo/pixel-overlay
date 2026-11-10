// Claude's review tests for ticket A10 (controls in Chrome's side panel). agy: never edit this file.
// Playwright cannot drive Chrome's real side panel, so these open sidepanel.html?tabId=N in a
// normal tab (the e2e build honours tabId). The real open is checked through the background's log.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { centerX } from '../src/core/align';
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
const IMGS = 'pixel-overlay-layers img';

async function open() {
  const png = await screenshotDataUrl(s.page, 200, 100);
  await s.seed(oneLayerState({ naturalWidth: 200, naturalHeight: 100, name: 'home-desktop' }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMGS)).toHaveCount(1);
  await expect(s.page.locator(P('title'))).toBeVisible();
}

async function tabIdOf(p: Page): Promise<number> {
  const id = await s.worker.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, p.url());
  if (id === undefined) throw new Error(`no tab for ${p.url()}`);
  return id;
}

async function openSide(p: Page = s.page): Promise<Page> {
  const tabId = await tabIdOf(p);
  const side = await s.context.newPage();
  await side.setViewportSize({ width: 360, height: 800 });
  await side.goto(`chrome-extension://${s.extensionId}/sidepanel.html?tabId=${tabId}`);
  return side;
}

test('the page button asks Chrome to open the side panel, and Chrome does', async () => {
  await open();
  await s.page.locator(P('side-panel')).click();
  await expect
    .poll(() => s.worker.evaluate(() => (self as unknown as { poSidePanelLog?: string[] }).poSidePanelLog ?? []))
    .toContain('ok');
});

test('the side panel lists the layers, and the page panel hides while it is open', async () => {
  await open();
  const side = await openSide();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
  await expect(side.locator('body')).toContainText('home-desktop');
  await expect(s.page.locator(P('title'))).toBeHidden();
  await expect(s.page.locator(IMGS)).toHaveCount(1);
  await side.close();
  await expect(s.page.locator(P('title'))).toBeVisible();
});

test('a change made in the side panel reaches the page and is saved', async () => {
  await open();
  const side = await openSide();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
  await side.locator('[data-po="hide-all"]').click();
  await expect(s.page.locator(IMGS).first()).toBeHidden();
  await expect.poll(async () => (await s.state())?.allHidden).toBe(true);
});

test('Center in the side panel uses the page width, not the side panel width', async () => {
  await open();
  const side = await openSide();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
  await side.locator('[data-po="center"]').click();
  const cw = await s.page.evaluate(() => document.documentElement.clientWidth);
  expect(cw).toBeGreaterThan(600);
  const layer = (await s.state())!.layers[0]!;
  const want = centerX(layer, cw);
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(want);
});

test('Add image works from the side panel', async () => {
  await open();
  const side = await openSide();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
  const png = Buffer.from((await screenshotDataUrl(s.page, 64, 32)).split(',')[1]!, 'base64');
  const chooser = side.waitForEvent('filechooser');
  await side.locator('[data-po="add"]').click();
  await (await chooser).setFiles({ name: 'second.png', mimeType: 'image/png', buffer: png });
  await expect(s.page.locator(IMGS)).toHaveCount(2);
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(2);
  await expect.poll(async () => (await s.state())?.layers.length).toBe(2);
});

test('on a tab where Pixel Veil is not running, the side panel says how to start', async () => {
  const other = await s.context.newPage();
  await other.goto(s.page.url() + '?other=1');
  const side = await openSide(other);
  await expect(side.locator('[data-po="side-empty"]')).toBeVisible();
  await expect(side.locator('[data-po="side-empty"]')).toContainText(/click the Pixel Veil icon/i);
  await expect(other.locator('pixel-overlay-panel')).toHaveCount(0);
});

test('Export from the side panel names the file after the site, and Import there adds layers', async () => {
  await open();
  const side = await openSide();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
  const dl = side.waitForEvent('download');
  await side.locator('[data-po="export"]').click();
  const d = await dl;
  expect(d.suggestedFilename()).toMatch(/^pixel-veil-localhost-\d+-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(fs.readFileSync((await d.path())!, 'utf-8'));
  expect(data.site).toMatch(/^http:\/\/localhost:\d+$/);
  const chooser = side.waitForEvent('filechooser');
  await side.locator('[data-po="import"]').click();
  await (await chooser).setFiles({ name: 'site.json', mimeType: 'application/json', buffer: fs.readFileSync((await d.path())!) });
  await expect(s.page.locator(IMGS)).toHaveCount(2);
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(2);
});

