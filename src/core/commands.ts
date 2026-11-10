import { setAllHidden, setBlend, updateLayer } from './state';
import type { SiteState } from './types';

export const COMMANDS = [
  'toggle-hide-all',
  'opacity-up',
  'opacity-down',
  'toggle-difference',
] as const;

export type CommandName = (typeof COMMANDS)[number];

export function applyCommand(s: SiteState, name: CommandName): SiteState {
  switch (name) {
    case 'opacity-up':
    case 'opacity-down': {
      if (!s.activeLayerId) {
        return s;
      }
      const layer = s.layers.find((l) => l.id === s.activeLayerId);
      if (!layer) {
        return s;
      }
      const delta = name === 'opacity-up' ? 0.1 : -0.1;
      const raw = Math.round((layer.opacity + delta) * 100) / 100;
      const clamped = Math.min(1, Math.max(0, raw));
      const nextOpacity = Object.is(clamped, -0) ? 0 : clamped;
      return updateLayer(s, layer.id, { opacity: nextOpacity });
    }
    case 'toggle-hide-all': {
      if (s.layers.length === 0) {
        return s;
      }
      return setAllHidden(s, !s.allHidden);
    }
    case 'toggle-difference': {
      return setBlend(s, s.blend === 'difference' ? 'normal' : 'difference');
    }
    default:
      return s;
  }
}
