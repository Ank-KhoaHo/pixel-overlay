// Claude's review tests for ticket A12 (export and import a site's layers). agy: never edit this file.
import { describe, expect, it } from 'vitest';
import { addLayer, emptySiteState, setBlend } from './state';
import { appendImported, buildExport, EXPORT_FORMAT, parseImport } from './transfer';
import { MAX_IMAGE_BYTES, type SiteState } from './types';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQ';

function twoLayers(): SiteState {
  let s = addLayer(emptySiteState(), { id: 'L1', name: 'desktop', imageId: 'I1', naturalWidth: 10, naturalHeight: 10 });
  s = addLayer(s, { id: 'L2', name: 'mobile', imageId: 'I2', naturalWidth: 5, naturalHeight: 5 });
  return setBlend(s, 'difference');
}
const IMAGES = { I1: PNG, I2: JPG };

function exported() {
  return JSON.parse(JSON.stringify(buildExport('https://a.test', twoLayers(), IMAGES, new Date('2026-11-10T00:00:00Z'))));
}

describe('buildExport', () => {
  it('carries the format, the site, the date, every layer and every image', () => {
    const e = exported();
    expect(e.format).toBe(EXPORT_FORMAT);
    expect(e.version).toBe(1);
    expect(e.site).toBe('https://a.test');
    expect(e.exportedAt).toBe('2026-11-10T00:00:00.000Z');
    expect(e.layers.map((l: { name: string }) => l.name)).toEqual(['desktop', 'mobile']);
    expect(e.images).toEqual(IMAGES);
  });
});

describe('buildExport leaves out', () => {
  it('images that no layer uses', () => {
    const e = buildExport('https://a.test', twoLayers(), { ...IMAGES, OLD: PNG }, new Date());
    expect(Object.keys(e.images).sort()).toEqual(['I1', 'I2']);
  });
});

describe('parseImport', () => {
  it('reads back what buildExport wrote', () => {
    const r = parseImport(exported());
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.layers).toHaveLength(2);
    expect(r.images).toEqual(IMAGES);
  });

  it.each([
    ['not an object', 'hello'],
    ['another format', { ...exported(), format: 'something-else' }],
    ['a newer version', { ...exported(), version: 2 }],
    ['no layers', { ...exported(), layers: [] }],
  ])('refuses %s with a message', (_label, raw) => {
    const r = parseImport(raw);
    expect('error' in r && r.error.length > 0).toBe(true);
  });

  it('refuses a layer whose image is missing', () => {
    const e = exported();
    delete e.images.I2;
    expect('error' in parseImport(e)).toBe(true);
  });

  it('refuses an SVG or a non-image data URL', () => {
    const e = exported();
    e.images.I1 = 'data:image/svg+xml;base64,PHN2Zz4=';
    expect('error' in parseImport(e)).toBe(true);
    e.images.I1 = 'data:text/html;base64,PGgxPg==';
    expect('error' in parseImport(e)).toBe(true);
    e.images.I1 = 'https://example.com/a.png';
    expect('error' in parseImport(e)).toBe(true);
  });

  it('refuses an image over the size limit', () => {
    const e = exported();
    e.images.I1 = 'data:image/png;base64,' + 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8);
    expect('error' in parseImport(e)).toBe(true);
  });

  it('drops an image that no layer uses, so import never stores orphans', () => {
    const e = exported();
    e.images.UNUSED = PNG;
    const r = parseImport(e);
    if ('error' in r) throw new Error(r.error);
    expect(Object.keys(r.images).sort()).toEqual(['I1', 'I2']);
  });

  it('refuses a broken layer', () => {
    const e = exported();
    e.layers[0].opacity = 'half';
    expect('error' in parseImport(e)).toBe(true);
  });
});

describe('appendImported', () => {
  it('adds the layers on top with new ids, keeps the existing ones, and selects the top one', () => {
    const r = parseImport(exported());
    if ('error' in r) throw new Error(r.error);
    let n = 0;
    const out = appendImported(twoLayers(), r, () => `N${++n}`);
    expect(out.state.layers.map((l) => l.name)).toEqual(['desktop', 'mobile', 'desktop', 'mobile']);
    const ids = out.state.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.slice(0, 2)).toEqual(['L1', 'L2']);
    expect(out.state.activeLayerId).toBe(ids[3]);
    const added = out.state.layers.slice(2);
    for (const l of added) {
      expect(['L1', 'L2', 'I1', 'I2']).not.toContain(l.imageId);
      expect(out.images[l.imageId]).toMatch(/^data:image\//);
    }
    expect(Object.keys(out.images)).toHaveLength(2);
  });

  it('leaves the site settings (blend, panel) as they were', () => {
    const r = parseImport(exported());
    if ('error' in r) throw new Error(r.error);
    const before = { ...emptySiteState(), blend: 'screen' as const };
    const out = appendImported(before, r, () => crypto.randomUUID());
    expect(out.state.blend).toBe('screen');
    expect(out.state.panel).toEqual(before.panel);
  });
});
