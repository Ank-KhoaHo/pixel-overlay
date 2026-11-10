export interface Layer {
  id: string;
  name: string;
  imageId: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  visible: boolean;
  locked: boolean;
}

export type Blend = 'normal' | 'difference' | 'multiply' | 'screen';

export interface SiteState {
  schemaVersion: 1;
  layers: Layer[];
  activeLayerId: string | null;
  blend: Blend;
  invert: boolean;
  shown: boolean;
  allHidden: boolean;
  panel: { x: number; y: number; collapsed: boolean };
}

export type LayerPatch = Partial<
  Pick<Layer, 'name' | 'x' | 'y' | 'opacity' | 'scale' | 'visible' | 'locked'>
>;

export interface NewLayer {
  id: string;
  name: string;
  imageId: string;
  naturalWidth: number;
  naturalHeight: number;
}

export const DEFAULT_OPACITY = 0.5;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const NUDGE_STEP = 1;
export const NUDGE_STEP_SHIFT = 10;
export const SITE_KEY_PREFIX = 'po.site.';
export const IMAGE_KEY_PREFIX = 'po.img.';
export const KEPT_KEY = 'po.kept';
export const PANEL_DEFAULT: SiteState['panel'] = { x: -1, y: 16, collapsed: false };

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export const HOST_LAYERS_TAG = 'pixel-overlay-layers';
export const HOST_PANEL_TAG = 'pixel-overlay-panel';
export const Z_INDEX_LAYERS = 2147483646;
export const Z_INDEX_PANEL = 2147483647;
export const CONTENT_SCRIPT_REGISTRATION_ID = 'po-kept';
