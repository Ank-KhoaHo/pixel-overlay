import { describe, expect, it } from 'vitest';
import { isImageDataUrl } from './image';
import { addLayer, emptySiteState } from './state';
import {
  appendImported,
  buildExport,
  estimateBase64Size,
  exportFilename,
  EXPORT_FORMAT,
  parseImport,
} from './transfer';
import { MAX_IMAGE_BYTES } from './types';

describe('isImageDataUrl', () => {
  it('returns true for supported image data URLs', () => {
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isImageDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isImageDataUrl('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(isImageDataUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);
  });

  it('returns false for unsupported formats or malformed URLs', () => {
    expect(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isImageDataUrl('data:text/html;base64,PGgxPg==')).toBe(false);
    expect(isImageDataUrl('https://example.com/a.png')).toBe(false);
    expect(isImageDataUrl(null)).toBe(false);
    expect(isImageDataUrl(undefined)).toBe(false);
    expect(isImageDataUrl(123)).toBe(false);
    expect(isImageDataUrl({})).toBe(false);
    expect(isImageDataUrl('data:image/png;base64,')).toBe(false);
  });
});

describe('estimateBase64Size', () => {
  it('calculates size from base64 string with padding', () => {
    // 'iVBORw0KGgo=' -> 12 chars, 1 '=' padding -> 9 - 1 = 8 bytes
    expect(estimateBase64Size('data:image/png;base64,iVBORw0KGgo=')).toBe(8);
    // 'PGgxPg==' -> 8 chars, 2 '=' padding -> 6 - 2 = 4 bytes
    expect(estimateBase64Size('data:text/plain;base64,PGgxPg==')).toBe(4);
  });

  it('returns 0 when no comma is present', () => {
    expect(estimateBase64Size('invalid')).toBe(0);
  });
});

describe('exportFilename', () => {
  it('formats filename with host and yyyy-mm-dd date', () => {
    const d = new Date('2026-11-10T12:00:00Z');
    expect(exportFilename('localhost:3000', d)).toBe('pixel-veil-localhost-3000-2026-11-10.json');
    expect(exportFilename('http://localhost:5173', d)).toBe('pixel-veil-localhost-5173-2026-11-10.json');
    expect(exportFilename('https://example.com', d)).toBe('pixel-veil-example.com-2026-11-10.json');
  });

  it('falls back to site when empty', () => {
    const d = new Date('2026-11-10T12:00:00Z');
    expect(exportFilename('', d)).toBe('pixel-veil-site-2026-11-10.json');
  });
});

describe('buildExport and parseImport edge cases', () => {
  it('filters out images not referenced by any layer', () => {
    let s = emptySiteState();
    s = addLayer(s, { id: 'L1', name: 'layer1', imageId: 'I1', naturalWidth: 10, naturalHeight: 10 });
    const images = {
      I1: 'data:image/png;base64,iVBORw0KGgo=',
      I_UNREFERENCED: 'data:image/png;base64,iVBORw0KGgo=',
    };
    const exported = buildExport('http://test.local', s, images, new Date('2026-11-10T00:00:00Z'));
    expect(exported.images).toEqual({ I1: images.I1 });
    expect(exported.images.I_UNREFERENCED).toBeUndefined();
  });

  it('parseImport rejects non-objects and invalid shapes', () => {
    expect(parseImport(null)).toEqual({ error: 'Expected an object.' });
    expect(parseImport([1, 2, 3])).toEqual({ error: 'Expected an object.' });
    expect(parseImport({ format: EXPORT_FORMAT, version: 1, layers: 'not an array', images: {} })).toHaveProperty('error');
    expect(parseImport({ format: EXPORT_FORMAT, version: 1, layers: [], images: {} })).toHaveProperty('error');
  });
});
