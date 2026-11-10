// Claude's review tests for ticket A10 (side panel). agy: never edit this file.
// Reads the BUILT manifests; scripts/check.sh builds all three before vitest runs.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function load(dir: string): Record<string, any> {
  const p = `.output/${dir}/manifest.json`;
  if (!existsSync(p)) throw new Error(`${p} is missing: run the builds first (bash scripts/check.sh)`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

describe('Chrome store build', () => {
  const m = load('chrome-mv3');
  it('declares the side panel page and the sidePanel permission, and still no site access', () => {
    expect(m.side_panel?.default_path).toBe('sidepanel.html');
    expect(m.permissions).toContain('sidePanel');
    expect(m.host_permissions).toBeUndefined();
    expect(existsSync('.output/chrome-mv3/sidepanel.html')).toBe(true);
  });
});

describe('Firefox store build', () => {
  const m = load('firefox-mv3');
  it('uses a sidebar instead, with no Chrome-only permission', () => {
    expect(m.sidebar_action?.default_panel).toBe('sidepanel.html');
    expect(m.permissions).not.toContain('sidePanel');
    expect(m.side_panel).toBeUndefined();
  });
});
