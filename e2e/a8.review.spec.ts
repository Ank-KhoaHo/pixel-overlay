// Claude's review tests for ticket A8 (align helpers). agy: never edit this file.
import { expect, test } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const IMG = 'pixel-overlay-layers img[data-layer-id="L1"]';
const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;

/** A 400x300 design at (x, y). */
async function open(over: Parameters<typeof oneLayerState>[0] = {}) {
  const png = await screenshotDataUrl(s.page, 400, 300);
  await s.seed(oneLayerState({ naturalWidth: 400, naturalHeight: 300, opacity: 0.5, ...over }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
}
const pageWidth = () => s.page.evaluate(() => document.documentElement.clientWidth);

test('Center puts the layer in the middle of the page width, y unchanged', async () => {
  await open({ x: 0, y: 40 });
  const cw = await pageWidth();
  await s.page.locator(P('center')).click();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(Math.round((cw - 400) / 2));
  expect((await s.state())?.layers[0]?.y).toBe(40);
  await expect(s.page.locator(P('x'))).toHaveValue(String(Math.round((cw - 400) / 2)));
});

test('Fit width scales the layer to the page width and moves it to x 0', async () => {
  await open({ x: 50, y: 0 });
  const cw = await pageWidth();
  await s.page.locator(P('fit-width')).click();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(0);
  const scale = (await s.state())!.layers[0]!.scale;
  expect(scale).toBeCloseTo(cw / 400, 3);
  const box = await s.page.locator(IMG).boundingBox();
  expect(Math.abs((box?.width ?? 0) - cw)).toBeLessThanOrEqual(1);
});

test('Center and Fit width are disabled on a locked layer', async () => {
  await open({ locked: true });
  await expect(s.page.locator(P('center'))).toBeDisabled();
  await expect(s.page.locator(P('fit-width'))).toBeDisabled();
});

test('a drag that ends 4 px from the left edge snaps to 0', async () => {
  await open({ x: 40, y: 200 });
  await s.page.mouse.move(140, 300);
  await s.page.mouse.down();
  await s.page.mouse.move(120, 300, { steps: 4 });
  await s.page.mouse.move(104, 300, { steps: 4 });
  await s.page.mouse.up();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(0);
  await expect(s.page.locator(IMG)).toHaveCSS('left', '0px');
});

test('holding Alt while dragging turns snapping off', async () => {
  await open({ x: 40, y: 200 });
  await s.page.mouse.move(140, 300);
  await s.page.mouse.down();
  await s.page.keyboard.down('Alt');
  await s.page.mouse.move(120, 300, { steps: 4 });
  await s.page.mouse.move(104, 300, { steps: 4 });
  await s.page.mouse.up();
  await s.page.keyboard.up('Alt');
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(4);
});

test('arrow nudges never snap: 1 px from the edge stays 1 px', async () => {
  await open({ x: 2, y: 200 });
  await s.page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(1);
});
