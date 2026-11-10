// Claude's review tests for ticket A9 (local files). agy: never edit this file.
// The e2e build is granted file:///* (the icon's activeTab grant cannot be clicked from Playwright),
// and Chromium started with --load-extension allows file access, so the "on" path runs for real.
// The "off" path is decided by needsFileAccessHelp (unit tests) and shown by local-files.html.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchSession, screenshotDataUrl, type Session } from './session';

declare const chrome: {
  storage: { local: { get(k: null): Promise<Record<string, unknown>> } };
  tabs: { query(q: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>> };
};

let s: Session;
let dir: string;
test.beforeEach(async () => {
  s = await launchSession();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-local-'));
  for (const sub of ['site', 'other']) {
    fs.mkdirSync(path.join(dir, sub));
    for (const f of ['a.html', 'b.html']) {
      fs.writeFileSync(
        path.join(dir, sub, f),
        `<!doctype html><title>${sub}/${f}</title><body style="margin:0;height:2000px;background:#fff"><h1>${sub} ${f}</h1></body>`,
      );
    }
  }
});
test.afterEach(async () => {
  await s.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const P = (name: string) => `pixel-overlay-panel [data-po="${name}"]`;
const fileUrl = (sub: string, f: string) => pathToFileURL(path.join(dir, sub, f)).href;

async function keys(): Promise<string[]> {
  return Object.keys(await s.worker.evaluate(() => chrome.storage.local.get(null)));
}

async function addDesign() {
  const png = Buffer.from((await screenshotDataUrl(s.page, 64, 32)).split(',')[1]!, 'base64');
  const chooser = s.page.waitForEvent('filechooser');
  await s.page.locator(P('add')).click();
  await (await chooser).setFiles({ name: 'home.png', mimeType: 'image/png', buffer: png });
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(1);
}

test('the icon works on a local file and saves under its folder', async () => {
  await s.page.goto(fileUrl('site', 'a.html'));
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  await addDesign();
  const folder = pathToFileURL(path.join(dir, 'site')).href + '/';
  await expect.poll(keys).toContain(`po.site.${folder}`);
  expect(await keys()).not.toContain('po.site.null');
});

test('files in one folder share layers; another folder starts empty', async () => {
  await s.page.goto(fileUrl('site', 'a.html'));
  await s.clickIcon();
  await addDesign();
  await s.page.goto(fileUrl('site', 'b.html'));
  await s.clickIcon();
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(1);
  await s.page.goto(fileUrl('other', 'a.html'));
  await s.clickIcon();
  await expect(s.page.locator(P('title'))).toBeVisible();
  await expect(s.page.locator('pixel-overlay-layers img')).toHaveCount(0);
});

test('Keep on this site is off for local files, and says why', async () => {
  await s.page.goto(fileUrl('site', 'a.html'));
  await s.clickIcon();
  await expect(s.page.locator(P('keep'))).toBeDisabled();
  await expect(s.page.locator('pixel-overlay-panel')).toContainText(/local file/i);
});

test('the help page explains the file access switch and links to the settings', async () => {
  const help = await s.context.newPage();
  await help.goto(`chrome-extension://${s.extensionId}/local-files.html`);
  await expect(help.locator('body')).toContainText('Allow access to file URLs');
  await expect(help.locator('[data-po="open-settings"]')).toBeVisible();
});
