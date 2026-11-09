// Claude's review tests for ticket B1 (state part). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { addLayer, emptySiteState, nudge, parseSiteState, setAllHidden, updateLayer } from './state';
import type { NewLayer } from './types';

const nl = (id: string): NewLayer => ({ id, name: id, imageId: `i-${id}`, naturalWidth: 10, naturalHeight: 10 });

describe('allHidden (Hide all)', () => {
  it('a stored state from before B1, without allHidden, reads as allHidden false', () => {
    const old = JSON.parse(JSON.stringify(addLayer(emptySiteState(), nl('a'))));
    delete old.allHidden;
    const parsed = parseSiteState(old);
    expect(parsed).not.toBeNull();
    expect(parsed?.allHidden).toBe(false);
  });

  it('a non-boolean allHidden is rejected', () => {
    expect(parseSiteState({ ...emptySiteState(), allHidden: 'yes' })).toBeNull();
  });

  it('setAllHidden flips the flag and leaves every layer its own visible value', () => {
    let s = addLayer(addLayer(emptySiteState(), nl('a')), nl('b'));
    s = updateLayer(s, 'a', { visible: false });
    const hidden = setAllHidden(s, true);
    expect(hidden.allHidden).toBe(true);
    expect(hidden.layers.map((l) => l.visible)).toEqual([false, true]);
    const back = setAllHidden(hidden, false);
    expect(back.layers.map((l) => l.visible)).toEqual([false, true]);
    expect(setAllHidden(back, false)).toBe(back);
  });

  it('nudge does nothing while all layers are hidden', () => {
    const s = setAllHidden(addLayer(emptySiteState(), nl('a')), true);
    expect(nudge(s, 1, 0)).toBe(s);
  });

  it('nudge does nothing to a hidden active layer', () => {
    const s = updateLayer(addLayer(emptySiteState(), nl('a')), 'a', { visible: false });
    expect(nudge(s, 1, 0)).toBe(s);
  });
});
