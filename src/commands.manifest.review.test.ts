// Claude's review tests for ticket A7 (shortcuts in the built manifests). agy: never edit this file.
// Chrome allows at most 4 suggested keys; users rebind all of them in chrome://extensions/shortcuts
// (Firefox: about:addons, gear, Manage Extension Shortcuts).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function load(dir: string): Record<string, any> {
  const p = `.output/${dir}/manifest.json`;
  if (!existsSync(p)) throw new Error(`${p} is missing: run the builds first (bash scripts/check.sh)`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

const SUGGESTED: Record<string, string> = {
  _execute_action: 'Alt+Shift+V',
  'toggle-hide-all': 'Alt+Shift+H',
  'opacity-up': 'Alt+Shift+Period',
  'opacity-down': 'Alt+Shift+Comma',
};

describe.each(['chrome-mv3', 'firefox-mv3'])('commands in %s', (dir) => {
  const c = load(dir).commands as Record<string, { suggested_key?: { default?: string }; description?: string }>;

  it('has the five commands, each with a description', () => {
    expect(Object.keys(c).sort()).toEqual(
      ['_execute_action', 'opacity-down', 'opacity-up', 'toggle-difference', 'toggle-hide-all'].sort(),
    );
    for (const [name, cmd] of Object.entries(c)) {
      if (name === '_execute_action') continue;
      expect(cmd.description, name).toMatch(/\w/);
    }
  });

  it('suggests exactly four keys, the agreed ones; Difference has none', () => {
    for (const [name, key] of Object.entries(SUGGESTED)) {
      expect(c[name]?.suggested_key?.default, name).toBe(key);
    }
    expect(c['toggle-difference']?.suggested_key).toBeUndefined();
    const withKeys = Object.values(c).filter((x) => x.suggested_key);
    expect(withKeys).toHaveLength(4);
  });
});
