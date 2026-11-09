// Claude's review tests for plan Task 5. agy: never edit this file.
import { expect, test, type Page } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;

test.beforeEach(async () => {
  s = await launchSession();
});

test.afterEach(async () => {
  await s.close();
});

const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;
const ROWS = 'pixel-overlay-panel [data-po="layer-row"]';

/** A small solid PNG made by a canvas in the page. */
async function pngBytes(page: Page, w: number, h: number, colour: string): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ w, h, colour }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL('image/png').split(',')[1]!;
    },
    { w, h, colour },
  );
  return Buffer.from(b64, 'base64');
}

async function openEmpty() {
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
}

async function addFile(name: string, buffer: Buffer, mimeType = 'image/png') {
  const chooser = s.page.waitForEvent('filechooser');
  await s.page.locator(P('add')).click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}

test('the panel shows on icon click, with the empty-state hint', async () => {
  await openEmpty();
  await expect(s.page.locator('pixel-overlay-panel')).toContainText('Drop a design image here');
  // Nothing to hide or blend yet.
  await expect(s.page.locator(P('hide-all'))).toBeDisabled();
});

test('page CSS does not reach the panel', async () => {
  await openEmpty();
  await expect(s.page.locator(P('title'))).toHaveCSS('font-size', '13px');
});

test('Add image stores the image and a layer on top, active, named from the file', async () => {
  await openEmpty();
  await addFile('home@2x.png', await pngBytes(s.page, 64, 32, '#ff0000'));
  await expect(s.page.locator(ROWS)).toHaveCount(1);
  await expect(s.page.locator(ROWS).first()).toContainText('home@2x');
  const st = await s.state();
  expect(st?.layers).toHaveLength(1);
  expect(st?.layers[0]).toMatchObject({ name: 'home@2x', naturalWidth: 64, naturalHeight: 32, opacity: 0.5 });
  expect(st?.activeLayerId).toBe(st?.layers[0]?.id);
  const imgKey = `po.img.${st?.layers[0]?.imageId}`;
  const stored = await s.worker.evaluate((k) => chrome.storage.local.get(k), imgKey);
  expect(String(stored[imgKey])).toMatch(/^data:image\/png;base64,/);
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(1);
});

test('an SVG is refused with a message, and nothing is stored', async () => {
  await openEmpty();
  await addFile('logo.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml');
  await expect(s.page.locator(P('error'))).toContainText(/svg/i);
  expect((await s.state())?.layers ?? []).toHaveLength(0);
});

test('dropping two files adds two layers; the list shows the top layer first', async () => {
  await openEmpty();
  const a = (await pngBytes(s.page, 10, 10, '#00ff00')).toString('base64');
  const b = (await pngBytes(s.page, 10, 10, '#0000ff')).toString('base64');
  const panel = s.page.locator(P('title'));
  await panel.evaluate(
    (el, files) => {
      const dt = new DataTransfer();
      for (const f of files) {
        const bin = Uint8Array.from(atob(f.b64), (ch) => ch.charCodeAt(0));
        dt.items.add(new File([bin], f.name, { type: 'image/png' }));
      }
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, composed: true, cancelable: true }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, composed: true, cancelable: true }));
    },
    [
      { name: 'first.png', b64: a },
      { name: 'second.png', b64: b },
    ],
  );
  await expect(s.page.locator(ROWS)).toHaveCount(2);
  await expect(s.page.locator(ROWS).nth(0)).toContainText('second');
  await expect(s.page.locator(ROWS).nth(1)).toContainText('first');
});

test('controls edit the active layer: opacity, X, Y, ½, lock', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  await s.page.locator(P('opacity')).fill('80');
  await s.page.locator(P('opacity')).press('Enter');
  await s.page.locator(P('x')).fill('-12');
  await s.page.locator(P('x')).press('Enter');
  await s.page.locator(P('y')).fill('34');
  await s.page.locator(P('y')).press('Enter');
  await s.page.locator(P('half')).click();
  await s.page.locator(P('lock')).click();
  await expect.poll(async () => (await s.state())?.layers[0]).toMatchObject({
    opacity: 0.8,
    x: -12,
    y: 34,
    scale: 0.5,
    locked: true,
  });
  await expect(s.page.locator(P('scale'))).toHaveValue('0.5');
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCSS('opacity', '0.8');
});

test('typing in a panel field does not nudge the layer', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  await s.page.locator(P('x')).focus();
  await s.page.keyboard.press('ArrowLeft');
  await s.page.keyboard.press('ArrowRight');
  await s.page.waitForTimeout(300);
  expect((await s.state())?.layers[0]?.x).toBe(0);
});

