// Renders art/icon.svg to public/icon/{16,32,48,128}.png with a transparent background.
// Each size is drawn from the vector, not scaled down from 128. Run: node scripts/make_icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('art/icon.svg', 'utf-8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  const sized = svg.replace(/width="128" height="128"/, `width="${size}" height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
  await page.locator('svg').screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
  console.log(`public/icon/${size}.png`);
}
await browser.close();
