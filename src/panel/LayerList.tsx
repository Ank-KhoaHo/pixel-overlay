import React, { useEffect, useRef, useState } from 'react';
import { inFilter } from '../core/state';
import type { Layer, LayerPatch } from '../core/types';

export interface LayerListProps {
  layers: Layer[];
  activeLayerId: string | null;
  images: Map<string, string>;
  filter?: string;
  groups?: string[];
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: LayerPatch) => void;
  onMoveLayer: (id: string, dir: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
  onSetFilter?: (filter: string) => void;
}

function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#57606a"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 8s2.5-5 6.5-5 6.5 5 6.5 5-2.5 5-6.5 5-6.5-5-6.5-5z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#57606a"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 2l12 12" />
      <path d="M6.7 6.7a2.5 2.5 0 0 0 3.5 3.5" />
      <path d="M4.1 4.1C2.7 5.2 1.5 8 1.5 8s2.5 5 6.5 5c1.6 0 3-.6 4.1-1.5" />
      <path d="M9.8 3.5c-.6-.3-1.2-.5-1.8-.5-4 0-6.5 5-6.5 5" />
    </svg>
  );
}

export function LayerList({
  layers,
  activeLayerId,
  images,
  filter = '',
  groups = [],
  onSelectLayer,
  onUpdateLayer,
  onMoveLayer,
  onDeleteLayer,
  onSetFilter,
}: LayerListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const returnFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (returnFocusIdRef.current && editingId === null) {
      const id = returnFocusIdRef.current;
      const btn = nameButtonRefs.current.get(id);
      if (btn) {
        btn.focus();
        returnFocusIdRef.current = null;
      }
    }
  });

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  if (layers.length === 0) {
    return <div className="empty-hint">Drop a design image here, or click Add image.</div>;
  }

  // Top layer FIRST (reverse of state.layers)
  const shownLayers = layers.filter((l) => inFilter({ filter }, l));
  // A saved filter whose group has gone must still be listed, or it could never be cleared.
  const filterOptions = filter !== '' && !groups.includes(filter) ? [...groups, filter].sort() : groups;
  const reversed = [...shownLayers].reverse();

  const handleStartRename = (layer: Layer) => {
    setEditingId(layer.id);
    setDraftName(layer.name);
  };

  const handleCommitRename = (id: string) => {
    if (editingId !== id) return;
    setEditingId(null);
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      onUpdateLayer(id, { name: trimmed });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    if (armedDeleteId === layerId) {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
      setArmedDeleteId(null);
      onDeleteLayer(layerId);
    } else {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      setArmedDeleteId(layerId);
      deleteTimerRef.current = setTimeout(() => {
        setArmedDeleteId(null);
        deleteTimerRef.current = null;
      }, 3000);
    }
  };

  return (
    <div className="panel-layers-container">
      {filterOptions.length > 0 && (
        <div className="panel-filter-row">
          <select
            data-po="group-filter"
            aria-label="Show group"
            className="group-filter-select"
            value={filter}
            onChange={(e) => onSetFilter?.(e.target.value)}
          >
            <option value="">All layers</option>
            {filterOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="panel-layer-list">
      {reversed.map((layer) => {
        const isActive = layer.id === activeLayerId;
        const isEditing = editingId === layer.id;
        const isArmed = armedDeleteId === layer.id;
        const thumbSrc = images.get(layer.imageId);

        return (
          <div
            key={layer.id}
            data-po="layer-row"
            className={isActive ? 'layer-row active' : 'layer-row'}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, input')) {
                return;
              }
              onSelectLayer(layer.id);
            }}
          >
            <div className="layer-thumb-container">
              {thumbSrc ? (
                <img src={thumbSrc} className="layer-thumb" alt="" />
              ) : (
                <div className="layer-thumb" />
              )}
            </div>

            {isEditing ? (
              <input
                type="text"
                className="layer-rename-input"
                aria-label="Layer name"
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    returnFocusIdRef.current = layer.id;
                    handleCommitRename(layer.id);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    returnFocusIdRef.current = layer.id;
                    setEditingId(null);
                  }
                }}
                onBlur={() => handleCommitRename(layer.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                ref={(el) => {
                  if (el) {
                    nameButtonRefs.current.set(layer.id, el);
                  } else {
                    nameButtonRefs.current.delete(layer.id);
                  }
                }}
                data-po="layer-name"
                className="layer-name"
                title={layer.name}
                aria-current={isActive ? 'true' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLayer(layer.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(layer);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'F2') {
                    e.preventDefault();
                    handleStartRename(layer);
                  }
                }}
              >
                {layer.name}
              </button>
            )}

            <button
              type="button"
              data-po="eye"
              className="layer-row-btn"
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayer(layer.id, { visible: !layer.visible });
              }}
            >
              {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
            </button>

            <button
              type="button"
              data-po="up"
              className="layer-row-btn"
              aria-label={`Move ${layer.name} up`}
              title="Move layer up"
              onClick={(e) => {
                e.stopPropagation();
                onMoveLayer(layer.id, 'up');
              }}
            >
              ↑
            </button>

            <button
              type="button"
              data-po="down"
              className="layer-row-btn"
              aria-label={`Move ${layer.name} down`}
              title="Move layer down"
              onClick={(e) => {
                e.stopPropagation();
                onMoveLayer(layer.id, 'down');
              }}
            >
              ↓
            </button>

            <button
              type="button"
              data-po="delete"
              className={isArmed ? 'layer-row-btn armed-delete' : 'layer-row-btn'}
              aria-label={isArmed ? `Click again to delete ${layer.name}` : `Delete ${layer.name}`}
              title={isArmed ? 'Confirm delete' : 'Delete layer'}
              onClick={(e) => handleDeleteClick(e, layer.id)}
            >
              {isArmed ? 'Delete?' : '×'}
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
