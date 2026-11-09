import { NUDGE_STEP, NUDGE_STEP_SHIFT } from './types';

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  inEditable: boolean;
}

export function keyToNudge(k: KeyInput): { dx: number; dy: number } | null {
  if (k.inEditable) {
    return null;
  }
  if (k.altKey || k.ctrlKey || k.metaKey) {
    return null;
  }

  const step = k.shiftKey ? NUDGE_STEP_SHIFT : NUDGE_STEP;

  switch (k.key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return null;
  }
}
