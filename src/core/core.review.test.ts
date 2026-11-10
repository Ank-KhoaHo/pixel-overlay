// Claude's review tests for plan Task 2. agy: never edit this file.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPACITY,
  MAX_IMAGE_BYTES,
  MAX_SCALE,
  MIN_SCALE,
  type NewLayer,
  type SiteState,
} from './types';
import {
  addLayer,
  emptySiteState,
  moveLayer,
  nudge,
  parseSiteState,
  removeLayer,
  selectLayer,
  setAllVisible,
  setBlend,
  setPanel,
  setShown,
  updateLayer,
} from './state';
import { imageKey, originOf, siteKey } from './site';
import { checkImageFile, layerNameFromFile } from './image';
import { keyToNudge, type KeyInput } from './keys';
import { isMessage } from './messages';

const nl = (id: string): NewLayer => ({
  id,
  name: `n-${id}`,
  imageId: `img-${id}`,
  naturalWidth: 1440,
  naturalHeight: 900,
});

function three(): SiteState {
  return addLayer(addLayer(addLayer(emptySiteState(), nl('a')), nl('b')), nl('c'));
}

describe('constants', () => {
  it('match the plan exactly', () => {
    expect(DEFAULT_OPACITY).toBe(0.5);
    expect(MIN_SCALE).toBe(0.1);
    expect(MAX_SCALE).toBe(4);
    expect(MAX_IMAGE_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('emptySiteState', () => {
  it('is a valid v1 state with nothing in it', () => {
    const s = emptySiteState();
    expect(s).toEqual({
      schemaVersion: 1,
      layers: [],
      activeLayerId: null,
      blend: 'normal',
      invert: false,
      shown: true,
      allHidden: false,
      panel: { x: -1, y: 16, collapsed: false },
    });
    expect(parseSiteState(s)).toEqual(s);
  });
});

describe('addLayer', () => {
  it('puts the new layer on top, active, with the defaults', () => {
    const s = addLayer(addLayer(emptySiteState(), nl('a')), nl('b'));
    expect(s.layers.map((l) => l.id)).toEqual(['a', 'b']);
    expect(s.activeLayerId).toBe('b');
    expect(s.layers[1]).toEqual({
      id: 'b',
      name: 'n-b',
      imageId: 'img-b',
      naturalWidth: 1440,
      naturalHeight: 900,
      x: 0,
      y: 0,
      opacity: 0.5,
      scale: 1,
      visible: true,
      locked: false,
    });
  });

  it('has no layer limit', () => {
    let s = emptySiteState();
    for (let i = 0; i < 50; i++) s = addLayer(s, nl(String(i)));
    expect(s.layers).toHaveLength(50);
  });

  it('does not mutate its input', () => {
    const before = emptySiteState();
    const copy = structuredClone(before);
    addLayer(before, nl('a'));
    expect(before).toEqual(copy);
  });
});

describe('removeLayer', () => {
  it('removes the active top layer and activates the new top layer', () => {
    const { state, removedImageId } = removeLayer(three(), 'c');
    expect(state.layers.map((l) => l.id)).toEqual(['a', 'b']);
    expect(state.activeLayerId).toBe('b');
    expect(removedImageId).toBe('img-c');
  });

  it('keeps the active layer when another one is removed', () => {
    const s = selectLayer(three(), 'b');
    const { state } = removeLayer(s, 'a');
    expect(state.activeLayerId).toBe('b');
  });

  it('leaves no active layer when the last one goes', () => {
    const { state } = removeLayer(addLayer(emptySiteState(), nl('a')), 'a');
    expect(state.layers).toEqual([]);
    expect(state.activeLayerId).toBeNull();
  });

  it('returns the same object for an unknown id', () => {
    const s = three();
    const r = removeLayer(s, 'zzz');
    expect(r.state).toBe(s);
    expect(r.removedImageId).toBeNull();
  });
});

describe('selectLayer', () => {
  it('selects an existing layer or none', () => {
    expect(selectLayer(three(), 'a').activeLayerId).toBe('a');
    expect(selectLayer(three(), null).activeLayerId).toBeNull();
  });

  it('ignores an unknown id', () => {
    const s = three();
    expect(selectLayer(s, 'zzz')).toBe(s);
  });
});

describe('updateLayer', () => {
  const s0 = () => addLayer(emptySiteState(), nl('a'));
  const get = (s: SiteState) => s.layers[0]!;

  it('clamps opacity to 0..1', () => {
    expect(get(updateLayer(s0(), 'a', { opacity: 1.7 })).opacity).toBe(1);
    expect(get(updateLayer(s0(), 'a', { opacity: -0.2 })).opacity).toBe(0);
    expect(get(updateLayer(s0(), 'a', { opacity: 0.25 })).opacity).toBe(0.25);
  });

  it('clamps scale to 0.1..4', () => {
    expect(get(updateLayer(s0(), 'a', { scale: 0 })).scale).toBe(0.1);
    expect(get(updateLayer(s0(), 'a', { scale: 9 })).scale).toBe(4);
    expect(get(updateLayer(s0(), 'a', { scale: 0.5 })).scale).toBe(0.5);
  });

  it('rounds x and y to whole pixels, negatives allowed', () => {
    const l = get(updateLayer(s0(), 'a', { x: 12.6, y: -3.4 }));
    expect(l.x).toBe(13);
    expect(l.y).toBe(-3);
  });

  it('ignores NaN and Infinity, field by field', () => {
    const s = updateLayer(s0(), 'a', { x: 5, y: 7, opacity: 0.8, scale: 2 });
    const l = get(updateLayer(s, 'a', { x: Number.NaN, y: Infinity, opacity: Number.NaN, scale: -Infinity }));
    expect(l).toMatchObject({ x: 5, y: 7, opacity: 0.8, scale: 2 });
  });

  it('trims the name and refuses an empty one', () => {
    expect(get(updateLayer(s0(), 'a', { name: '  home  ' })).name).toBe('home');
    expect(get(updateLayer(s0(), 'a', { name: '   ' })).name).toBe('n-a');
  });

  it('sets visible and locked', () => {
    const l = get(updateLayer(s0(), 'a', { visible: false, locked: true }));
    expect(l.visible).toBe(false);
    expect(l.locked).toBe(true);
  });

  it('returns the same object for an unknown id', () => {
    const s = s0();
    expect(updateLayer(s, 'zzz', { x: 4 })).toBe(s);
  });
});

describe('nudge', () => {
  it('moves only the active, unlocked layer', () => {
    let s = three(); // c active
    s = nudge(nudge(s, 1, 0), 10, -2);
    expect(s.layers.find((l) => l.id === 'c')).toMatchObject({ x: 11, y: -2 });
    expect(s.layers.find((l) => l.id === 'a')).toMatchObject({ x: 0, y: 0 });
  });

  it('does nothing to a locked layer', () => {
    const s = updateLayer(three(), 'c', { locked: true });
    expect(nudge(s, 1, 1)).toBe(s);
  });

  it('does nothing with no active layer', () => {
    const s = selectLayer(three(), null);
    expect(nudge(s, 1, 1)).toBe(s);
  });
});

describe('moveLayer', () => {
  it('up moves toward the top (end of the array)', () => {
    expect(moveLayer(three(), 'a', 'up').layers.map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });

  it('down moves toward the bottom', () => {
    expect(moveLayer(three(), 'c', 'down').layers.map((l) => l.id)).toEqual(['a', 'c', 'b']);
  });

  it('returns the same object at either end or for an unknown id', () => {
    const s = three();
    expect(moveLayer(s, 'c', 'up')).toBe(s);
    expect(moveLayer(s, 'a', 'down')).toBe(s);
    expect(moveLayer(s, 'zzz', 'up')).toBe(s);
  });
});

describe('view settings', () => {
  it('sets blend, shown, panel and all-visible', () => {
    let s = three();
    s = setBlend(s, 'difference');
    s = setShown(s, false);
    s = setPanel(s, { collapsed: true, x: 40 });
    s = setAllVisible(s, false);
    expect(s.blend).toBe('difference');
    expect(s.shown).toBe(false);
    expect(s.panel).toEqual({ x: 40, y: 16, collapsed: true });
    expect(s.layers.every((l) => !l.visible)).toBe(true);
  });

  it('returns the same object when nothing changes', () => {
    const s = emptySiteState();
    expect(setBlend(s, 'normal')).toBe(s);
    expect(setShown(s, true)).toBe(s);
  });
});

describe('parseSiteState', () => {
  it('accepts a state that went through JSON', () => {
    const s = setBlend(three(), 'difference');
    expect(parseSiteState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'hello'],
    ['an array', []],
    ['wrong version', { ...emptySiteState(), schemaVersion: 2 }],
    // A6: an unknown blend no longer rejects the state; it reads as Normal (a6.review.test.ts).
    ['layers not an array', { ...emptySiteState(), layers: {} }],
    ['active id that does not exist', { ...emptySiteState(), activeLayerId: 'ghost' }],
    ['panel missing', { ...emptySiteState(), panel: undefined }],
  ])('rejects %s', (_label, raw) => {
    expect(parseSiteState(raw)).toBeNull();
  });

  it('rejects a layer with a wrong field type', () => {
    const s = JSON.parse(JSON.stringify(three()));
    s.layers[1].opacity = '0.5';
    expect(parseSiteState(s)).toBeNull();
  });

  it('rejects a layer with a missing field', () => {
    const s = JSON.parse(JSON.stringify(three()));
    delete s.layers[0].locked;
    expect(parseSiteState(s)).toBeNull();
  });
});

describe('site keys', () => {
  it('keeps scheme, host and port; drops path, query and hash', () => {
    expect(originOf('http://localhost:3000/login?x=1#top')).toBe('http://localhost:3000');
    expect(originOf('https://example.com/a/b')).toBe('https://example.com');
  });

  it('returns null for pages that are not http(s)', () => {
    expect(originOf('chrome://extensions')).toBeNull();
    expect(originOf('file:///C:/a.html')).toBeNull();
    expect(originOf('not a url')).toBeNull();
  });

  it('builds storage keys', () => {
    expect(siteKey('http://localhost:3000')).toBe('po.site.http://localhost:3000');
    expect(imageKey('abc')).toBe('po.img.abc');
  });
});

describe('checkImageFile', () => {
  it('accepts the four raster types up to 25 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(checkImageFile({ type, size: MAX_IMAGE_BYTES })).toEqual({ ok: true });
    }
  });

  it('refuses SVG, other types, empty and too-big files, with a reason', () => {
    for (const f of [
      { type: 'image/svg+xml', size: 10 },
      { type: 'application/pdf', size: 10 },
      { type: '', size: 10 },
      { type: 'image/png', size: 0 },
      { type: 'image/png', size: MAX_IMAGE_BYTES + 1 },
    ]) {
      const r = checkImageFile(f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(5);
    }
  });

  it('names SVG in the reason, so the user knows why', () => {
    const r = checkImageFile({ type: 'image/svg+xml', size: 10 });
    expect(r.ok ? '' : r.reason).toMatch(/svg/i);
  });
});

describe('layerNameFromFile', () => {
  it('drops the last extension only', () => {
    expect(layerNameFromFile('home@2x.png')).toBe('home@2x');
    expect(layerNameFromFile('a.b.jpeg')).toBe('a.b');
    expect(layerNameFromFile('noext')).toBe('noext');
  });

  it('falls back to "Layer"', () => {
    expect(layerNameFromFile('')).toBe('Layer');
    expect(layerNameFromFile('.png')).toBe('Layer');
  });
});

describe('keyToNudge', () => {
  const k = (key: string, more: Partial<KeyInput> = {}): KeyInput => ({
    key,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    inEditable: false,
    ...more,
  });

  it('maps arrows to 1 px, Shift to 10 px', () => {
    expect(keyToNudge(k('ArrowLeft'))).toEqual({ dx: -1, dy: 0 });
    expect(keyToNudge(k('ArrowRight'))).toEqual({ dx: 1, dy: 0 });
    expect(keyToNudge(k('ArrowUp'))).toEqual({ dx: 0, dy: -1 });
    expect(keyToNudge(k('ArrowDown', { shiftKey: true }))).toEqual({ dx: 0, dy: 10 });
  });

  it('ignores other keys, modifier combos and text fields', () => {
    expect(keyToNudge(k('a'))).toBeNull();
    expect(keyToNudge(k('ArrowLeft', { altKey: true }))).toBeNull();
    expect(keyToNudge(k('ArrowLeft', { ctrlKey: true }))).toBeNull();
    expect(keyToNudge(k('ArrowLeft', { metaKey: true }))).toBeNull();
    expect(keyToNudge(k('ArrowLeft', { inEditable: true }))).toBeNull();
  });
});

describe('isMessage', () => {
  it('accepts the three shapes', () => {
    expect(isMessage({ type: 'po/toggle' })).toBe(true);
    expect(isMessage({ type: 'po/keep', origin: 'http://a.test', on: true })).toBe(true);
    expect(isMessage({ type: 'po/granted', origin: 'http://a.test' })).toBe(true);
    expect(isMessage({ type: 'po/show' })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isMessage(null)).toBe(false);
    expect(isMessage({ type: 'po/keep', origin: 'http://a.test' })).toBe(false);
    expect(isMessage({ type: 'po/keep', origin: 5, on: true })).toBe(false);
    expect(isMessage({ type: 'po/granted' })).toBe(false);
    expect(isMessage({ type: 'other' })).toBe(false);
  });
});
