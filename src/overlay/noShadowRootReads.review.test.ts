// Claude's guard for ticket B1 item 2. agy: never edit this file.
// The Store build attaches CLOSED shadow roots, so `host.shadowRoot` is null there, while the
// e2e build (open roots) makes such code look fine in every browser test. Ban the read itself.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('closed shadow roots', () => {
  it('no source file reads .shadowRoot', () => {
    const files = sourceFiles('src');
    expect(files.length).toBeGreaterThan(15);
    const offenders = files.filter((f) => /\.shadowRoot\b/.test(readFileSync(f, 'utf-8')));
    expect(offenders).toEqual([]);
  });
});
