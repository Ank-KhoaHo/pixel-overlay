// Claude's review tests for ticket A10 (controls in Chrome's side panel). agy: never edit this file.
// The side panel sends operations over a port; the content script runs only what isPanelOp accepts.
import { describe, expect, it } from 'vitest';
import { isPanelOp, SIDE_PORT } from './remote';
import { EXPORT_FORMAT } from './transfer';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const NEW = { id: 'L9', name: 'home', imageId: 'I9', naturalWidth: 200, naturalHeight: 100 };
const LAYER = { ...NEW, x: 0, y: 0, opacity: 0.5, scale: 1, visible: true, locked: false, fixed: false };
const FILE = { format: EXPORT_FORMAT, version: 1, site: 'https://a.test', exportedAt: '', layers: [LAYER], images: { I9: PNG } };

describe('isPanelOp accepts every operation the page panel can do', () => {
  it.each([
    ['add', { op: 'add', newLayer: NEW, dataUrl: PNG }],
    ['select', { op: 'select', id: 'L1' }],
    ['update', { op: 'update', id: 'L1', patch: { opacity: 0.3, x: 10, name: 'a', visible: false } }],
    ['update fixed and locked', { op: 'update', id: 'L1', patch: { fixed: true, locked: true, scale: 2, y: -4 } }],
    ['move up', { op: 'move', id: 'L1', dir: 'up' }],
    ['move down', { op: 'move', id: 'L1', dir: 'down' }],
    ['delete', { op: 'delete', id: 'L1' }],
    ['blend', { op: 'blend', blend: 'multiply' }],
    ['invert', { op: 'invert', on: true }],
    ['hide-all', { op: 'hide-all', on: false }],
    ['center', { op: 'align', id: 'L1', how: 'center' }],
    ['fit width', { op: 'align', id: 'L1', how: 'fit-width' }],
    ['import of a valid export file', { op: 'import', file: FILE }],
  ])('%s', (_label, op) => {
    expect(isPanelOp(op)).toBe(true);
  });
});

describe('isPanelOp refuses anything else', () => {
  it.each([
    ['null', null],
    ['a string', 'delete'],
    ['an unknown op', { op: 'wipe-all' }],
    ['select without an id', { op: 'select' }],
    ['a number id', { op: 'delete', id: 3 }],
    ['a bad move direction', { op: 'move', id: 'L1', dir: 'left' }],
    ['an unknown blend', { op: 'blend', blend: 'overlay' }],
    ['invert without a boolean', { op: 'invert', on: 'yes' }],
    ['an unknown align', { op: 'align', id: 'L1', how: 'right' }],
    ['add with an SVG', { op: 'add', newLayer: NEW, dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }],
    ['add with a web URL', { op: 'add', newLayer: NEW, dataUrl: 'https://example.com/a.png' }],
    ['add with no size', { op: 'add', newLayer: { ...NEW, naturalWidth: 0 }, dataUrl: PNG }],
    ['add with no id', { op: 'add', newLayer: { ...NEW, id: undefined }, dataUrl: PNG }],
    ['update with an unknown field', { op: 'update', id: 'L1', patch: { imageId: 'other' } }],
    ['update with a text opacity', { op: 'update', id: 'L1', patch: { opacity: '0.5' } }],
    ['update with an endless x', { op: 'update', id: 'L1', patch: { x: Infinity } }],
    ['update with no patch', { op: 'update', id: 'L1' }],
    ['import with no file', { op: 'import' }],
    ['import of a file parseImport refuses', { op: 'import', file: { ...FILE, images: { I9: 'data:image/svg+xml;base64,PHN2Zz4=' } } }],
  ])('%s', (_label, op) => {
    expect(isPanelOp(op)).toBe(false);
  });
});

it('names its port', () => {
  expect(SIDE_PORT).toBe('po-side');
});
