import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './types';

export function checkImageFile(f: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; reason: string } {
  if (f.size <= 0) {
    return { ok: false, reason: 'File is empty.' };
  }
  if (f.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'File exceeds maximum size of 25 MB.' };
  }
  if (f.type === 'image/svg+xml') {
    return { ok: false, reason: 'SVG images are not supported.' };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(f.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, reason: 'Unsupported file type. Use PNG, JPEG, WebP, or GIF.' };
  }
  return { ok: true };
}

export function layerNameFromFile(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const base = lastDot === -1 ? fileName : fileName.slice(0, lastDot);
  const trimmed = base.trim();
  return trimmed.length > 0 ? trimmed : 'Layer';
}

const DATA_URL_RE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function isImageDataUrl(s: unknown): s is string {
  return typeof s === 'string' && DATA_URL_RE.test(s);
}

