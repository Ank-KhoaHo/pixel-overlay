import {
  DEFAULT_OPACITY,
  MAX_SCALE,
  MIN_SCALE,
  PANEL_DEFAULT,
  type Blend,
  type Layer,
  type LayerPatch,
  type NewLayer,
  type SiteState,
} from './types';

export function emptySiteState(): SiteState {
  return {
    schemaVersion: 1,
    layers: [],
    activeLayerId: null,
    blend: 'normal',
    invert: false,
    shown: true,
    allHidden: false,
    panel: { ...PANEL_DEFAULT },
  };
}

export function isLayer(x: unknown): x is Layer {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    typeof l.imageId === 'string' &&
    typeof l.naturalWidth === 'number' &&
    Number.isFinite(l.naturalWidth) &&
    typeof l.naturalHeight === 'number' &&
    Number.isFinite(l.naturalHeight) &&
    typeof l.x === 'number' &&
    Number.isFinite(l.x) &&
    typeof l.y === 'number' &&
    Number.isFinite(l.y) &&
    typeof l.opacity === 'number' &&
    Number.isFinite(l.opacity) &&
    l.opacity >= 0 &&
    l.opacity <= 1 &&
    typeof l.scale === 'number' &&
    Number.isFinite(l.scale) &&
    l.scale > 0 &&
    typeof l.visible === 'boolean' &&
    typeof l.locked === 'boolean'
  );
}

export function parseSiteState(raw: unknown): SiteState | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const s = raw as Record<string, unknown>;
  if (s.schemaVersion !== 1) {
    return null;
  }
  let blend: Blend = 'normal';
  if (
    s.blend === 'normal' ||
    s.blend === 'difference' ||
    s.blend === 'multiply' ||
    s.blend === 'screen'
  ) {
    blend = s.blend;
  }
  let invert = false;
  if (typeof s.invert === 'boolean') {
    invert = s.invert;
  }
  if (typeof s.shown !== 'boolean') {
    return null;
  }
  if (typeof s.panel !== 'object' || s.panel === null || Array.isArray(s.panel)) {
    return null;
  }
  const p = s.panel as Record<string, unknown>;
  if (
    typeof p.x !== 'number' ||
    !Number.isFinite(p.x) ||
    typeof p.y !== 'number' ||
    !Number.isFinite(p.y) ||
    typeof p.collapsed !== 'boolean'
  ) {
    return null;
  }
  if (!Array.isArray(s.layers)) {
    return null;
  }
  for (const layer of s.layers) {
    if (!isLayer(layer)) {
      return null;
    }
  }

  const validLayers = s.layers as Layer[];

  let allHidden = false;
  if ('allHidden' in s && s.allHidden !== undefined) {
    if (typeof s.allHidden !== 'boolean') {
      return null;
    }
    allHidden = s.allHidden;
  }

  if (s.activeLayerId !== null) {
    if (
      typeof s.activeLayerId !== 'string' ||
      !validLayers.some((l) => l.id === s.activeLayerId)
    ) {
      return null;
    }
  }

  return {
    schemaVersion: 1,
    layers: validLayers.map((l) => ({
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
    })),
    activeLayerId: s.activeLayerId,
    blend,
    invert,
    shown: s.shown,
    allHidden,
    panel: {
      x: p.x,
      y: p.y,
      collapsed: p.collapsed,
    },
  };
}

export function addLayer(s: SiteState, l: NewLayer): SiteState {
  const newLayer: Layer = {
    id: l.id,
    name: l.name,
    imageId: l.imageId,
    naturalWidth: l.naturalWidth,
    naturalHeight: l.naturalHeight,
    x: 0,
    y: 0,
    opacity: DEFAULT_OPACITY,
    scale: 1,
    visible: true,
    locked: false,
    fixed: false,
  };
  return {
    ...s,
    layers: [...s.layers, newLayer],
    activeLayerId: l.id,
  };
}

export function removeLayer(
  s: SiteState,
  id: string,
): { state: SiteState; removedImageId: string | null } {
  const index = s.layers.findIndex((l) => l.id === id);
  if (index === -1) {
    return { state: s, removedImageId: null };
  }

  const removedLayer = s.layers[index];
  if (!removedLayer) {
    return { state: s, removedImageId: null };
  }

  const newLayers = s.layers.filter((l) => l.id !== id);

  let newActiveLayerId = s.activeLayerId;
  if (s.activeLayerId === id) {
    const top = newLayers[newLayers.length - 1];
    newActiveLayerId = top ? top.id : null;
  }

  return {
    state: {
      ...s,
      layers: newLayers,
      activeLayerId: newActiveLayerId,
    },
    removedImageId: removedLayer.imageId,
  };
}

export function selectLayer(s: SiteState, id: string | null): SiteState {
  if (s.activeLayerId === id) {
    return s;
  }
  if (id === null) {
    return { ...s, activeLayerId: null };
  }
  const exists = s.layers.some((l) => l.id === id);
  if (!exists) {
    return s;
  }
  return { ...s, activeLayerId: id };
}

