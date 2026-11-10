import { expect, test } from '@playwright/test';
import { launchExtension } from './helpers';

declare const chrome: {
  runtime: { getManifest(): { name: string; host_permissions?: string[]; permissions?: string[] } };
};

test('the test build loads and its worker starts', async () => {
  const { context, worker, extensionId } = await launchExtension();
  try {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.name).toBe('Pixel Veil');
    expect(manifest.host_permissions).toEqual(['http://localhost/*', 'file:///*']);
    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage', 'unlimitedStorage']);
  } finally {
    await context.close();
  }
});
