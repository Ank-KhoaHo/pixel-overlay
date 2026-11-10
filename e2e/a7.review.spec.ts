// Claude's review tests for ticket A7 (keyboard shortcuts). agy: never edit this file.
// Playwright cannot press a real extension shortcut, so the e2e build exposes
// self.poCommand(name, tabId), which runs the same code as chrome.commands.onCommand.
import { expect, test } from '@playwright/test';
import { launchSession, oneLayerState, screenshotDataUrl, type Session } from './session';

declare const chrome: {
  tabs: { query(q: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>> };
};

let s: Session;
test.beforeEach(async () => {
  s = await launchSession();
});
test.afterEach(async () => {
  await s.close();
});

const IMG = 'pixel-overlay-layers img[data-layer-id="L1"]';
const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;

async function open(opacity = 0.5) {
  const png = await screenshotDataUrl(s.page, 800, 600);
  await s.seed(oneLayerState({ opacity }), { I1: png });
  await s.clickIcon();
  await expect(s.page.locator(IMG)).toBeVisible();
}

async function command(name: string) {
  const url = s.page.url();
  await s.worker.evaluate(
    async ([u, n]) => {
      const id = (await chrome.tabs.query({})).find((t) => t.url === u)?.id;
      await (self as unknown as { poCommand(n: string, id?: number): Promise<void> }).poCommand(n, id);
    },
    [url, name] as const,
  );
}

test('opacity-up and opacity-down change the active layer by 10 % and the panel follows', async () => {
  await open(0.5);
  await command('opacity-up');
  await expect.poll(async () => (await s.state())?.layers[0]?.opacity).toBe(0.6);
  await expect(s.page.locator(IMG)).toHaveCSS('opacity', '0.6');
  await expect(s.page.locator(P('opacity'))).toHaveValue('60');
  await command('opacity-down');
  await command('opacity-down');
  await expect.poll(async () => (await s.state())?.layers[0]?.opacity).toBe(0.4);
});

test('toggle-hide-all hides every layer, then shows them again', async () => {
  await open();
  await command('toggle-hide-all');
  await expect(s.page.locator(IMG)).toHaveCount(0);
  await expect(s.page.locator(P('hide-all'))).toHaveAttribute('aria-pressed', 'true');
  await command('toggle-hide-all');
  await expect(s.page.locator(IMG)).toBeVisible();
});

test('toggle-difference switches the blend', async () => {
  await open();
  await command('toggle-difference');
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCSS('mix-blend-mode', 'difference');
  await command('toggle-difference');
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCSS('mix-blend-mode', 'normal');
});

test('a command on a tab where Pixel Veil never ran does nothing and injects nothing', async () => {
  await command('opacity-up');
  await command('toggle-hide-all');
  await s.page.waitForTimeout(500);
  await expect(s.page.locator('pixel-overlay-panel')).toHaveCount(0);
  await expect(s.page.locator('pixel-overlay-layers')).toHaveCount(0);
});
