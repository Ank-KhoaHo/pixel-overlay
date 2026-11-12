// Claude's review tests for ticket A5 (a transform on <html>). agy: never edit this file.
// A transform on <html> makes <html> the containing block for position: fixed, so anything
// "fixed" inside it scrolls with the page. scale(1) moves nothing on screen, so every expected
// position below is the same as on a page with no transform.
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
const top = async (sel: string) => Math.round((await s.page.locator(sel).boundingBox())?.y ?? NaN);

async function open(over: Parameters<typeof oneLayerState>[0] = {}, transform = 'scale(1)') {
  const png = await screenshotDataUrl(s.page, 400, 300);
  await s.page.evaluate((t) => {
    document.documentElement.style.transform = t;
    document.body.style.minHeight = '3000px';
  }, transform);
  await s.seed(oneLayerState({ naturalWidth: 400, naturalHeight: 300, opacity: 0.5, y: 100, ...over }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect(s.page.locator(P('title'))).toBeVisible();
}

test('with a transform on <html>, the panel stays put when the page scrolls', async () => {
  await open();
  const before = await top(P('title'));
  await s.page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => top(P('title'))).toBe(before);
});

test('with a transform on <html>, a layer still scrolls with the page', async () => {
  await open();
  await s.page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => top(IMG)).toBe(-300);
});

test('with a transform on <html>, a pinned layer stays put when the page scrolls', async () => {
  await open({ fixed: true });
  await s.page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => top(IMG)).toBe(100);
});

test('a page that adds its transform after Pixel Veil opened is handled too', async () => {
  await open({}, 'none');
  await s.page.evaluate(() => {
    document.documentElement.style.transform = 'scale(1)';
  });
  const before = await top(P('title'));
  await s.page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => top(P('title'))).toBe(before);
});

test('in the top layer, no host is stretched or painted by the browser popover styles', async () => {
  await open();
  const boxes = await s.page.evaluate(() =>
    ['pixel-overlay-layers', 'pixel-overlay-fixed', 'pixel-overlay-panel'].map((tag) => {
      const el = document.querySelector(tag) as HTMLElement;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { tag, h: Math.round(r.height), w: Math.round(r.width), bg: cs.backgroundColor, border: cs.borderTopWidth };
    }),
  );
  const vh = await s.page.evaluate(() => window.innerHeight);
  for (const b of boxes) {
    expect(b.bg, b.tag).toBe('rgba(0, 0, 0, 0)');
    expect(b.border, b.tag).toBe('0px');
  }
  expect(boxes[0]!.h).toBe(0);
  expect(boxes[1]!.h).toBe(0);
  expect(boxes[2]!.w).toBe(300);
  expect(boxes[2]!.h).toBeLessThan(vh - 40);
});

test('a page style aimed at popovers cannot paint, pad or stretch the hosts', async () => {
  await s.page.addStyleTag({
    content: '[popover] { background: red; border: 5px solid red; padding: 20px; margin: 30px; inset: 0; max-height: 10px; overflow: hidden; }',
  });
  await open();
  const boxes = await s.page.evaluate(() =>
    ['pixel-overlay-layers', 'pixel-overlay-fixed', 'pixel-overlay-panel'].map((tag) => {
      const el = document.querySelector(tag) as HTMLElement;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { tag, bg: cs.backgroundColor, border: cs.borderTopWidth, pad: cs.paddingTop, margin: cs.marginTop, maxH: cs.maxHeight, overflow: cs.overflowY, h: Math.round(r.height), top: Math.round(r.top) };
    }),
  );
  for (const b of boxes) {
    expect(b, b.tag).toMatchObject({ bg: 'rgba(0, 0, 0, 0)', border: '0px', pad: '0px', margin: '0px', maxH: 'none', overflow: 'visible' });
  }
  const vh = await s.page.evaluate(() => window.innerHeight);
  expect(boxes[0]!.h).toBe(0);
  expect(boxes[2]!.h).toBeGreaterThan(100);
  expect(boxes[2]!.h).toBeLessThan(vh - 40);
  expect(boxes[2]!.top).toBe(16);
  await expect(s.page.locator('pixel-overlay-panel [data-po="title"]')).toBeVisible();
});
