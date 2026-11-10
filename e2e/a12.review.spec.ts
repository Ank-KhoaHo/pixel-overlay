// Claude's review tests for ticket A12 (export and import a site's layers). agy: never edit this file.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;
const IMGS = 'pixel-overlay-layers img';

async function open() {
  const png = await screenshotDataUrl(s.page, 200, 100);
  await s.seed(oneLayerState({ naturalWidth: 200, naturalHeight: 100, name: 'home-desktop' }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMGS)).toHaveCount(1);
}

test('Export downloads one file with the layers and their images', async () => {
  await open();
  const dl = s.page.waitForEvent('download');
  await s.page.locator(P('export')).click();
  const d = await dl;
  expect(d.suggestedFilename()).toMatch(/^pixel-veil-localhost-\d+-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(fs.readFileSync((await d.path())!, 'utf-8'));
  expect(data.format).toBe('pixel-veil-site');
  expect(data.layers.map((l: { name: string }) => l.name)).toEqual(['home-desktop']);
  expect(data.images[data.layers[0].imageId]).toMatch(/^data:image\/png;base64,/);
});

test('Import of an exported file adds its layers back, with their images', async () => {
  await open();
  const dl = s.page.waitForEvent('download');
  await s.page.locator(P('export')).click();
  const file = (await (await dl).path())!;
  // Remove the only layer (delete asks once: two clicks).
  await s.page.locator(P('delete')).first().click();
  await s.page.locator(P('delete')).first().click();
  await expect(s.page.locator(IMGS)).toHaveCount(0);
  const chooser = s.page.waitForEvent('filechooser');
  await s.page.locator(P('import')).click();
  await (await chooser).setFiles({ name: 'site.json', mimeType: 'application/json', buffer: fs.readFileSync(file) });
  await expect(s.page.locator(IMGS)).toHaveCount(1);
  await expect(s.page.locator('pixel-overlay-panel')).toContainText('home-desktop');
  const st = await s.state();
  expect(st?.layers).toHaveLength(1);
  expect(st?.activeLayerId).toBe(st?.layers[0]?.id);
});

test('Import adds to the layers already there; it never replaces them', async () => {
  await open();
  const dl = s.page.waitForEvent('download');
  await s.page.locator(P('export')).click();
  const file = (await (await dl).path())!;
  const chooser = s.page.waitForEvent('filechooser');
  await s.page.locator(P('import')).click();
  await (await chooser).setFiles({ name: 'site.json', mimeType: 'application/json', buffer: fs.readFileSync(file) });
  await expect(s.page.locator(IMGS)).toHaveCount(2);
  expect((await s.state())?.layers).toHaveLength(2);
});

test('a broken file shows one error line and changes nothing', async () => {
  await open();
  const chooser = s.page.waitForEvent('filechooser');
  await s.page.locator(P('import')).click();
  await (await chooser).setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"nope"}') });
  await expect(s.page.locator(P('error'))).toBeVisible();
  expect((await s.state())?.layers).toHaveLength(1);
});

test('with no layers, Export is disabled and Import still works', async () => {
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  await expect(s.page.locator(P('export'))).toBeDisabled();
  await expect(s.page.locator(P('import'))).toBeEnabled();
});
