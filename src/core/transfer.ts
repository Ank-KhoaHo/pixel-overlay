import { isImageDataUrl } from './image';
import { isLayer } from './state';
import { MAX_IMAGE_BYTES, type Layer, type SiteState } from './types';

export const EXPORT_FORMAT = 'pixel-veil-site';

export interface SiteExport {
  format: typeof EXPORT_FORMAT;
  version: 1;
  site: string;
  exportedAt: string;
  layers: Layer[];
  images: Record<string, string>;
}

export function estimateBase64Size(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function exportFilename(host: string, now: Date = new Date()): string {
  let cleanHost = host;
  try {
    if (cleanHost.includes('://')) {
      cleanHost = new URL(cleanHost).host;
    }
  } catch {
    // keep cleanHost
  }
  const safeHost = (cleanHost || 'site').replace(/:/g, '-');
  const dateStr = now.toISOString().slice(0, 10);
  return `pixel-veil-${safeHost}-${dateStr}.json`;
}

export function buildExport(
  site: string,
  s: SiteState,
  images: Record<string, string>,
  now: Date,
): SiteExport {
  const layerImages: Record<string, string> = {};
  for (const layer of s.layers) {
    const img = images[layer.imageId];
    if (img !== undefined) {
      layerImages[layer.imageId] = img;
    }
  }
  return {
    format: EXPORT_FORMAT,
    version: 1,
    site,
    exportedAt: now.toISOString(),
    layers: s.layers,
    images: layerImages,
  };
}

export function parseImport(
  raw: unknown,
): { layers: Layer[]; images: Record<string, string> } | { error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'Expected an object.' };
  }
  const r = raw as Record<string, unknown>;

  if (r.format !== EXPORT_FORMAT) {
    return { error: `Invalid format: expected ${EXPORT_FORMAT}.` };
  }

  if (r.version !== 1) {
    return { error: 'Unsupported version: expected 1.' };
  }

  if (!Array.isArray(r.layers) || r.layers.length === 0) {
    return { error: 'File contains no layers.' };
  }

  if (typeof r.images !== 'object' || r.images === null || Array.isArray(r.images)) {
    return { error: 'Missing or invalid images.' };
  }

  for (const layer of r.layers) {
    if (!isLayer(layer)) {
      return { error: 'Invalid layer data.' };
    }
  }

  const rawImages = r.images as Record<string, unknown>;
  const validLayers = r.layers as Layer[];

  for (const layer of validLayers) {
    if (typeof rawImages[layer.imageId] !== 'string') {
      return { error: `Missing image for layer "${layer.name}".` };
    }
  }

  // Only the images the layers use: anything else in the file would be stored with no layer.
  const usedIds = [...new Set(validLayers.map((l) => l.imageId))];
  for (const imgId of usedIds) {
    const dataUrl = rawImages[imgId];
    if (!isImageDataUrl(dataUrl)) {
      return { error: `Invalid image data URL for image ${imgId}.` };
    }
    if (estimateBase64Size(dataUrl) > MAX_IMAGE_BYTES) {
      return { error: `Image ${imgId} exceeds maximum size of 25 MB.` };
    }
  }

  const layers: Layer[] = validLayers.map((l) => ({
    id: l.id,
    name: l.name,
    imageId: l.imageId,
    naturalWidth: l.naturalWidth,
    naturalHeight: l.naturalHeight,
    x: l.x,
    y: l.y,
    opacity: l.opacity,
    scale: l.scale,
    visible: l.visible,
    locked: l.locked,
    fixed:
      typeof (l as unknown as Record<string, unknown>).fixed === 'boolean'
        ? ((l as unknown as Record<string, unknown>).fixed as boolean)
        : false,
  }));

  const images: Record<string, string> = {};
  for (const imgId of usedIds) {
    images[imgId] = rawImages[imgId] as string;
  }

  return { layers, images };
}

export function appendImported(
  s: SiteState,
  r: { layers: Layer[]; images: Record<string, string> },
  newId: () => string,
): { state: SiteState; images: Record<string, string> } {
  const imageIdMap = new Map<string, string>();
  const newImages: Record<string, string> = {};

  for (const [oldId, dataUrl] of Object.entries(r.images)) {
    const nextImageId = newId();
    imageIdMap.set(oldId, nextImageId);
    newImages[nextImageId] = dataUrl;
  }

  const addedLayers: Layer[] = r.layers.map((l) => {
    let nextImageId = imageIdMap.get(l.imageId);
    if (!nextImageId) {
      nextImageId = newId();
      imageIdMap.set(l.imageId, nextImageId);
      const img = r.images[l.imageId];
      if (img !== undefined) {
        newImages[nextImageId] = img;
      }
    }
    return {
      ...l,
      id: newId(),
      imageId: nextImageId,
    };
  });

  const nextLayers = [...s.layers, ...addedLayers];
  const lastAdded = addedLayers[addedLayers.length - 1];
  const nextActiveLayerId = lastAdded ? lastAdded.id : s.activeLayerId;

  return {
    state: {
      ...s,
      layers: nextLayers,
      activeLayerId: nextActiveLayerId,
    },
    images: newImages,
  };
}
