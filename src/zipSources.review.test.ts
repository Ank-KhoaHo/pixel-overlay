// Claude's guard for ticket A3. agy: never edit this file.
// WXT's sources zip packs gitignored files too (CLAUDE.md, docs/ and the rest of the working
// notes). Firefox review publishes what is uploaded, so that zip must stay off; the sources go
// through `npm run zip:sources` (git archive: tracked files only).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../wxt.config';

describe('sources zip', () => {
  it("WXT's own sources zip is off", () => {
    expect(config.zip?.zipSources).toBe(false);
  });

  it('zip:sources uses git archive of HEAD', () => {
    const scripts = JSON.parse(readFileSync('package.json', 'utf-8')).scripts;
    expect(scripts['zip:sources']).toMatch(/^git archive --format=zip .* HEAD$/);
  });
});
