// Claude's review tests for ticket B4. agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { moveLayer } from './state';
import type { SiteState } from './types';

function st(groups: Array<[string, string]>, filter: string): SiteState {
  return {
    schemaVersion: 1,
    layers: groups.map(([id, group]) => ({
      id, name: id, imageId: 'I' + id, naturalWidth: 10, naturalHeight: 10, x: 0, y: 0,
      opacity: 1, scale: 1, visible: true, locked: false, fixed: false, group,
    })),
    activeLayerId: groups[0]![0],
    blend: 'normal',
    invert: false,
    filter,
    shown: true,
  } as unknown as SiteState;
}
const ids = (s: SiteState) => s.layers.map((l: { id: string }) => l.id);

describe('B4 F5: moving a layer with a filter on does not move hidden layers or the other shown one', () => {
  it('Up: the layer goes just above the next shown layer; layers in between stay above that one', () => {
    // Bottom to top: A(g1), X(g2), B(g1). Filter g1. A goes up past B.
    const s = moveLayer(st([['A', 'g1'], ['X', 'g2'], ['B', 'g1']], 'g1'), 'A', 'up');
    expect(ids(s)).toEqual(['X', 'B', 'A']);
  });
  it('Down: the layer goes just below the next shown layer', () => {
    const s = moveLayer(st([['A', 'g1'], ['X', 'g2'], ['B', 'g1']], 'g1'), 'B', 'down');
    expect(ids(s)).toEqual(['B', 'A', 'X']);
  });
  it('without a filter it is a plain swap with the neighbour', () => {
    expect(ids(moveLayer(st([['A', ''], ['B', ''], ['C', '']], ''), 'A', 'up'))).toEqual(['B', 'A', 'C']);
    expect(ids(moveLayer(st([['A', ''], ['B', ''], ['C', '']], ''), 'C', 'down'))).toEqual(['A', 'C', 'B']);
  });
  it('at the end of the shown layers it does nothing', () => {
    const s0 = st([['A', 'g1'], ['X', 'g2']], 'g1');
    expect(moveLayer(s0, 'A', 'up')).toBe(s0);
  });
});

describe('B4 F7: a stale content script leaves no host behind', () => {
  it('the clean-up removes the pinned host too', () => {
    // A new script replaces a dead one (extension reloaded or updated) by removing its hosts.
    // The pinned layers live in a third host; it must be in the same clean-up.
    const src = readFileSync('src/entrypoints/overlay.content.ts', 'utf-8');
    const m = src.match(/querySelectorAll\(\s*'([^']*pixel-overlay-panel[^']*)'/);
    expect(m, 'clean-up selector not found').not.toBeNull();
    const tags = m![1]!.split(',').map((t) => t.trim()).sort();
    expect(tags).toEqual(['pixel-overlay-fixed', 'pixel-overlay-layers', 'pixel-overlay-panel']);
  });
});
