import { describe, expect, it } from 'vitest';
import { newId } from './ids';

describe('newId', () => {
  it('two newId() calls differ', () => {
    const id1 = newId();
    const id2 = newId();
    expect(id1).not.toBe(id2);
  });

  it('the value is a non-empty string', () => {
    const id = newId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