export function updateLayer(s: SiteState, id: string, patch: LayerPatch): SiteState {
  const layer = s.layers.find((l) => l.id === id);
  if (!layer) {
    return s;
  }

  let nextOpacity = layer.opacity;
  if (
    patch.opacity !== undefined &&
    typeof patch.opacity === 'number' &&
    Number.isFinite(patch.opacity)
  ) {
    nextOpacity = Math.min(1, Math.max(0, patch.opacity));
  }

  let nextScale = layer.scale;
  if (
    patch.scale !== undefined &&
    typeof patch.scale === 'number' &&
    Number.isFinite(patch.scale)
  ) {
    nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, patch.scale));
  }

  let nextX = layer.x;
  if (
    patch.x !== undefined &&
    typeof patch.x === 'number' &&
    Number.isFinite(patch.x)
  ) {
    nextX = Math.round(patch.x);
    if (Object.is(nextX, -0)) nextX = 0;
  }

  let nextY = layer.y;
  if (
    patch.y !== undefined &&
    typeof patch.y === 'number' &&
    Number.isFinite(patch.y)
  ) {
    nextY = Math.round(patch.y);
    if (Object.is(nextY, -0)) nextY = 0;
  }

  let nextName = layer.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length > 0) {
      nextName = trimmed;
    }
  }

  let nextVisible = layer.visible;
  if (patch.visible !== undefined) {
    nextVisible = Boolean(patch.visible);
  }

  let nextLocked = layer.locked;
  if (patch.locked !== undefined) {
    nextLocked = Boolean(patch.locked);
  }

  let nextFixed = layer.fixed;
  if (patch.fixed !== undefined) {
    nextFixed = Boolean(patch.fixed);
  }

  if (
    nextOpacity === layer.opacity &&
    nextScale === layer.scale &&
    nextX === layer.x &&
    nextY === layer.y &&
    nextName === layer.name &&
    nextVisible === layer.visible &&
    nextLocked === layer.locked &&
    nextFixed === layer.fixed
  ) {
    return s;
  }

  const updatedLayer: Layer = {
    ...layer,
    opacity: nextOpacity,
    scale: nextScale,
    x: nextX,
    y: nextY,
    name: nextName,
    visible: nextVisible,
    locked: nextLocked,
    fixed: nextFixed,
  };

  return {
    ...s,
    layers: s.layers.map((l) => (l.id === id ? updatedLayer : l)),
  };
}

export function nudge(s: SiteState, dx: number, dy: number): SiteState {
  if (s.allHidden || s.activeLayerId === null) {
    return s;
  }
  const activeLayer = s.layers.find((l) => l.id === s.activeLayerId);
  if (!activeLayer || activeLayer.locked || !activeLayer.visible) {
    return s;
  }
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    return s;
  }
  return updateLayer(s, activeLayer.id, {
    x: activeLayer.x + dx,
    y: activeLayer.y + dy,
  });
}

export function moveLayer(s: SiteState, id: string, dir: 'up' | 'down'): SiteState {
  const index = s.layers.findIndex((l) => l.id === id);
  if (index === -1) {
    return s;
  }
  const targetIndex = dir === 'up' ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= s.layers.length) {
    return s;
  }

  const current = s.layers[index];
  const target = s.layers[targetIndex];
  if (!current || !target) {
    return s;
  }

  const newLayers = [...s.layers];
  newLayers[index] = target;
  newLayers[targetIndex] = current;

  return {
    ...s,
    layers: newLayers,
  };
}

export function setBlend(s: SiteState, blend: Blend): SiteState {
  if (s.blend === blend) {
    return s;
  }
  return {
    ...s,
    blend,
  };
}

export function setInvert(s: SiteState, on: boolean): SiteState {
  if (s.invert === on) {
    return s;
  }
  return {
    ...s,
    invert: on,
  };
}

export function setShown(s: SiteState, shown: boolean): SiteState {
  if (s.shown === shown) {
    return s;
  }
  return {
    ...s,
    shown,
  };
}

export function setPanel(s: SiteState, p: Partial<SiteState['panel']>): SiteState {
  let nextX = s.panel.x;
  let nextY = s.panel.y;
  let nextCollapsed = s.panel.collapsed;

  if (p.x !== undefined && typeof p.x === 'number' && Number.isFinite(p.x)) {
    nextX = Math.round(p.x);
    if (Object.is(nextX, -0)) nextX = 0;
  }
  if (p.y !== undefined && typeof p.y === 'number' && Number.isFinite(p.y)) {
    nextY = Math.round(p.y);
    if (Object.is(nextY, -0)) nextY = 0;
  }
  if (p.collapsed !== undefined && typeof p.collapsed === 'boolean') {
    nextCollapsed = p.collapsed;
  }

  if (
    nextX === s.panel.x &&
    nextY === s.panel.y &&
    nextCollapsed === s.panel.collapsed
  ) {
    return s;
  }

  return {
    ...s,
    panel: {
      x: nextX,
      y: nextY,
      collapsed: nextCollapsed,
    },
  };
}

export function setAllVisible(s: SiteState, visible: boolean): SiteState {
  if (s.layers.every((l) => l.visible === visible)) {
    return s;
  }
  return {
    ...s,
    layers: s.layers.map((l) => (l.visible === visible ? l : { ...l, visible })),
  };
}

export function setAllHidden(s: SiteState, hidden: boolean): SiteState {
  if (s.allHidden === hidden) {
    return s;
  }
  return {
    ...s,
    allHidden: hidden,
  };
}
