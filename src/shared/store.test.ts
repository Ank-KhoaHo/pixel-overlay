import { browser } from 'wxt/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addLayer, emptySiteState } from '../core/state';
import { createMemoryArea } from './storage';
import { chromeLocalArea, createSiteStore } from './store';

const ORIGIN = 'https://example.com';
const SITE_KEY = 'po.site.https://example.com';

const testLayer = {
  id: 'layer-1',
  name: 'test-layer',
  imageId: 'img-1',
  naturalWidth: 200,
  naturalHeight: 150,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createMemoryArea edge cases', () => {
  it('does not fire onChanged when set is called with empty items', async () => {
    const area = createMemoryArea();
    const listener = vi.fn();
    area.onChanged.addListener(listener);
    await area.set({});
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not fire onChanged when remove is called with empty keys array', async () => {
    const area = createMemoryArea();
    const listener = vi.fn();
    area.onChanged.addListener(listener);
    await area.remove([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies on multi-key remove with newValue: undefined', async () => {
    const area = createMemoryArea();
    const seen: Array<Record<string, { newValue?: unknown }>> = [];
    area.onChanged.addListener((c) => seen.push(c));
    await area.set({ a: 1, b: 2 });
    await area.remove(['a', 'b', 'nonexistent']);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual({
      a: { newValue: undefined },
      b: { newValue: undefined },
      nonexistent: { newValue: undefined },
    });
  });

  it('handles get with single string or string array', async () => {
    const area = createMemoryArea();
    await area.set({ foo: 'bar', num: 42 });
    expect(await area.get('foo')).toEqual({ foo: 'bar' });
    expect(await area.get(['foo', 'num'])).toEqual({ foo: 'bar', num: 42 });
    expect(await area.get(['missing'])).toEqual({});
  });
});

describe('createSiteStore additional coverage', () => {
  it('returns emptySiteState and warns when area.get throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createMemoryArea();
    vi.spyOn(area, 'get').mockRejectedValue(new Error('disk failure'));

    const store = createSiteStore(area, ORIGIN);
    const state = await store.load();

    expect(state).toEqual(emptySiteState());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[pixel-overlay]');
  });

  it('warns only once across multiple loads and malformed subscribe events', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createMemoryArea();
    await area.set({ [SITE_KEY]: { invalid: true } });

    const store = createSiteStore(area, ORIGIN);
    await store.load();
    await store.load();

    const unsub = store.subscribe(() => {});
    await area.set({ [SITE_KEY]: { anotherBadState: true } });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[pixel-overlay]');
    unsub();
  });

  it('getImage returns null for non-string types (objects, booleans, numbers)', async () => {
    const area = createMemoryArea();
    await area.set({
      'po.img.obj': { foo: 'bar' },
      'po.img.bool': true,
      'po.img.num': 123,
    });
    const store = createSiteStore(area, ORIGIN);
    expect(await store.getImage('obj')).toBeNull();
    expect(await store.getImage('bool')).toBeNull();
    expect(await store.getImage('num')).toBeNull();
  });

  it('subscribe ignores changes to other keys and image keys', async () => {
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    const received: unknown[] = [];
    const unsub = store.subscribe((s) => received.push(s));

    await area.set({
      'po.site.https://other.com': { schemaVersion: 1, layers: [] },
      'po.img.some-id': 'data:image/png;base64,...',
      unrelated: 'value',
    });

    expect(received).toHaveLength(0);
    unsub();
  });

  it('subscribe delivers valid state changes to subscriber', async () => {
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    const received: unknown[] = [];
    const unsub = store.subscribe((s) => received.push(s));

    const newState = addLayer(emptySiteState(), testLayer);
    await store.save(newState);

    expect(received).toEqual([newState]);
    unsub();
  });

  it('unsubscribe stops listening for changes', async () => {
    const area = createMemoryArea();
    const store = createSiteStore(area, ORIGIN);
    const received: unknown[] = [];
    const unsub = store.subscribe((s) => received.push(s));

    await store.save(emptySiteState());
    expect(received).toHaveLength(1);

    unsub();
    await store.save(addLayer(emptySiteState(), testLayer));
    expect(received).toHaveLength(1);
  });
});

describe('chromeLocalArea adapter', () => {
  it('delegates get, set, remove to browser.storage.local', async () => {
    const getSpy = vi
      .spyOn(browser.storage.local, 'get')
      .mockImplementation(async () => ({ myKey: 'value' }));
    const setSpy = vi.spyOn(browser.storage.local, 'set').mockImplementation(async () => {});
    const removeSpy = vi.spyOn(browser.storage.local, 'remove').mockImplementation(async () => {});

    const area = chromeLocalArea();

    const got = await area.get('myKey');
    expect(got).toEqual({ myKey: 'value' });
    expect(getSpy).toHaveBeenCalledWith('myKey');

    await area.set({ myKey: 'newValue' });
    expect(setSpy).toHaveBeenCalledWith({ myKey: 'newValue' });

    await area.remove('myKey');
    expect(removeSpy).toHaveBeenCalledWith('myKey');
  });

  it('wires onChanged listeners and filters by local areaName', () => {
    type Listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;
    let capturedListener: Listener | undefined;
    vi.spyOn(browser.storage.onChanged, 'addListener').mockImplementation((fn) => {
      capturedListener = fn as unknown as Listener;
    });
    const removeSpy = vi.spyOn(browser.storage.onChanged, 'removeListener').mockImplementation(() => {});

    const area = chromeLocalArea();
    const seen: Array<Record<string, { newValue?: unknown }>> = [];
    const cb = (c: Record<string, { newValue?: unknown }>) => seen.push(c);

    area.onChanged.addListener(cb);
    // Duplicate addListener does not re-register
    area.onChanged.addListener(cb);
    expect(browser.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
    expect(capturedListener).toBeDefined();

    // Trigger event for 'sync' area -> ignored
    capturedListener!({ key: { newValue: 'syncVal' } }, 'sync');
    expect(seen).toHaveLength(0);

    // Trigger event for 'local' area -> handled
    capturedListener!({ key: { newValue: 'localVal' } }, 'local');
    expect(seen).toEqual([{ key: { newValue: 'localVal' } }]);

    // Remove listener
    area.onChanged.removeListener(cb);
    expect(removeSpy).toHaveBeenCalledTimes(1);

    // Removing unknown listener does nothing
    area.onChanged.removeListener(() => {});
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
