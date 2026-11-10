import { MAX_SCALE, MIN_SCALE } from './types';

export const SNAP_PX = 8;

export function centerX(
  l: { naturalWidth: number; scale: number },
  pageWidth: number,
): number {
  return Math.round((pageWidth - l.naturalWidth * l.scale) / 2);
}

export function fitWidth(
  l: { naturalWidth: number },
  pageWidth: number,
): { scale: number; x: 0 } {
  const rawScale = pageWidth / l.naturalWidth;
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
  const scale = Math.round(clamped * 10000) / 10000;
  return { scale, x: 0 };
}

export function snap(
  p: { x: number; y: number; w: number },
  pageWidth: number,
): { x: number; y: number } {
  let x = p.x;
  let y = p.y;

  if (Math.abs(p.x) <= SNAP_PX) {
    x = 0;
  } else if (Math.abs(p.x + p.w - pageWidth) <= SNAP_PX) {
    x = Math.round(pageWidth - p.w);
  }

  if (Math.abs(p.y) <= SNAP_PX) {
    y = 0;
  }

  return { x, y };
}
