// Claude's review tests for plan Task 6. agy: never edit this file.
// The e2e build holds http://localhost/*, so chrome.permissions.request for the fixture
// origin resolves without Chrome's prompt, and the whole grant flow runs for real.
import { expect, test } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

declare const chrome: {
  storage: { local: { get(k: string): Promise<Record<string, unknown>> } };
  scripting: { getRegisteredContentScripts(): Promise<Array<{ id: string; matches?: string[] }>> };
};

let s: Session;

test.beforeEach(async () => {
  s = await launchSession();
});

test.afterEach(async () => {
  await s.close();
});

const IMG = 'pixel-overlay-layers img[data-layer-id="L1"]';
const KEEP = 'pixel-overlay-panel [data-po="keep"]';

async function seedAndOpen() {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity: 0.5 }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
}

async function turnKeepOn() {
  const grantPage = s.context.waitForEvent('page');
  await s.page.locator(KEEP).check();
  const g = await grantPage;
  await g.waitForLoadState();
  expect(g.url()).toContain(`chrome-extension://${s.extensionId}/grant.html`);
  await expect(g.locator('body')).toContainText(s.fixture.origin);
  await g.locator('[data-po="grant"]').click();
  await g.waitForEvent('close');
}

test('before keep: a reload hides the layers until the icon is clicked', async () => {
  await seedAndOpen();
  await s.page.reload();
  await s.page.waitForTimeout(1000);
  await expect(s.page.locator(IMG)).toHaveCount(0);
});

test('keep on: grant window, registration, and layers return after reload', async () => {
  await seedAndOpen();
  await turnKeepOn();
  await expect.poll(async () => (await s.worker.evaluate(() => chrome.storage.local.get('po.kept')))['po.kept'])
    .toEqual([s.fixture.origin]);
  const regs = await s.worker.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  expect(regs.find((r) => r.id === 'po-kept')?.matches).toEqual([`${s.fixture.origin}/*`]);
  await s.page.reload();
  await expect(s.page.locator(IMG)).toBeVisible();
  await expect(s.page.locator(KEEP)).toBeChecked();
});

test('keep on, then panel closed: a reload keeps it closed', async () => {
  await seedAndOpen();
  await turnKeepOn();
  await s.page.locator('pixel-overlay-panel [data-po="close"]').click();
  await expect.poll(async () => (await s.state())?.shown).toBe(false);
  await s.page.reload();
  await s.page.waitForTimeout(1000);
  await expect(s.page.locator(IMG)).toHaveCount(0);
});

test('keep off: unregistered, and a reload no longer restores', async () => {
  await seedAndOpen();
  await turnKeepOn();
  await s.page.reload();
  await expect(s.page.locator(IMG)).toBeVisible();
  await s.page.locator(KEEP).uncheck();
  await expect.poll(async () => (await s.worker.evaluate(() => chrome.storage.local.get('po.kept')))['po.kept'])
    .toEqual([]);
  const regs = await s.worker.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  expect(regs.find((r) => r.id === 'po-kept')).toBeUndefined();
  await s.page.reload();
  await s.page.waitForTimeout(1000);
  await expect(s.page.locator(IMG)).toHaveCount(0);
});

test('a kept site does not get a second copy when the icon is clicked', async () => {
  await seedAndOpen();
  await turnKeepOn();
  await s.page.reload();
  await expect(s.page.locator(IMG)).toBeVisible();
  await s.clickIcon(); // running already: toggles off
  await expect(s.page.locator(IMG)).toHaveCount(0);
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCount(1);
  await expect(s.page.locator('pixel-overlay-panel')).toHaveCount(0);
});
