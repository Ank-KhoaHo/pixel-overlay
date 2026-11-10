// Claude's review tests for ticket A3 (the Firefox build). agy: never edit this file.
// Reads the BUILT manifests, so the gate builds all three before vitest runs
// (scripts/check.sh and ci.yml). A missing build fails here on purpose; it never skips.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Manifest = Record<string, any>;

function load(dir: string): Manifest {
  const p = `.output/${dir}/manifest.json`;
  if (!existsSync(p)) throw new Error(`${p} is missing: run the builds first (bash scripts/check.sh)`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

const PERMS = ['activeTab', 'scripting', 'storage', 'unlimitedStorage'];

describe('Firefox store build (.output/firefox-mv3)', () => {
  const m = load('firefox-mv3');

  it('is Manifest V3 with the same permissions as Chrome, and no site access at install', () => {
    expect(m.manifest_version).toBe(3);
    expect([...m.permissions].sort()).toEqual([...PERMS].sort());
    expect(m.optional_host_permissions).toEqual(['<all_urls>']);
    expect(m.host_permissions ?? []).toEqual([]);
  });

  it('runs its background as a script, which Firefox needs (no service worker there)', () => {
    expect(Array.isArray(m.background?.scripts)).toBe(true);
    expect(m.background.scripts.length).toBeGreaterThan(0);
  });

  it('has a fixed gecko id, a minimum version and declares that it collects no data', () => {
    const g = m.browser_specific_settings?.gecko;
    expect(g?.id).toBe('pixel-overlay@wanksolution.com');
    expect(g?.data_collection_permissions).toEqual({ required: ['none'] });
    expect(Number.parseFloat(g?.strict_min_version)).toBeGreaterThanOrEqual(140);
  });

  it('keeps the icon click and the grant page', () => {
    expect(m.action?.default_title).toBe('Pixel Veil');
    expect(existsSync('.output/firefox-mv3/grant.html')).toBe(true);
    expect(existsSync('.output/firefox-mv3/content-scripts/overlay.js')).toBe(true);
  });
});

describe('Chrome store build stays as it was', () => {
  const m = load('chrome-mv3');

  it('has a service worker, no gecko settings and no host_permissions', () => {
    expect(typeof m.background?.service_worker).toBe('string');
    expect(m.browser_specific_settings).toBeUndefined();
    expect(m.host_permissions).toBeUndefined();
    // A10 adds the side panel, Chrome only.
    expect([...m.permissions].sort()).toEqual([...PERMS, 'sidePanel'].sort());
  });
});
