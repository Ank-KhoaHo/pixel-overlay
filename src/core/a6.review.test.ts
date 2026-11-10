// Claude's review tests for ticket A6 (compare modes). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { emptySiteState, parseSiteState, setBlend, setInvert } from './state';
import type { SiteState } from './types';

function saved(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    layers: [],
    activeLayerId: null,
    blend: 'normal',
    shown: true,
    allHidden: false,
    panel: { x: -1, y: 16, collapsed: false },
    ...over,
  };
}

describe('blend modes', () => {
  it('a new site starts in Normal, not inverted', () => {
    const s = emptySiteState();
    expect(s.blend).toBe('normal');
    expect(s.invert).toBe(false);
  });

  it.each(['normal', 'difference', 'multiply', 'screen'] as const)('setBlend accepts %s', (b) => {
    const s = setBlend(emptySiteState(), b);
    expect(s.blend).toBe(b);
  });

  it('setBlend to the current value returns the same object (no save)', () => {
    const s = setBlend(emptySiteState(), 'multiply');
    expect(setBlend(s, 'multiply')).toBe(s);
  });

  it('setBlend does not touch invert, and setInvert does not touch blend', () => {
    let s: SiteState = setInvert(emptySiteState(), true);
    s = setBlend(s, 'screen');
    expect(s.invert).toBe(true);
    s = setInvert(s, false);
    expect(s.blend).toBe('screen');
    expect(s.invert).toBe(false);
  });

  it('setInvert to the current value returns the same object', () => {
    const s = setInvert(emptySiteState(), true);
    expect(setInvert(s, true)).toBe(s);
  });
});

describe('parseSiteState with modes', () => {
  it('a save from 0.1.0 (no invert key) loads, with invert off', () => {
    const s = parseSiteState(saved({ blend: 'difference' }));
    expect(s).not.toBeNull();
    expect(s!.blend).toBe('difference');
    expect(s!.invert).toBe(false);
  });

  it.each(['multiply', 'screen'])('keeps a saved %s blend', (b) => {
    expect(parseSiteState(saved({ blend: b }))?.blend).toBe(b);
  });

  it('keeps a saved invert: true', () => {
    expect(parseSiteState(saved({ invert: true }))?.invert).toBe(true);
  });

  it('an unknown blend falls back to Normal instead of losing the layers', () => {
    const layer = {
      id: 'L1', name: 'a', imageId: 'I1', naturalWidth: 10, naturalHeight: 10,
      x: 0, y: 0, opacity: 0.5, scale: 1, visible: true, locked: false,
    };
    const s = parseSiteState(saved({ blend: 'color-dodge', layers: [layer], activeLayerId: 'L1' }));
    expect(s).not.toBeNull();
    expect(s!.blend).toBe('normal');
    expect(s!.layers).toHaveLength(1);
  });

  it('a non-boolean invert reads as off', () => {
    expect(parseSiteState(saved({ invert: 'yes' }))?.invert).toBe(false);
  });
});
