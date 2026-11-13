// Claude's review tests for ticket B4 (fresh review of 0.2.1: the B3 fixes and A5). agy: never edit this file.
import { expect, test } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;
const IMG = 'img[data-layer-id="L1"]';
const HOSTS = ['pixel-overlay-layers', 'pixel-overlay-fixed', 'pixel-overlay-panel'];

async function open(over: Parameters<typeof oneLayerState>[0] = {}, w = 200, h = 100) {
  const png = await screenshotDataUrl(s.page, w, h);
  await s.seed(oneLayerState({ naturalWidth: w, naturalHeight: h, opacity: 0.5, ...over }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
}

async function addPageCss(css: string) {
  await s.page.evaluate((text) => {
    const st = document.createElement('style');
    st.textContent = text;
    document.head.append(st);
  }, css);
}

test('F1: page ::backdrop rules do not paint over the page through our hosts', async () => {
  await addPageCss('::backdrop { background: rgb(255, 0, 0) !important; backdrop-filter: blur(2px) !important; }');
  await open();
  for (const tag of HOSTS) {
    const bd = await s.page.evaluate((t) => {
      const el = document.querySelector(t);
      if (!el) return null;
      const cs = getComputedStyle(el, '::backdrop');
      return { display: cs.display, bg: cs.backgroundColor, bf: cs.backdropFilter };
    }, tag);
    expect(bd, tag).not.toBeNull();
    const harmless = bd!.display === 'none' || (bd!.bg === 'rgba(0, 0, 0, 0)' && (bd!.bf === 'none' || bd!.bf === ''));
    expect(harmless, `${tag} ::backdrop ${JSON.stringify(bd)}`).toBe(true);
  }
});

test('F2: page [popover] rules cannot resize, fade, move or hide our hosts', async () => {
  await open();
  const before = await s.page.locator('pixel-overlay-panel').boundingBox();
  const imgBefore = await s.page.locator(IMG).boundingBox();
  await addPageCss(`
    [popover], :popover-open {
      height: 100vh !important; min-height: 100vh; block-size: 600px; min-width: 900px !important;
      opacity: 0.3 !important; filter: grayscale(1); transform: translateX(100px) !important;
      translate: 10px 10px; scale: 0.5; rotate: 10deg; visibility: hidden;
    }`);
  await s.page.waitForTimeout(200);
  expect(await s.page.locator('pixel-overlay-panel').boundingBox()).toEqual(before);
  expect(await s.page.locator(IMG).boundingBox()).toEqual(imgBefore);
  for (const tag of HOSTS) {
    const cs = await s.page.evaluate((t) => {
      const c = getComputedStyle(document.querySelector(t)!);
      return { opacity: c.opacity, filter: c.filter, transform: c.transform, translate: c.translate, scale: c.scale, rotate: c.rotate, visibility: c.visibility };
    }, tag);
    expect(cs, tag).toEqual({ opacity: '1', filter: 'none', transform: 'none', translate: 'none', scale: 'none', rotate: 'none', visibility: 'visible' });
  }
});

test('F3: when the page removes the layers host, the panel stays on top of the layers after it comes back', async () => {
  // A big active, unlocked layer under the top right corner, where the panel is.
  await open({ x: 300, y: 0 }, 700, 400);
  const blend = await s.page.locator(P('blend')).boundingBox();
  const img = await s.page.locator(IMG).boundingBox();
  expect(blend!.x >= img!.x && blend!.y + blend!.height <= img!.y + img!.height).toBe(true);
  await s.page.evaluate(() => document.querySelector('pixel-overlay-layers')?.remove());
  // Any change makes the overlay attach its hosts again.
  await s.page.locator(P('opacity')).fill('40');
  await s.page.locator(P('opacity')).press('Enter');
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCount(1);
  await expect.poll(async () => (await s.state())?.layers[0]?.opacity).toBe(0.4);
  // A plain mouse click where the button is: it must reach the panel, not the layer above it.
  await s.page.mouse.click(blend!.x + blend!.width / 2, blend!.y + blend!.height / 2);
  await expect.poll(async () => (await s.state())?.blend).toBe('difference');
  expect((await s.state())?.layers[0]?.x).toBe(300);
});

test('F4: pinning on a page whose body scrolls keeps the layer where it is on screen', async () => {
  await s.page.evaluate(() => {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'auto';
    const tall = document.createElement('div');
    tall.style.height = '4000px';
    document.body.append(tall);
  });
  await open({ y: 1500 });
  await s.page.waitForTimeout(300);
  await s.page.evaluate(() => document.body.scrollTo(0, 1000));
  const top = async () => Math.round((await s.page.locator(IMG).boundingBox())?.y ?? NaN);
  await expect.poll(top).toBe(500);
  await s.page.locator(P('fixed')).click();
  await expect.poll(async () => (await s.state())?.layers[0]?.fixed).toBe(true);
  await expect.poll(top).toBe(500);
  expect((await s.state())?.layers[0]?.y).toBe(500);
  await s.page.evaluate(() => document.body.scrollTo(0, 600));
  await s.page.locator(P('fixed')).click();
  await expect.poll(async () => (await s.state())?.layers[0]?.fixed).toBe(false);
  await expect.poll(top).toBe(500);
  expect((await s.state())?.layers[0]?.y).toBe(1100);
});
