// Claude's review tests for plan Task 4. agy: never edit this file.
import { expect, test } from '@playwright/test';
import { launchSession, maxChannel, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;

test.beforeEach(async () => {
  s = await launchSession();
});

test.afterEach(async () => {
  await s.close();
});

const IMG = 'pixel-overlay-layers img[data-layer-id="L1"]';
const REGION = { x: 0, y: 0, width: 400, height: 300 }; // the four colour blocks

async function showWith(state: ReturnType<typeof oneLayerState>, png: string) {
  await s.seed(state, { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await s.page.locator(IMG).evaluate((el) => (el as HTMLImageElement).decode());
}

test('difference view over an identical design is black', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({}, 'difference'), png);
  expect(await maxChannel(s.page, REGION)).toBeLessThanOrEqual(8);
});

test('positive control: normal view, or a design 10 px off, is not black', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({}, 'normal'), png);
  expect(await maxChannel(s.page, REGION)).toBeGreaterThan(150);

  await s.seed(oneLayerState({ x: 10 }, 'difference'), { I1: png });
  await expect(s.page.locator(IMG)).toHaveCSS('left', '10px');
  expect(await maxChannel(s.page, REGION)).toBeGreaterThan(150);
});

test('the blend is set on the host element', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({}, 'difference'), png);
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCSS('mix-blend-mode', 'difference');
});

test('arrows nudge the active layer 1 px, Shift+arrow 10 px, and the page does not scroll', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ opacity: 0.5 }), png);
  for (let i = 0; i < 3; i++) await s.page.keyboard.press('ArrowRight');
  await s.page.keyboard.press('Shift+ArrowRight');
  await s.page.keyboard.press('ArrowDown');
  await expect(s.page.locator(IMG)).toHaveCSS('left', '13px');
  await expect(s.page.locator(IMG)).toHaveCSS('top', '1px');
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(13);
  expect((await s.state())?.layers[0]?.y).toBe(1);
  expect(await s.page.evaluate(() => window.scrollY)).toBe(0);
});

test('arrows do nothing while typing in a text field, or when the layer is locked', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ opacity: 0.5, locked: true, y: 300 }), png);
  await s.page.keyboard.press('ArrowRight');
  await s.seed(oneLayerState({ opacity: 0.5, y: 300 }), { I1: png }); // unlocked, below the field
  await s.page.locator('#field').focus();
  await s.page.keyboard.press('ArrowRight');
  await s.page.waitForTimeout(300);
  expect((await s.state())?.layers[0]?.x).toBe(0);
  await expect(s.page.locator(IMG)).toHaveCSS('left', '0px');
});

test('a locked layer lets clicks through to the page', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ locked: true, opacity: 0.5 }), png);
  await s.page.mouse.click(100, 440); // the fixture button (20-180, 400-480), under the layer
  await expect(s.page.locator('#btn')).toHaveAttribute('data-clicks', '1');
});

test('positive control: an unlocked active layer takes the click', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ locked: false, opacity: 0.5 }), png);
  await s.page.mouse.click(100, 440);
  await s.page.waitForTimeout(200);
  await expect(s.page.locator('#btn')).not.toHaveAttribute('data-clicks', /.+/);
});

test('dragging the unlocked layer moves it and saves the end position', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ opacity: 0.5 }), png);
  await s.page.mouse.move(300, 300);
  await s.page.mouse.down();
  await s.page.mouse.move(320, 310, { steps: 5 });
  await s.page.mouse.move(340, 330, { steps: 5 });
  await s.page.mouse.up();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(40);
  expect((await s.state())?.layers[0]?.y).toBe(30);
  await expect(s.page.locator(IMG)).toHaveCSS('left', '40px');
});

test('page CSS does not change the layer: size from scale, own opacity', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ scale: 0.5, opacity: 0.7 }), png);
  const box = await s.page.locator(IMG).boundingBox();
  expect(box?.width).toBe(400);
  expect(box?.height).toBe(300);
  await expect(s.page.locator(IMG)).toHaveCSS('opacity', '0.7');
});

test('layers scroll with the page', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({ y: 100, locked: true }), png);
  await s.page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(async () => (await s.page.locator(IMG).boundingBox())?.y).toBe(-400);
});

test('a hidden layer is not drawn; the next icon click hides all, the one after shows again', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await showWith(oneLayerState({}), png);
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toHaveCount(0);
  await expect.poll(async () => (await s.state())?.shown).toBe(false);
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect.poll(async () => (await s.state())?.shown).toBe(true);
  await s.seed(oneLayerState({ visible: false }), { I1: png });
  await expect(s.page.locator(IMG)).toHaveCount(0);
});

test('a fresh click shows the overlay even when it was closed before', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed({ ...oneLayerState({}), shown: false }, { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect.poll(async () => (await s.state())?.shown).toBe(true);
});
