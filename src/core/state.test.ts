import { describe, expect, it } from 'vitest';
import {
  addLayer,
  emptySiteState,
  moveLayer,
  nudge,
  removeLayer,
  selectLayer,
  setAllVisible,
  setPanel,
  updateLayer,
} from './state';
import type { NewLayer, SiteState } from './types';

const nl = (id: string): NewLayer => ({
  id,
  name: `layer-${id}`,
  imageId: `img-${id}`,
  naturalWidth: 1000,
  naturalHeight: 600,
});

function threeLayers(): SiteState {
  return addLayer(addLayer(addLayer(emptySiteState(), nl('1')), nl('2')), nl('3'));
}

describe('state edge cases and purity', () => {
  it('setPanel with an empty patch returns the same object', () => {
    const s = emptySiteState();
    const updated = setPanel(s, {});
    expect(updated).toBe(s);
  });

  it('setPanel with identical values returns the same object', () => {
    const s = emptySiteState();
    const updated = setPanel(s, { ...s.panel });
    expect(updated).toBe(s);
  });

  it('moveLayer keeps activeLayerId', () => {
    const s = selectLayer(threeLayers(), '1');
    expect(s.activeLayerId).toBe('1');

    const moved = moveLayer(s, '1', 'up');
    expect(moved.layers.map((l) => l.id)).toEqual(['2', '1', '3']);
    expect(moved.activeLayerId).toBe('1');

    const movedOther = moveLayer(moved, '3', 'down');
    expect(movedOther.layers.map((l) => l.id)).toEqual(['2', '3', '1']);
    expect(movedOther.activeLayerId).toBe('1');
  });

  it('removeLayer of a middle layer keeps the order', () => {
    const s = threeLayers(); // layers: ['1', '2', '3']
    const { state, removedImageId } = removeLayer(s, '2');
    expect(state.layers.map((l) => l.id)).toEqual(['1', '3']);
    expect(removedImageId).toBe('img-2');
    expect(state.activeLayerId).toBe('3');
  });

  it('updateLayer with empty patch or matching values returns the same object', () => {
    const s = threeLayers();
    expect(updateLayer(s, '1', {})).toBe(s);
    expect(updateLayer(s, '1', { name: 'layer-1', opacity: 0.5 })).toBe(s);
  });

  it('setAllVisible returns the same object when already matching', () => {
    const s = threeLayers();
    expect(setAllVisible(s, true)).toBe(s);
  });

  it('nudge returns the same object when dx and dy are 0', () => {
    const s = threeLayers();
    expect(nudge(s, 0, 0)).toBe(s);
  });
});
