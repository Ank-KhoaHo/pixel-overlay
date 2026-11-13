// Claude's review tests for ticket B3 (fixes from the 0.2.0 whole-build review). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { isPanelOp } from './remote';
import { addLayer, emptySiteState, moveLayer, removeLayer, setFilter, updateLayer } from './state';
import { appendLayers, prepareImport } from './transfer';
import type { Layer, SiteState } from './types';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const NEW = (id: string) => ({ id, name: id, imageId: `I${id}`, naturalWidth: 10, naturalHeight: 10 });

function layer(id: string, group = ''): Layer {
  return { ...NEW(id), x: 0, y: 0, opacity: 0.5, scale: 1, visible: true, locked: false, fixed: false, group };
}

describe('import in two steps, so changes made while images are written survive', () => {
  it('prepareImport gives new ids to every layer and image and keeps them paired', () => {
    let n = 0;
    const p = prepareImport({ layers: [layer('A'), layer('B')], images: { IA: PNG, IB: PNG } }, () => `N${++n}`);
    expect(p.layers.map((l) => l.id).every((id) => id.startsWith('N'))).toBe(true);
    expect(new Set([...p.layers.map((l) => l.id), ...p.layers.map((l) => l.imageId)]).size).toBe(4);
    for (const l of p.layers) expect(p.images[l.imageId]).toBe(PNG);
    expect(Object.keys(p.images)).toHaveLength(2);
  });

  it('appendLayers adds onto the state it is given, so a layer added meanwhile is kept', () => {
    const p = prepareImport({ layers: [layer('A')], images: { IA: PNG } }, () => crypto.randomUUID());
    const before = addLayer(emptySiteState(), NEW('X'));
    const meanwhile = addLayer(before, NEW('Y'));
    const out = appendLayers(meanwhile, p.layers);
    expect(out.layers.map((l) => l.name)).toEqual(['X', 'Y', 'A']);
    expect(out.activeLayerId).toBe(out.layers[2]!.id);
  });

  it('a layer deleted meanwhile stays deleted', () => {
    const p = prepareImport({ layers: [layer('A')], images: { IA: PNG } }, () => crypto.randomUUID());
    let s = addLayer(emptySiteState(), NEW('X'));
    s = removeLayer(s, 'X').state;
    expect(appendLayers(s, p.layers).layers.map((l) => l.name)).toEqual(['A']);
  });
});

describe('import while a group filter is on', () => {
  function filtered(): SiteState {
    let s = addLayer(emptySiteState(), NEW('X'));
    s = updateLayer(s, 'X', { group: 'desktop' });
    return setFilter(s, 'desktop');
  }

  it('shows all layers when an imported layer is outside the filter, so the import is visible', () => {
    const out = appendLayers(filtered(), [layer('A', 'mobile')]);
    expect(out.filter).toBe('');
    expect(out.layers.at(-1)!.group).toBe('mobile');
    expect(out.activeLayerId).toBe('A');
  });

  it('keeps the filter when every imported layer is inside it', () => {
    const out = appendLayers(filtered(), [layer('A', 'desktop')]);
    expect(out.filter).toBe('desktop');
  });
});

describe('Up and Down skip layers hidden by the filter', () => {
  function mixed(): SiteState {
    let s = emptySiteState();
    for (const [id, g] of [['A', 'x'], ['B', 'y'], ['C', 'x']] as const) {
      s = addLayer(s, NEW(id));
      s = updateLayer(s, id, { group: g });
    }
    return setFilter(s, 'x');
  }

  // B4 F5 replaced the in-place swap: the layer goes just past the next shown one, and the
  // hidden layer between them keeps its place relative to that one.
  it('Up moves just above the next shown layer above', () => {
    expect(moveLayer(mixed(), 'A', 'up').layers.map((l) => l.id)).toEqual(['B', 'C', 'A']);
  });

  it('Down moves just below the next shown layer below', () => {
    expect(moveLayer(mixed(), 'C', 'down').layers.map((l) => l.id)).toEqual(['C', 'A', 'B']);
  });

  it('with no shown layer that way, nothing changes', () => {
    const s = mixed();
    expect(moveLayer(s, 'C', 'up')).toBe(s);
  });

  it('with no filter, Up still swaps with the very next layer', () => {
    const s = setFilter(mixed(), '');
    expect(moveLayer(s, 'A', 'up').layers.map((l) => l.id)).toEqual(['B', 'A', 'C']);
  });
});

it('the side panel can show the overlay again', () => {
  expect(isPanelOp({ op: 'show' })).toBe(true);
});
