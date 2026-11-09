// Claude's review tests for ticket B1. agy: never edit this file.
import { expect, test } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

declare const chrome: {
  storage: { local: { set(i: Record<string, unknown>): Promise<void> } };
  scripting: { executeScript(o: Record<string, unknown>): Promise<unknown> };
  tabs: { query(q: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>> };
};

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const IMG = 'pixel-overlay-layers img[data-layer-id="L1"]';
const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;

async function open(over: Parameters<typeof oneLayerState>[0] = {}) {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5, ...over }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  return png;
}

async function tabId(): Promise<number> {
  const url = s.page.url();
  return s.worker.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id ?? -1, url);
}

test('1: a focused X field does not undo a mouse drag', async () => {
  await open();
  await s.page.locator(P('x')).click();
  await s.page.mouse.move(300, 300);
  await s.page.mouse.down();
  await s.page.mouse.move(320, 310, { steps: 4 });
  await s.page.mouse.move(340, 330, { steps: 4 });
  await s.page.mouse.up();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(40);
  await s.page.locator(P('title')).click();
  await s.page.waitForTimeout(400);
  expect((await s.state())?.layers[0]?.x).toBe(40);
  await expect(s.page.locator(P('x'))).toHaveValue('40');
});

test('1b: typing in X and clicking away commits the typed value', async () => {
  await open();
  await s.page.locator(P('x')).fill('25');
  await s.page.locator(P('title')).click();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(25);
});

test('3: layers come back after the page rewrites <html>', async () => {
  await open();
  await s.page.evaluate(() => {
    document.documentElement.innerHTML =
      '<head></head><body style="margin:0;height:2000px"><p>new app</p></body>';
  });
  await s.clickIcon();
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect(s.page.locator(P('title'))).toBeVisible();
});

test('4: arrows do not move the layer while typing in a closed shadow root input', async () => {
  await open({ y: 300 });
  await s.page.evaluate(() => {
    const host = document.createElement('x-field');
    const root = host.attachShadow({ mode: 'closed' });
    const input = document.createElement('input');
    root.append(input);
    document.body.append(host);
    input.focus();
  });
  await s.page.keyboard.press('ArrowLeft');
  await s.page.keyboard.press('ArrowLeft');
  await s.page.waitForTimeout(300);
  expect((await s.state())?.layers[0]?.x).toBe(0);
});

test('5: layers scroll with <body> when <body> is the scroll container', async () => {
  await open({ y: 100, locked: true });
  await s.page.evaluate(() => {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'auto';
    const tall = document.createElement('div');
    tall.style.height = '4000px';
    document.body.append(tall);
    document.body.scrollTop = 500;
  });
  await expect
    .poll(async () => Math.round((await s.page.locator(IMG).boundingBox())?.y ?? 0))
    .toBe(-400);
});

test('6: closing the grant window without Allow leaves Keep unchecked', async () => {
  await open();
  const grantPage = s.context.waitForEvent('page');
  await s.page.locator(P('keep')).click();
  const g = await grantPage;
  await g.waitForLoadState();
  await g.close();
  await s.page.bringToFront();
  await expect(s.page.locator(P('keep'))).not.toBeChecked();
});

test('6b: the Keep checkbox follows the stored list', async () => {
  await open();
  await s.worker.evaluate((o) => chrome.storage.local.set({ 'po.kept': [o] }), s.fixture.origin);
  await expect(s.page.locator(P('keep'))).toBeChecked();
  await s.worker.evaluate(() => chrome.storage.local.set({ 'po.kept': [] }));
  await expect(s.page.locator(P('keep'))).not.toBeChecked();
});

test('7: Hide all twice keeps a layer the user hid', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  const st = oneLayerState({ opacity: 0.5 });
  st.layers.push({ ...st.layers[0]!, id: 'L2', name: 'two', visible: false });
  await s.seed(st, { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await s.page.locator(P('hide-all')).click();
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(0);
  await expect.poll(async () => (await s.state())?.allHidden).toBe(true);
  await s.page.locator(P('hide-all')).click();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect.poll(async () => (await s.state())?.layers.map((l) => l.visible)).toEqual([true, false]);
  await expect(s.page.locator('pixel-overlay-layers img[data-layer-id="L2"]')).toHaveCount(0);
});

test('9: the icon still works when a dead old instance left its flag behind', async () => {
  const id = await tabId();
  // An old content script (from before an extension update) set the flag, then lost its runtime.
  await s.worker.evaluate(
    (tab) =>
      chrome.scripting.executeScript({
        target: { tabId: tab },
        func: () => {
          (window as unknown as Record<string, unknown>).__pixelOverlay = true;
          (window as unknown as Record<string, unknown>).__pixelOverlayAlive = () => false;
          const ghost = document.createElement('pixel-overlay-panel');
          document.documentElement.append(ghost);
        },
      }),
    id,
  );
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  await expect(s.page.locator('pixel-overlay-panel')).toHaveCount(1);
});

test('10: a dropped SVG is refused like a picked one', async () => {
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  await s.page.locator(P('title')).evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg', { type: 'image/svg+xml' }),
    );
    el.dispatchEvent(
      new DragEvent('drop', { dataTransfer: dt, bubbles: true, composed: true, cancelable: true }),
    );
  });
  await expect(s.page.locator(P('error'))).toContainText(/svg/i);
  expect((await s.state())?.layers ?? []).toHaveLength(0);
});

test('injecting the script twice draws one copy', async () => {
  await open();
  const id = await tabId();
  await s.worker.evaluate(
    (tab) =>
      chrome.scripting.executeScript({
        target: { tabId: tab },
        files: ['/content-scripts/overlay.js'],
      }),
    id,
  );
  await s.page.waitForTimeout(500);
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCount(1);
  await expect(s.page.locator('pixel-overlay-panel')).toHaveCount(1);
});

test('B2: Enter in a number field leaves it, so the next arrows move the layer', async () => {
  await open();
  await s.page.locator(P('opacity')).fill('100');
  await s.page.locator(P('opacity')).press('Enter');
  await s.page.keyboard.press('ArrowDown');
  await s.page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await s.state())?.layers[0]?.y).toBe(2);
  expect((await s.state())?.layers[0]?.opacity).toBe(1);
});
