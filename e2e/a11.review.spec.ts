// Claude's review tests for ticket A11 (pin a layer to the window). agy: never edit this file.
import { expect, test } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const IMG = 'img[data-layer-id="L1"]';
const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;
const y = async () => Math.round((await s.page.locator(IMG).boundingBox())?.y ?? NaN);

async function open(over: Parameters<typeof oneLayerState>[0] = {}, blend: 'normal' | 'difference' = 'normal') {
  const png = await screenshotDataUrl(s.page, 400, 300);
  await s.seed(oneLayerState({ naturalWidth: 400, naturalHeight: 300, opacity: 0.5, y: 100, ...over }, blend), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
}

test('a pinned layer stays put when the window scrolls', async () => {
  await open({ fixed: true } as never);
  await s.page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(y).toBe(100);
});

test('positive control: a layer that is not pinned scrolls away', async () => {
  await open();
  await s.page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(y).toBe(-400);
});

test('the panel button pins and unpins the active layer, and it is saved', async () => {
  await open();
  await expect(s.page.locator(P('fixed'))).toHaveAttribute('aria-pressed', 'false');
  await s.page.locator(P('fixed')).click();
  await expect(s.page.locator(P('fixed'))).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await s.state())?.layers[0] && (await s.state())!.layers[0]!['fixed' as never]).toBe(true);
  await s.page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(y).toBe(100);
  // B3 (F4b): unpinning while scrolled keeps the layer where it is on screen.
  await s.page.locator(P('fixed')).click();
  await expect.poll(y).toBe(100);
  await expect.poll(async () => (await s.state())?.layers[0]?.y).toBe(600);
});

test('a pinned layer stays put when <body> is the scroller', async () => {
  await open({ fixed: true } as never);
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
  await s.page.waitForTimeout(300);
  await expect.poll(y).toBe(100);
});

test('a pinned layer blends too: Difference over the same pixels is black', async () => {
  const png = await screenshotDataUrl(s.page, 400, 300);
  await s.seed(oneLayerState({ naturalWidth: 400, naturalHeight: 300, opacity: 1, fixed: true } as never, 'difference'), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await s.page.locator(IMG).evaluate((el) => (el as HTMLImageElement).decode());
  const buf = await s.page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 300 } });
  const max = await s.page.context().newPage().then(async (probe) => {
    const m = await probe.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let mx = 0;
      for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, d[i]!, d[i + 1]!, d[i + 2]!);
      return mx;
    }, `data:image/png;base64,${buf.toString('base64')}`);
    await probe.close();
    return m;
  });
  expect(max).toBeLessThanOrEqual(8);
});

test('dragging a pinned layer moves it in window pixels', async () => {
  await open({ fixed: true, x: 40 } as never);
  await s.page.evaluate(() => window.scrollTo(0, 300));
  await s.page.mouse.move(140, 200);
  await s.page.mouse.down();
  await s.page.mouse.move(160, 220, { steps: 4 });
  await s.page.mouse.move(180, 240, { steps: 4 });
  await s.page.mouse.up();
  await expect.poll(async () => (await s.state())?.layers[0]?.x).toBe(80);
  expect((await s.state())?.layers[0]?.y).toBe(140);
});
