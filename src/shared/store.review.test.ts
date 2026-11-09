// Claude's review tests for plan Task 3. agy: never edit this file.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addLayer, emptySiteState, setBlend } from '../core/state';
import { createMemoryArea } from './storage';
import { createSiteStore } from './store';

const ORIGIN = 'http://localhost:3000';
const KEY = 'po.site.http://localhost:3000';

const layer = {
  id: 'a',
  name: 'home',
  imageId: 'img-a',
  naturalWidth: 10,
  naturalHeight: 10,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createMemoryArea', () => {
  it('stores, reads, removes, and reports changes', async () => {
    const area = createMemoryArea();
    const seen: Array<Record<string, { newValue?: unknown }>> = [];
    const cb = (c: Record<string, { newValue?: unknown }>) => seen.push(c);
    area.onChanged.addListener(cb);
    await area.set({ k: 1 });
    expect(await area.get('k')).toEqual({ k: 1 });
    expect(await area.get(['k', 'missing'])).toEqual({ k: 1 });
    await area.remove('k');
    expect(await area.get('k')).toEqual({});
    area.onChanged.removeListener(cb);
    await area.set({ k: 2 });
    expect(seen).toEqual([{ k: { newValue: 1 } }, { k: { newValue: undefined } }]);
  });

  it('returns copies, so callers cannot change what is stored', async () => {
    const area = createMemoryArea();
    const v = { a: [1] };
    await area.set({ k: v });
    v.a.push(2);
    const got = (await area.get('k')).k as { a: number[] };
    got.a.push(3);
    expect((await area.get('k')).k).toEqual({ a: [1] });
  });
});

describe('createSiteStore', () => {
  it('loads an empty state when nothing is stored', async () => {
    const store = createSiteStore(createMemoryArea(), ORIGIN);
    expect(await store.load()).toEqual(emptySiteState());
  });

  it('saves under the site key and loads it back', async () => {
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    const s = setBlend(addLayer(emptySiteState(), layer), 'difference');
    await store.save(s);
    expect(Object.keys(await area.get(KEY))).toEqual([KEY]);
    expect(await store.load()).toEqual(s);
  });

  it('keeps sites apart, port included', async () => {
    const area = createMemoryArea();
    await createSiteStore(area, ORIGIN).save(addLayer(emptySiteState(), layer));
    expect(await createSiteStore(area, 'http://localhost:3001').load()).toEqual(emptySiteState());
  });

  it('loads an empty state from a malformed value and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createMemoryArea();
    await area.set({ [KEY]: { schemaVersion: 99 } });
    const store = createSiteStore(area, ORIGIN);
    expect(await store.load()).toEqual(emptySiteState());
    expect(await store.load()).toEqual(emptySiteState());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[pixel-overlay]');
  });

  it('puts, gets and removes images under po.img.<id>', async () => {
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    await store.putImage('x1', 'data:image/png;base64,AAAA');
    expect(await area.get('po.img.x1')).toEqual({ 'po.img.x1': 'data:image/png;base64,AAAA' });
    expect(await store.getImage('x1')).toBe('data:image/png;base64,AAAA');
    await store.removeImage('x1');
    expect(await store.getImage('x1')).toBeNull();
  });

  it('getImage returns null for a missing or non-string value', async () => {
    const area = createMemoryArea();
    await area.set({ 'po.img.bad': 42 });
    const store = createSiteStore(area, ORIGIN);
    expect(await store.getImage('bad')).toBeNull();
    expect(await store.getImage('none')).toBeNull();
  });

  it('subscribe fires for this site only, with the parsed state', async () => {
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    const got: unknown[] = [];
    const off = store.subscribe((s) => got.push(s));
    await createSiteStore(area, 'http://other.test').save(addLayer(emptySiteState(), layer));
    await store.putImage('x', 'data:,');
    const s = addLayer(emptySiteState(), layer);
    await store.save(s);
    expect(got).toEqual([s]);
    off();
    await store.save(emptySiteState());
    expect(got).toHaveLength(1);
  });

  it('subscribe gives an empty state when the site key is removed or malformed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    await store.save(addLayer(emptySiteState(), layer));
    const got: unknown[] = [];
    store.subscribe((s) => got.push(s));
    await area.remove(KEY);
    await area.set({ [KEY]: 'garbage' });
    expect(got).toEqual([emptySiteState(), emptySiteState()]);
  });
});
