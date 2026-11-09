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

test('double-clicking a layer name allows renaming on Enter and on blur', async () => {
  await openEmpty();
  await addFile('hero.png', await pngBytes(s.page, 32, 32, '#aa0000'));
  await expect(s.page.locator(ROWS)).toHaveCount(1);
  const row = s.page.locator(ROWS).first();
  await expect(row).toContainText('hero');

  // Rename with Enter
  await row.locator('.layer-name').dblclick();
  const input = row.locator('.layer-rename-input');
  await expect(input).toBeVisible();
  await input.fill('hero-renamed');
  await input.press('Enter');
  await expect(row.locator('.layer-name')).toHaveText('hero-renamed');
  await expect.poll(async () => (await s.state())?.layers[0]?.name).toBe('hero-renamed');

  // Rename with blur
  await row.locator('.layer-name').dblclick();
  await expect(row.locator('.layer-rename-input')).toBeVisible();
  await row.locator('.layer-rename-input').fill('hero-final');
  await s.page.locator(P('title')).click();
  await expect(row.locator('.layer-name')).toHaveText('hero-final');
  await expect.poll(async () => (await s.state())?.layers[0]?.name).toBe('hero-final');
});

test('pasting an image file adds a layer to the top of the stack', async () => {
  await openEmpty();
  const b64 = (await pngBytes(s.page, 20, 20, '#00aaaa')).toString('base64');
  const panelRoot = s.page.locator('pixel-overlay-panel .pixel-overlay-panel-root');
  await panelRoot.focus();

  await panelRoot.evaluate((el, file) => {
    const dt = new DataTransfer();
    const bin = Uint8Array.from(atob(file.b64), (ch) => ch.charCodeAt(0));
    dt.items.add(new File([bin], file.name, { type: 'image/png' }));
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, composed: true, cancelable: true });
    Object.defineProperty(ev, 'clipboardData', { value: dt });
    el.dispatchEvent(ev);
  }, { name: 'pasted.png', b64 });

  await expect(s.page.locator(ROWS)).toHaveCount(1);
  await expect(s.page.locator(ROWS).first()).toContainText('pasted');
  const st = await s.state();
  expect(st?.layers).toHaveLength(1);
  expect(st?.layers[0]?.name).toBe('pasted');
  expect(st?.activeLayerId).toBe(st?.layers[0]?.id);
});

test('dragging panel by header saves position in state', async () => {
  await openEmpty();
  const titleBox = await s.page.locator(P('title')).boundingBox();
  expect(titleBox).not.toBeNull();

  const startX = titleBox!.x + 20;
  const startY = titleBox!.y + 10;
  await s.page.mouse.move(startX, startY);
  await s.page.mouse.down();
  await s.page.mouse.move(startX - 50, startY + 50, { steps: 5 });
  await s.page.mouse.up();

  await expect.poll(async () => {
    const st = await s.state();
    return st?.panel.x;
  }).not.toBe(-1);

  const panelSt = (await s.state())?.panel;
  expect(panelSt?.y).toBeGreaterThan(16);
});

test('opacity slider and number input stay in sync', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();

  await expect(s.page.locator(P('opacity'))).toHaveValue('50');
  await expect(s.page.locator(P('opacity-slider'))).toHaveValue('50');

  // Fill number input
  await s.page.locator(P('opacity')).fill('90');
  await s.page.locator(P('opacity')).press('Enter');
  await expect(s.page.locator(P('opacity-slider'))).toHaveValue('90');
  await expect.poll(async () => (await s.state())?.layers[0]?.opacity).toBe(0.9);
});
