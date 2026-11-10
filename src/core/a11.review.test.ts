// Claude's review tests for ticket A11 (pin a layer to the window). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { addLayer, emptySiteState, parseSiteState, updateLayer } from './state';

const NEW = { id: 'L1', name: 'a', imageId: 'I1', naturalWidth: 10, naturalHeight: 10 };

describe('Layer.fixed', () => {
  it('a new layer scrolls with the page', () => {
    expect(addLayer(emptySiteState(), NEW).layers[0]!.fixed).toBe(false);
  });

  it('updateLayer can pin and unpin a layer', () => {
    const s = updateLayer(addLayer(emptySiteState(), NEW), 'L1', { fixed: true });
    expect(s.layers[0]!.fixed).toBe(true);
    expect(updateLayer(s, 'L1', { fixed: false }).layers[0]!.fixed).toBe(false);
  });

  it('a saved layer from before A11 (no fixed key) loads as not pinned', () => {
    const old = JSON.parse(JSON.stringify(addLayer(emptySiteState(), NEW)));
    delete old.layers[0].fixed;
    const s = parseSiteState(old);
    expect(s).not.toBeNull();
    expect(s!.layers[0]!.fixed).toBe(false);
  });

  it('a saved pinned layer stays pinned; a non-boolean reads as not pinned', () => {
    const saved = JSON.parse(JSON.stringify(updateLayer(addLayer(emptySiteState(), NEW), 'L1', { fixed: true })));
    expect(parseSiteState(saved)!.layers[0]!.fixed).toBe(true);
    saved.layers[0].fixed = 'yes';
    expect(parseSiteState(saved)!.layers[0]!.fixed).toBe(false);
  });
});
