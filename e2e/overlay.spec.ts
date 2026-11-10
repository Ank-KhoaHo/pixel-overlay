import { expect, test } from '@playwright/test';
import { launchSession, screenshotDataUrl, type Session } from './session';
import type { SiteState } from '../src/core/types';

let s: Session;

test.beforeEach(async () => {
  s = await launchSession();
});

test.afterEach(async () => {
  await s.close();
});

test('two layers are drawn in array order with the top layer last in the DOM', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  const state: SiteState = {
    schemaVersion: 1,
    layers: [
      {
        id: 'L1',
        name: 'bottom',
        imageId: 'I1',
        naturalWidth: 800,
        naturalHeight: 600,
        x: 0,
        y: 0,
        opacity: 0.5,
        scale: 1,
        visible: true,
        locked: false,
      },
      {
        id: 'L2',
        name: 'top',
        imageId: 'I2',
        naturalWidth: 800,
        naturalHeight: 600,
        x: 10,
        y: 10,
        opacity: 0.8,
        scale: 1,
        visible: true,
        locked: false,
      },
    ],
    activeLayerId: 'L2',
    blend: 'normal',
    invert: false,
    shown: true,
    allHidden: false,
    panel: { x: -1, y: 16, collapsed: false },
  };

  await s.seed(state, { I1: png, I2: png });
  await s.clickIcon();

  const layersHost = s.page.locator('pixel-overlay-layers');
  await expect(layersHost.locator('img')).toHaveCount(2);

  const layerIds = await layersHost
    .locator('img')
    .evaluateAll((imgs) => imgs.map((el) => el.getAttribute('data-layer-id')));
  expect(layerIds).toEqual(['L1', 'L2']);

  await expect(layersHost.locator('img[data-layer-id="L2"]')).toHaveCSS('pointer-events', 'auto');
  await expect(layersHost.locator('img[data-layer-id="L1"]')).toHaveCSS('pointer-events', 'none');
});

test('hiding one layer leaves only the visible layer in the DOM', async () => {
  const png = await screenshotDataUrl(s.page, 800, 600);
  const state: SiteState = {
    schemaVersion: 1,
    layers: [
      {
        id: 'L1',
        name: 'bottom',
        imageId: 'I1',
        naturalWidth: 800,
        naturalHeight: 600,
        x: 0,
        y: 0,
        opacity: 0.5,
        scale: 1,
        visible: true,
        locked: false,
      },
      {
        id: 'L2',
        name: 'top',
        imageId: 'I2',
        naturalWidth: 800,
        naturalHeight: 600,
        x: 10,
        y: 10,
        opacity: 0.8,
        scale: 1,
        visible: false,
        locked: false,
      },
    ],
    activeLayerId: 'L1',
    blend: 'normal',
    invert: false,
    shown: true,
    allHidden: false,
    panel: { x: -1, y: 16, collapsed: false },
  };

  await s.seed(state, { I1: png, I2: png });
  await s.clickIcon();

  const layersHost = s.page.locator('pixel-overlay-layers');
  await expect(layersHost.locator('img')).toHaveCount(1);
  await expect(layersHost.locator('img[data-layer-id="L1"]')).toBeVisible();
  await expect(layersHost.locator('img[data-layer-id="L2"]')).toHaveCount(0);
});
