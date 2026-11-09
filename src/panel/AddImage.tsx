import React, { useRef } from 'react';
import { checkImageFile, layerNameFromFile } from '../core/image';
import type { NewLayer } from '../core/types';
import { newId } from '../shared/ids';

export interface AddImageProps {
  error: string;
  onError: (err: string) => void;
  onClearError: () => void;
  onAddLayer: (newLayer: NewLayer, dataUrl: string) => Promise<void>;
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

export function AddImage({ error, onError, onClearError, onAddLayer }: AddImageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      void processFiles(Array.from(fileList), onClearError, onError, onAddLayer);
    }
    e.target.value = '';
  };

  return (
    <div className="panel-add-section">
      <button
        type="button"
        data-po="add"
        className="panel-add-btn"
        onClick={() => fileInputRef.current?.click()}
      >
        Add image
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error ? (
        <div data-po="error" className="panel-error">
          {error}
        </div>
      ) : null}
    </div>
  );
}
