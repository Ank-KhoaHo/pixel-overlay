// Claude's review tests for ticket A6 (compare modes). agy: never edit this file.
import { expect, test, type Page } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const IMG = 'pixel-overlay-layers img[data-layer-id="L1"]';
const HOST = 'pixel-overlay-layers';
const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;

async function open(opacity = 1) {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await s.page.locator(IMG).evaluate((el) => (el as HTMLImageElement).decode());
}

/** The RGB of one screen pixel, read from a real screenshot. */
async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const probe = await page.context().newPage();
  try {
    return await probe.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!] as [number, number, number];
    }, `data:image/png;base64,${buf.toString('base64')}`);
  } finally {
    await probe.close();
  }
}

const near = (a: number, b: number) => Math.abs(a - b) <= 6;

test('the mode list sets the blend on the host: Multiply, then Screen', async () => {
  await open();
  await s.page.locator(P('blend-mode')).selectOption('multiply');
  await expect(s.page.locator(HOST)).toHaveCSS('mix-blend-mode', 'multiply');
  await expect.poll(async () => (await s.state())?.blend).toBe('multiply');
  await s.page.locator(P('blend-mode')).selectOption('screen');
  await expect(s.page.locator(HOST)).toHaveCSS('mix-blend-mode', 'screen');
  await expect.poll(async () => (await s.state())?.blend).toBe('screen');
});

test('the Difference button and the mode list agree', async () => {
  await open();
  await s.page.locator(P('blend-mode')).selectOption('screen');
  await expect(s.page.locator(P('blend'))).toHaveAttribute('aria-pressed', 'false');
  await s.page.locator(P('blend')).click();
  await expect.poll(async () => (await s.state())?.blend).toBe('difference');
  await expect(s.page.locator(P('blend-mode'))).toHaveValue('difference');
  await expect(s.page.locator(P('blend'))).toHaveAttribute('aria-pressed', 'true');
  await s.page.locator(P('blend')).click();
  await expect.poll(async () => (await s.state())?.blend).toBe('normal');
  await expect(s.page.locator(P('blend-mode'))).toHaveValue('normal');
});

test('Invert flips the colours of the layer on screen, and off again', async () => {
  await open(1);
  // The red block of the fixture, under an identical design at full opacity, normal blend.
  const before = await pixel(s.page, 60, 60);
  expect(before[0]).toBeGreaterThan(200);
  await s.page.locator(P('invert')).click();
  await expect(s.page.locator(P('invert'))).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await s.state())?.invert).toBe(true);
  await expect
    .poll(async () => {
      const p = await pixel(s.page, 60, 60);
      return p.every((v, i) => near(v, 255 - before[i]!));
    })
    .toBe(true);
  await s.page.locator(P('invert')).click();
  await expect.poll(async () => (await s.state())?.invert).toBe(false);
  await expect
    .poll(async () => {
      const p = await pixel(s.page, 60, 60);
      return p.every((v, i) => near(v, before[i]!));
    })
    .toBe(true);
});

test('Invert is applied to the image, not to the page or the panel', async () => {
  await open(1);
  await s.page.locator(P('invert')).click();
  await expect(s.page.locator(IMG)).toHaveCSS('filter', 'invert(1)');
  await expect(s.page.locator(HOST)).not.toHaveCSS('filter', 'invert(1)');
  await expect(s.page.locator('pixel-overlay-panel')).not.toHaveCSS('filter', 'invert(1)');
});

test('a saved Screen + Invert comes back when the icon is clicked again', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed({ ...oneLayerState({ opacity: 1 }, 'screen'), invert: true }, { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect(s.page.locator(HOST)).toHaveCSS('mix-blend-mode', 'screen');
  await expect(s.page.locator(IMG)).toHaveCSS('filter', 'invert(1)');
  await expect(s.page.locator(P('blend-mode'))).toHaveValue('screen');
  await expect(s.page.locator(P('invert'))).toHaveAttribute('aria-pressed', 'true');
});

test('with no layers, the mode list and Invert are disabled like Hide all', async () => {
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  await expect(s.page.locator(P('blend-mode'))).toBeDisabled();
  await expect(s.page.locator(P('invert'))).toBeDisabled();
});
