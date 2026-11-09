// Claude's review tests for ticket B1 item 2. agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { shadowModeFor } from './shadowMode';

describe('shadowModeFor', () => {
  it('is closed in every build except the e2e test build', () => {
    expect(shadowModeFor('production')).toBe('closed');
    expect(shadowModeFor('development')).toBe('closed');
    expect(shadowModeFor('test')).toBe('closed');
    expect(shadowModeFor('e2e')).toBe('open');
  });
});
