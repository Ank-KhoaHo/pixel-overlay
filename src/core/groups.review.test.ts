// Claude's review tests for ticket A2 (groups of layers, with a filter). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import {
  addLayer,
  emptySiteState,
  groupsOf,
  inFilter,
  parseSiteState,
  setFilter,
  updateLayer,
} from './state';
import { isPanelOp } from './remote';
import { buildExport, parseImport } from './transfer';
import type { SiteState } from './types';

const NEW = (id: string) => ({ id, name: id, imageId: `I${id}`, naturalWidth: 10, naturalHeight: 10 });

function three(): SiteState {
  let s = emptySiteState();
  for (const id of ['A', 'B', 'C']) s = addLayer(s, NEW(id));
  s = updateLayer(s, 'A', { group: 'login' });
  s = updateLayer(s, 'B', { group: 'home' });
  s = updateLayer(s, 'C', { group: 'login' });
  return s;
}

describe('groups', () => {
  it('a new site has no filter, and new layers have no group', () => {
    const s = addLayer(emptySiteState(), NEW('A'));
    expect(s.filter).toBe('');
    expect(s.layers[0]!.group).toBe('');
  });

  it('a group name is trimmed and cut to 40 characters', () => {
    let s = addLayer(emptySiteState(), NEW('A'));
    s = updateLayer(s, 'A', { group: '  login  ' });
    expect(s.layers[0]!.group).toBe('login');
    s = updateLayer(s, 'A', { group: 'x'.repeat(60) });
    expect(s.layers[0]!.group).toHaveLength(40);
  });

  it('groupsOf lists each group once, sorted, without the empty one', () => {
    let s = three();
    s = addLayer(s, NEW('D'));
    expect(groupsOf(s)).toEqual(['home', 'login']);
  });

  it('inFilter: everything with no filter; only that group with one', () => {
    const s = three();
    expect(s.layers.every((l) => inFilter(s, l))).toBe(true);
    const f = setFilter(s, 'login');
    expect(f.layers.filter((l) => inFilter(f, l)).map((l) => l.id)).toEqual(['A', 'C']);
  });

  it('a filter that hides the active layer selects the top layer still shown', () => {
    let s = three();
    expect(s.activeLayerId).toBe('C');
    s = setFilter(s, 'home');
    expect(s.activeLayerId).toBe('B');
    s = setFilter(s, 'nobody');
    expect(s.activeLayerId).toBeNull();
  });

  it('a filter that keeps the active layer leaves it active', () => {
    const s = setFilter(three(), 'login');
    expect(s.activeLayerId).toBe('C');
  });

  it('a layer added while filtered joins that group, so it does not vanish', () => {
    const s = addLayer(setFilter(three(), 'home'), NEW('D'));
    expect(s.layers.at(-1)!.group).toBe('home');
    expect(s.activeLayerId).toBe('D');
  });

  it('moving the active layer out of the filtered group selects the next one shown', () => {
    let s = setFilter(three(), 'login');
    s = updateLayer(s, 'C', { group: 'home' });
    expect(s.activeLayerId).toBe('A');
  });

  it('old saved data with no group or filter still loads', () => {
    const old = JSON.parse(JSON.stringify(three()));
    delete old.filter;
    for (const l of old.layers) delete l.group;
    const s = parseSiteState(old);
    expect(s?.filter).toBe('');
    expect(s?.layers.map((l) => l.group)).toEqual(['', '', '']);
  });

  it('a saved filter and groups survive a save and load', () => {
    const s = setFilter(three(), 'home');
    const back = parseSiteState(JSON.parse(JSON.stringify(s)));
    expect(back?.filter).toBe('home');
    expect(back?.layers.map((l) => l.group)).toEqual(['login', 'home', 'login']);
  });
});

describe('the side panel can do the same', () => {
  it('isPanelOp accepts a group patch and a filter, and refuses a non-text group', () => {
    expect(isPanelOp({ op: 'update', id: 'A', patch: { group: 'login' } })).toBe(true);
    expect(isPanelOp({ op: 'filter', filter: 'login' })).toBe(true);
    expect(isPanelOp({ op: 'filter', filter: '' })).toBe(true);
    expect(isPanelOp({ op: 'filter' })).toBe(false);
    expect(isPanelOp({ op: 'update', id: 'A', patch: { group: 3 } })).toBe(false);
  });
});

it('an imported group name is trimmed and cut to 40 characters like a typed one', () => {
  let s = addLayer(emptySiteState(), NEW('A'));
  s = { ...s, layers: [{ ...s.layers[0]!, group: '  ' + 'g'.repeat(60) }] };
  const r = parseImport(JSON.parse(JSON.stringify(buildExport('https://a.test', s, { IA: 'data:image/png;base64,iVBORw0KGgo=' }, new Date()))));
  if ('error' in r) throw new Error(r.error);
  expect(r.layers[0]!.group).toBe('g'.repeat(40));
});
