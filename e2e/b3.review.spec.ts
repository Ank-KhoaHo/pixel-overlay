// Claude's review tests for ticket B3 (fixes from the 0.2.0 whole-build review). agy: never edit this file.
import { expect, test, type Page } from '@playwright/test';
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
const IMG = 'img[data-layer-id="L1"]';

async function open(over: Parameters<typeof oneLayerState>[0] = {}) {
  const png = await screenshotDataUrl(s.page, 200, 100);
  await s.page.evaluate(() => {
    document.body.style.minHeight = '3000px';
  });
  await s.seed(oneLayerState({ naturalWidth: 200, naturalHeight: 100, opacity: 0.5, ...over }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
}

test('Export never puts its download link where the page can see it', async () => {
  await open();
  await s.page.evaluate(() => {
    const w = window as unknown as { poSeen: string[] };
    w.poSeen = [];
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) w.poSeen.push(n.nodeName);
    }).observe(document, { childList: true, subtree: true });
    document.addEventListener('click', (e) => w.poSeen.push('click:' + (e.target as Element).nodeName), true);
  });
  const dl = s.page.waitForEvent('download');
  await s.page.locator(P('export')).click();
  await dl;
  const seen = await s.page.evaluate(() => (window as unknown as { poSeen: string[] }).poSeen);
  expect(seen.filter((x) => x === 'A' || x === 'click:A')).toEqual([]);
});

test('a key press the page makes up does not move a layer; a real one does', async () => {
  await open();
  await s.page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });
  await s.page.waitForTimeout(300);
  expect((await s.state())?.layers[0]?.x).toBe(0);
  await s.page.locator('body').click({ position: { x: 700, y: 500 } });
  await s.page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(1);
});

test('pinning a layer while scrolled keeps it where it is on screen, and unpinning too', async () => {
  await open({ y: 600 });
  await s.page.evaluate(() => window.scrollTo(0, 500));
  const top = async () => Math.round((await s.page.locator(IMG).boundingBox())?.y ?? NaN);
  await expect.poll(top).toBe(100);
  await s.page.locator(P('fixed')).click();
  await expect.poll(top).toBe(100);
  await s.page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(top).toBe(100);
  await s.page.locator(P('fixed')).click();
  await expect.poll(top).toBe(100);
  await expect.poll(async () => (await s.state())?.layers[0]?.y).toBe(400);
});

async function openSide(): Promise<Page> {
  const tabId = await s.worker.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id, s.page.url());
  const side = await s.context.newPage();
  await side.goto(`chrome-extension://${s.extensionId}/sidepanel.html?tabId=${tabId}`);
  return side;
}

test('when the icon hides Pixel Veil, the side panel says so and can show it again', async () => {
  await open();
  const side = await openSide();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toHaveCount(0);
  await expect(side.locator('[data-po="side-hidden"]')).toBeVisible();
  await side.locator('[data-po="side-show"]').click();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect(side.locator('[data-po="layer-row"]')).toHaveCount(1);
});

