// Claude's e2e harness (plan Task 4). agy may add helpers in other files; keep these signatures.
import type { BrowserContext, Page, Worker } from '@playwright/test';
import type { SiteState } from '../src/core/types';
import { launchExtension } from './helpers';
import { startFixtureServer, type FixtureServer } from './fixture/server';

declare const chrome: {
  storage: { local: { set(i: Record<string, unknown>): Promise<void>; get(k: string): Promise<Record<string, unknown>> } };
  tabs: { query(q: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>> };
};

export interface Session {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  fixture: FixtureServer;
  page: Page;
  siteKey: string;
  /** Write a site state and its images straight into chrome.storage.local. */
  seed(state: SiteState, images: Record<string, string>): Promise<void>;
  /** Read this site's stored state. */
  state(): Promise<SiteState | undefined>;
  /** Same as clicking the toolbar icon on `page` (e2e build exposes self.poClick). */
  clickIcon(p?: Page): Promise<void>;
  close(): Promise<void>;
}

export async function launchSession(): Promise<Session> {
  const fixture = await startFixtureServer();
  const { context, worker, extensionId } = await launchExtension();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(fixture.url);
  const siteKey = `po.site.${fixture.origin}`;

  return {
    context,
    worker,
    extensionId,
    fixture,
    page,
    siteKey,
    async seed(state, images) {
      const items: Record<string, unknown> = { [siteKey]: state };
      for (const [id, url] of Object.entries(images)) items[`po.img.${id}`] = url;
      await worker.evaluate((i) => chrome.storage.local.set(i), items);
    },
    async state() {
      const got = await worker.evaluate((k) => chrome.storage.local.get(k), siteKey);
      return got[siteKey] as SiteState | undefined;
    },
    async clickIcon(p = page) {
      const url = p.url();
      await worker.evaluate(async (u) => {
        const tabs = await chrome.tabs.query({});
        const id = tabs.find((t) => t.url === u)?.id;
        if (id === undefined) throw new Error(`no tab for ${u}`);
        await (self as unknown as { poClick(tabId: number): Promise<void> }).poClick(id);
      }, url);
    },
    async close() {
      await context.close();
      await fixture.close();
    },
  };
}

/** A PNG screenshot of the page's top-left w x h, as a data: URL, taken before any overlay. */
export async function screenshotDataUrl(page: Page, w: number, h: number): Promise<string> {
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/**
 * Largest colour channel over a screenshot region, measured by drawing the PNG on a canvas
 * in a blank page. 0 = pure black. Used for the difference-view check.
 */
export async function maxChannel(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const buf = await page.screenshot({ clip });
  const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  const probe = await page.context().newPage();
  try {
    return await probe.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let max = 0;
      for (let i = 0; i < d.length; i += 4) {
        max = Math.max(max, d[i]!, d[i + 1]!, d[i + 2]!);
      }
      return max;
    }, dataUrl);
  } finally {
    await probe.close();
  }
}

/** One layer covering the fixture's top-left 800x600, from `imageId`. */
export function oneLayerState(over: Partial<SiteState['layers'][number]> = {}, blend: SiteState['blend'] = 'normal'): SiteState {
  return {
    schemaVersion: 1,
    layers: [
      {
        id: 'L1',
        name: 'design',
        imageId: 'I1',
        naturalWidth: 800,
        naturalHeight: 600,
        x: 0,
        y: 0,
        opacity: 1,
        scale: 1,
        visible: true,
        locked: false,
        ...over,
      },
    ],
    activeLayerId: 'L1',
    blend,
    shown: true,
    allHidden: false,
    panel: { x: -1, y: 16, collapsed: false },
  };
}
