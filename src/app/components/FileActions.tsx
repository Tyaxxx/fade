import { useRef, useState } from 'react';
import { encodeSeedCode, serializeSettings, type FadeParams } from '../../core/index';
import { readSettingsFile } from '../lib/settingsFile';
import { ExportIcon, ImportIcon } from './icons';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Header icon group: import a settings file, or export the current settings as JSON.
 * Its messages sit on their own line under the header; both live regions are
 * always mounted (empty when idle) so the first message is announced.
 */
export function FileActions({ params, onImport }: { params: FadeParams; onImport: (p: FadeParams) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await readSettingsFile(file);
    if (result.ok) {
      onImport(result.params);
      setMessage({ text: `Imported ${file.name}.`, error: false });
    } else {
      setMessage({ text: result.error, error: true });
    }
    if (input.current) input.current.value = '';
  };

  return (
    <>
      <div className="head-group file-buttons" role="group" aria-label="Settings file">
        <button type="button" className="icon-btn has-tip" aria-label="Import settings" data-tip="Import settings" data-tip-align="end" onClick={() => input.current?.click()}>
          <ImportIcon />
        </button>
        <button
          type="button"
          className="icon-btn has-tip"
          aria-label="Export settings"
          data-tip="Export settings"
          data-tip-align="end"
          onClick={() => downloadBlob(new Blob([serializeSettings(params)], { type: 'application/json' }), `fade-${encodeSeedCode(params.seeds)}.json`)}
        >
          <ExportIcon />
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Import settings file"
          onChange={(e) => void onFile(e.currentTarget.files?.[0])}
        />
      </div>
      <div className="head-messages">
        <p className="note" role="status">
          {message && !message.error ? message.text : null}
        </p>
        <p className="note error" role="alert">
          {message?.error ? message.text : null}
        </p>
      </div>
    </>
  );
}
