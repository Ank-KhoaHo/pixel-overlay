// Claude's review tests for ticket A2 (groups of layers, with a filter). agy: never edit this file.
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
const IMGS = 'pixel-overlay-layers img';

async function openTwo(groups: [string, string]) {
  const png = await screenshotDataUrl(s.page, 120, 60);
  const base = oneLayerState({ naturalWidth: 120, naturalHeight: 60 });
  const l1 = { ...base.layers[0]!, id: 'L1', name: 'login-design', imageId: 'I1', group: groups[0] };
  const l2 = { ...base.layers[0]!, id: 'L2', name: 'home-design', imageId: 'I2', group: groups[1] };
  await s.seed({ ...base, layers: [l1, l2], activeLayerId: 'L2', filter: '' }, { I1: png, I2: png });
  await s.clickIcon();
  await expect(s.page.locator(IMGS)).toHaveCount(2);
}

test('with no groups there is no filter; typing a group makes one appear', async () => {
  await openTwo(['', '']);
  await expect(s.page.locator(P('group-filter'))).toHaveCount(0);
  await s.page.locator(P('group')).fill('home');
  await s.page.locator(P('group')).press('Enter');
  await expect(s.page.locator(P('group-filter'))).toBeVisible();
  await expect.poll(async () => (await s.state())?.layers.find((l) => l.id === 'L2')?.group).toBe('home');
});

test('choosing a group shows only its layers, in the list and on the page, and survives a reload', async () => {
  await openTwo(['login', 'home']);
  await s.page.locator(P('group-filter')).selectOption('login');
  await expect(s.page.locator(P('layer-row'))).toHaveCount(1);
  await expect(s.page.locator('pixel-overlay-panel')).toContainText('login-design');
  await expect(s.page.locator(`${IMGS}:visible`)).toHaveCount(1);
  await expect.poll(async () => (await s.state())?.filter).toBe('login');
  await expect.poll(async () => (await s.state())?.activeLayerId).toBe('L1');

  await s.page.reload();
  await s.clickIcon();
  await expect(s.page.locator(P('layer-row'))).toHaveCount(1);
  await expect(s.page.locator(`${IMGS}:visible`)).toHaveCount(1);
});

test('"All layers" shows everything again', async () => {
  await openTwo(['login', 'home']);
  await s.page.locator(P('group-filter')).selectOption('login');
  await expect(s.page.locator(P('layer-row'))).toHaveCount(1);
  await s.page.locator(P('group-filter')).selectOption('');
  await expect(s.page.locator(P('layer-row'))).toHaveCount(2);
  await expect(s.page.locator(`${IMGS}:visible`)).toHaveCount(2);
});

test('a filter whose group no longer exists can still be cleared', async () => {
  const png = await screenshotDataUrl(s.page, 120, 60);
  const base = oneLayerState({ naturalWidth: 120, naturalHeight: 60 });
  const l1 = { ...base.layers[0]!, id: 'L1', name: 'a', imageId: 'I1', group: '' };
  await s.seed({ ...base, layers: [l1], activeLayerId: null, filter: 'gone' }, { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(P('group-filter'))).toBeVisible();
  await expect(s.page.locator(P('layer-row'))).toHaveCount(0);
  await s.page.locator(P('group-filter')).selectOption('');
  await expect(s.page.locator(P('layer-row'))).toHaveCount(1);
  await expect(s.page.locator(IMGS)).toHaveCount(1);
});

test('a typed group is also kept when you click away instead of pressing Enter', async () => {
  await openTwo(['', '']);
  await s.page.locator(P('group')).fill('login');
  await s.page.locator(P('title')).click();
  await expect.poll(async () => (await s.state())?.layers.find((l) => l.id === 'L2')?.group).toBe('login');
});
