import React, { useRef } from 'react';
import { checkImageFile, layerNameFromFile } from '../core/image';
import { parseImport } from '../core/transfer';
import type { Layer, NewLayer } from '../core/types';
import { newId } from '../shared/ids';

export interface AddImageProps {
  error: string;
  hasLayers: boolean;
  onError: (err: string) => void;
  onClearError: () => void;
  onAddLayer: (newLayer: NewLayer, dataUrl: string) => Promise<void>;
  onExport: () => void;
  onImportLayers: (imported: { layers: Layer[]; images: Record<string, string> }) => Promise<void>;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error.'));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error.'));
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl: string): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    };
    img.onerror = () => reject(new Error('Failed to decode image.'));
    img.src = dataUrl;
  });
}

export async function processFiles(
  files: File[],
  onClearError: () => void,
  onError: (err: string) => void,
  onAddLayer: (newLayer: NewLayer, dataUrl: string) => Promise<void>,
) {
  onClearError();
  for (const file of files) {
    const check = checkImageFile({ type: file.type, size: file.size });
    if (!check.ok) {
      onError(check.reason);
      continue;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { naturalWidth, naturalHeight } = await decodeImage(dataUrl);
      const imgId = newId();
      const layerId = newId();
      const name = layerNameFromFile(file.name);

      await onAddLayer(
        {
          id: layerId,
          name,
          imageId: imgId,
          naturalWidth,
          naturalHeight,
        },
        dataUrl,
      );
    } catch (err) {
      console.warn('[pixel-overlay]', err);
      const msg = err instanceof Error ? err.message : String(err);
      onError(`Could not save: ${msg}`);
    }
  }
}

export function AddImage({
  error,
  hasLayers,
  onError,
  onClearError,
  onAddLayer,
  onExport,
  onImportLayers,
}: AddImageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      void processFiles(Array.from(fileList), onClearError, onError, onAddLayer);
    }
    e.target.value = '';
  };

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    onClearError();
    void (async () => {
      try {
        const text = await readFileAsText(file);
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          onError('Invalid JSON file.');
          return;
        }
        const parsed = parseImport(raw);
        if ('error' in parsed) {
          onError(parsed.error);
          return;
        }
        await onImportLayers(parsed);
      } catch (err) {
        console.warn('[pixel-overlay]', err);
        const msg = err instanceof Error ? err.message : String(err);
        onError(`Could not save: ${msg}`);
      }
    })();
  };

  return (
    <div className="panel-add-section">
      <div className="panel-add-row">
        <button
          type="button"
          data-po="add"
          className="panel-add-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Add image
        </button>
        <button
          type="button"
          data-po="export"
          className="panel-transfer-btn"
          disabled={!hasLayers}
          onClick={onExport}
        >
          Export
        </button>
        <button
          type="button"
          data-po="import"
          className="panel-transfer-btn"
          onClick={() => importInputRef.current?.click()}
        >
          Import
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportChange}
      />
      {error ? (
        <div data-po="error" className="panel-error">
          {error}
        </div>
      ) : null}
    </div>
  );
}
