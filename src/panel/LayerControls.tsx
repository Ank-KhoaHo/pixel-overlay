import React, { useEffect, useRef, useState } from 'react';
import { centerX, fitWidth } from '../core/align';
import { MAX_SCALE, MIN_SCALE, type Layer, type LayerPatch } from '../core/types';

export interface LayerControlsProps {
  layer: Layer | null;
  onUpdateLayer: (id: string, patch: LayerPatch) => void;
}

interface NumberInputProps {
  id?: string;
  'data-po': string;
  value: number;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  onCommit: (val: number) => void;
  format?: (val: number) => string;
  parse?: (draft: string) => number | null;
}

function NumberInput({
  id,
  'data-po': dataPo,
  value,
  min,
  max,
  step,
  className,
  onCommit,
  format = (v) => String(v),
  parse = (str) => {
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  },
}: NumberInputProps) {
  const [draft, setDraft] = useState(() => format(value));
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!isDirtyRef.current) {
      setDraft(format(value));
    }
  }, [value, format]);

  const commit = () => {
    if (!isDirtyRef.current) {
      return;
    }
    isDirtyRef.current = false;
    const parsed = parse(draft);
    if (parsed !== null) {
      let finalVal = parsed;
      if (min !== undefined) finalVal = Math.max(min, finalVal);
      if (max !== undefined) finalVal = Math.min(max, finalVal);
      onCommit(finalVal);
      setDraft(format(finalVal));
    } else {
      setDraft(format(value));
    }
  };

  return (
    <input
      id={id}
      type="number"
      data-po={dataPo}
      className={className}
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => {
        isDirtyRef.current = false;
      }}
      onChange={(e) => {
        isDirtyRef.current = true;
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          e.currentTarget.blur();
        }
      }}
      onBlur={commit}
    />
  );
}

export function LayerControls({ layer, onUpdateLayer }: LayerControlsProps) {
  if (!layer) {
    return null;
  }

  const opacityPercent = Math.round(layer.opacity * 100);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const clamped = Math.min(100, Math.max(0, val));
    onUpdateLayer(layer.id, { opacity: clamped / 100 });
  };

  const handleCenter = () => {
    const cw = document.documentElement.clientWidth;
    onUpdateLayer(layer.id, { x: centerX(layer, cw) });
  };

  const handleFitWidth = () => {
    const cw = document.documentElement.clientWidth;
    const { scale, x } = fitWidth(layer, cw);
    onUpdateLayer(layer.id, { scale, x });
  };

  return (
    <div className="panel-controls-section">
      <div className="control-row">
        <span className="control-label">Opacity</span>
        <NumberInput
          data-po="opacity"
          className="control-input-num"
          value={opacityPercent}
          min={0}
          max={100}
          step={1}
          onCommit={(v) => onUpdateLayer(layer.id, { opacity: v / 100 })}
        />
        <input
          type="range"
          data-po="opacity-slider"
          className="control-slider"
          min={0}
          max={100}
          value={opacityPercent}
          onChange={handleSliderChange}
        />
      </div>

      <div className="control-row">
        <span className="control-label">Pos</span>
        <div className="control-pos-group">
          <label htmlFor="po-control-x" className="control-pos-label">
            X
          </label>
          <NumberInput
            id="po-control-x"
            data-po="x"
            className="control-input-num"
            value={layer.x}
            parse={(s) => {
              const n = parseInt(s, 10);
              return Number.isFinite(n) ? n : null;
            }}
            onCommit={(v) => onUpdateLayer(layer.id, { x: v })}
          />
          <label htmlFor="po-control-y" className="control-pos-label">
            Y
          </label>
          <NumberInput
            id="po-control-y"
            data-po="y"
            className="control-input-num"
            value={layer.y}
            parse={(s) => {
              const n = parseInt(s, 10);
              return Number.isFinite(n) ? n : null;
            }}
            onCommit={(v) => onUpdateLayer(layer.id, { y: v })}
          />
        </div>
      </div>

      <div className="control-row">
        <span className="control-label">Scale</span>
        <NumberInput
          data-po="scale"
          className="control-input-num"
          value={layer.scale}
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.05}
          onCommit={(v) => onUpdateLayer(layer.id, { scale: v })}
        />
        <button
          type="button"
          data-po="half"
          onClick={() => onUpdateLayer(layer.id, { scale: 0.5 })}
        >
          ½ (for @2x)
        </button>
      </div>

      <div className="control-row">
        <span className="control-label">Align</span>
        <button
          type="button"
          data-po="center"
          disabled={layer.locked}
          onClick={handleCenter}
        >
          Center
        </button>
        <button
          type="button"
          data-po="fit-width"
          disabled={layer.locked}
          onClick={handleFitWidth}
        >
          Fit width
        </button>
      </div>

      <div className="control-row">
        <span className="control-label">Lock</span>
        <button
          type="button"
          data-po="lock"
          aria-pressed={layer.locked ? 'true' : 'false'}
          onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
        >
          {layer.locked ? 'Locked' : 'Unlocked'}
        </button>
      </div>

      <div className="control-row">
        <span className="control-label">Pin</span>
        <button
          type="button"
          data-po="fixed"
          aria-pressed={layer.fixed ? 'true' : 'false'}
          onClick={() => onUpdateLayer(layer.id, { fixed: !layer.fixed })}
        >
          Fixed to window
        </button>
      </div>
    </div>
  );
}
