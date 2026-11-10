import { isImageDataUrl } from './image';
import { parseImport } from './transfer';
import type { Blend, LayerPatch, NewLayer, SiteState } from './types';

export const SIDE_PORT = 'po-side';

export type PanelOp =
  | { op: 'add'; newLayer: NewLayer; dataUrl: string }
  | { op: 'select'; id: string }
  | { op: 'update'; id: string; patch: LayerPatch }
  | { op: 'move'; id: string; dir: 'up' | 'down' }
  | { op: 'delete'; id: string }
  | { op: 'blend'; blend: Blend }
  | { op: 'invert'; on: boolean }
  | { op: 'hide-all'; on: boolean }
  | { op: 'align'; id: string; how: 'center' | 'fit-width' }
  | { op: 'import'; file: unknown };

export type SideUpdate = { type: 'state'; site: string; state: SiteState };

const BLENDS: readonly Blend[] = ['normal', 'difference', 'multiply', 'screen'];

const ALLOWED_PATCH_KEYS = new Set([
  'name',
  'x',
  'y',
  'opacity',
  'scale',
  'visible',
  'locked',
  'fixed',
]);

function isNewLayer(x: unknown): x is NewLayer {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) {
    return false;
  }
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.imageId === 'string' &&
    typeof o.naturalWidth === 'number' &&
    Number.isFinite(o.naturalWidth) &&
    o.naturalWidth > 0 &&
    typeof o.naturalHeight === 'number' &&
    Number.isFinite(o.naturalHeight) &&
    o.naturalHeight > 0
  );
}

function isLayerPatch(x: unknown): x is LayerPatch {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) {
    return false;
  }
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!ALLOWED_PATCH_KEYS.has(k)) {
      return false;
    }
  }
  if ('name' in o && typeof o.name !== 'string') return false;
  if ('x' in o && (typeof o.x !== 'number' || !Number.isFinite(o.x))) return false;
  if ('y' in o && (typeof o.y !== 'number' || !Number.isFinite(o.y))) return false;
  if ('opacity' in o && (typeof o.opacity !== 'number' || !Number.isFinite(o.opacity))) return false;
  if ('scale' in o && (typeof o.scale !== 'number' || !Number.isFinite(o.scale))) return false;
  if ('visible' in o && typeof o.visible !== 'boolean') return false;
  if ('locked' in o && typeof o.locked !== 'boolean') return false;
  if ('fixed' in o && typeof o.fixed !== 'boolean') return false;
  return true;
}

export function isPanelOp(x: unknown): x is PanelOp {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) {
    return false;
  }
  const o = x as Record<string, unknown>;
  switch (o.op) {
    case 'add':
      return (
        isNewLayer(o.newLayer) &&
        typeof o.dataUrl === 'string' &&
        isImageDataUrl(o.dataUrl)
      );
    case 'select':
      return typeof o.id === 'string';
    case 'update':
      return typeof o.id === 'string' && isLayerPatch(o.patch);
    case 'move':
      return (
        typeof o.id === 'string' &&
        (o.dir === 'up' || o.dir === 'down')
      );
    case 'delete':
      return typeof o.id === 'string';
    case 'blend':
      return (
        typeof o.blend === 'string' &&
        (BLENDS as readonly string[]).includes(o.blend as Blend)
      );
    case 'invert':
      return typeof o.on === 'boolean';
    case 'hide-all':
      return typeof o.on === 'boolean';
    case 'align':
      return (
        typeof o.id === 'string' &&
        (o.how === 'center' || o.how === 'fit-width')
      );
    case 'import': {
      if (!('file' in o)) return false;
      const res = parseImport(o.file);
      return !('error' in res);
    }
    default:
      return false;
  }
}
