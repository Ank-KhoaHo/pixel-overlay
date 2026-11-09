import { chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

// The test build: `npm run build:e2e`. It adds http://localhost/* to host_permissions,
// because Playwright cannot click Chrome's permission prompt (spec A1, section 9).
export const EXTENSION_PATH = path.resolve('.output/chrome-mv3-e2e');

export interface Launched {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
}

/** Chromium with the unpacked test build loaded. */
export async function launchExtension(): Promise<Launched> {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  return { context, worker, extensionId };
}