test('blend, eye, hide all', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(P('blend'))).toHaveAttribute('aria-pressed', 'false');
  await expect(s.page.locator(P('blend'))).toHaveText('Difference');
  await s.page.locator(P('blend')).click();
  await expect.poll(async () => (await s.state())?.blend).toBe('difference');
  await expect(s.page.locator(P('blend'))).toHaveAttribute('aria-pressed', 'true');
  await expect(s.page.locator(P('blend'))).toHaveText('Difference');
  await s.page.locator(P('eye')).click();
  await expect.poll(async () => (await s.state())?.layers[0]?.visible).toBe(false);
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(0);
  await s.page.locator(P('eye')).click();
  await expect(s.page.locator(P('hide-all'))).toHaveAttribute('aria-pressed', 'false');
  await s.page.locator(P('hide-all')).click();
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(0);
  await expect(s.page.locator(P('hide-all'))).toHaveAttribute('aria-pressed', 'true');
  await expect(s.page.locator(P('hide-all'))).toHaveText('Hide all');
  await expect(s.page.locator(P('title'))).toBeVisible();
});

test('reorder, select by row, delete removes the image too', async () => {
  await openEmpty();
  await addFile('a.png', await pngBytes(s.page, 8, 8, '#111111'));
  await addFile('b.png', await pngBytes(s.page, 8, 8, '#222222'));
  await expect(s.page.locator(ROWS)).toHaveCount(2);
  // Top row is b. Move it down.
  await s.page.locator(ROWS).nth(0).locator('[data-po="down"]').click();
  await expect(s.page.locator(ROWS).nth(0)).toContainText('a');
  await expect.poll(async () => (await s.state())?.layers.map((l) => l.name)).toEqual(['b', 'a']);
  // Select a (top row) and delete it.
  await s.page.locator(ROWS).nth(0).click();
  const st = await s.state();
  const a = st!.layers.find((l) => l.name === 'a')!;
  await expect.poll(async () => (await s.state())?.activeLayerId).toBe(a.id);
  // Delete asks once: the first click arms it, the second deletes.
  await s.page.locator(ROWS).nth(0).locator('[data-po="delete"]').click();
  await s.page.waitForTimeout(300);
  await expect(s.page.locator(ROWS)).toHaveCount(2);
  await expect(s.page.locator(ROWS).nth(0).locator('[data-po="delete"]')).toHaveText(/delete\?/i);
  await s.page.locator(ROWS).nth(0).locator('[data-po="delete"]').click();
  await expect(s.page.locator(ROWS)).toHaveCount(1);
  const key = `po.img.${a.imageId}`;
  await expect.poll(async () => s.worker.evaluate((k) => chrome.storage.local.get(k), key)).toEqual({});
});

test('collapse and close', async () => {
  await openEmpty();
  await s.page.locator(P('collapse')).click();
  await expect(s.page.locator(P('add'))).toBeHidden();
  await expect.poll(async () => (await s.state())?.panel.collapsed).toBe(true);
  await s.page.locator(P('collapse')).click();
  await expect(s.page.locator(P('add'))).toBeVisible();
  await s.page.locator(P('close')).click();
  await expect(s.page.locator(P('title'))).toHaveCount(0);
  await expect.poll(async () => (await s.state())?.shown).toBe(false);
});

declare const chrome: { storage: { local: { get(k: string): Promise<Record<string, unknown>> } } };

test('X and Y fields are labelled', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  const panel = s.page.locator('pixel-overlay-panel');
  await expect(panel.getByLabel('X', { exact: true })).toHaveAttribute('data-po', 'x');
  await expect(panel.getByLabel('Y', { exact: true })).toHaveAttribute('data-po', 'y');
});

test('an armed delete disarms itself after 3 seconds', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  await s.page.locator(ROWS).first().locator('[data-po="delete"]').click();
  await s.page.waitForTimeout(3500);
  await s.page.locator(ROWS).first().locator('[data-po="delete"]').click();
  await s.page.waitForTimeout(300);
  await expect(s.page.locator(ROWS)).toHaveCount(1);
});

test('a panel saved off-screen is drawn inside the window', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed({ ...oneLayerState({}), panel: { x: 5000, y: 4000, collapsed: false } }, { I1: png });
  await s.clickIcon();
  const box = await s.page.locator(P('title')).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(800);
  expect(box!.y + box!.height).toBeLessThanOrEqual(600);
});

test('after clicking a layer row, arrow keys still nudge that layer', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  await s.page.locator(ROWS).first().click();
  await s.page.keyboard.press('ArrowRight');
  await s.page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(1);
  expect((await s.state())?.layers[0]?.y).toBe(10);
});
