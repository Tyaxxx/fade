import { useCallback, useEffect, useEffectEvent, useReducer, useState } from 'react';
import { DEFAULT_PARAMS, encodeSeedCode, type FadeParams } from '../core/index';
import { downloadBlob, FileActions } from './components/FileActions';
import { RandomizeButton } from './components/RandomizeButton';
import { PanelHeader, SettingsPanel } from './components/SettingsPanel';
import { Stage } from './components/Stage';
import { historyReducer, initHistory } from './lib/history';
import { randomizeLooks, unlockedLooks, type Look, type LookLocks } from './lib/randomize';
import { getSharedRenderer, type Renderer } from './render/renderer';

const NO_LOCKS: LookLocks = { colors: false, shape: false, texture: false };

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(target.type);
}

export function App({ renderer = getSharedRenderer() }: { renderer?: Renderer }) {
  const [history, dispatch] = useReducer(historyReducer, DEFAULT_PARAMS, initHistory);
  const [locks, setLocks] = useState<LookLocks>(NO_LOCKS);
  const [quality, setQuality] = useState(0.92);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const params = history.present;

  const onChange = useCallback((next: FadeParams, live?: boolean) => {
    dispatch(live ? { type: 'update', params: next } : { type: 'set', params: next });
  }, []);
  const onCommit = useCallback(() => dispatch({ type: 'commit' }), []);

  /** Re-roll the given looks as one undo step; nothing (no history entry) when there's nothing to change. */
  const reroll = (looks: readonly Look[]) => {
    const next = randomizeLooks(params, looks);
    if (next !== params) dispatch({ type: 'set', params: next });
  };
  const randomizeAll = () => reroll(unlockedLooks(locks));
  // Reads the latest params/locks without re-binding the window listener (R9).
  const onRandomizeKey = useEffectEvent(randomizeAll);

  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await renderer.exportJpeg(params, quality);
      downloadBlob(blob, `fade-${encodeSeedCode(params.seeds)}-${params.width}x${params.height}.jpg`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !isTextInput(e.target)) {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'y' && !isTextInput(e.target)) {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (!mod && !e.altKey && key === 'r' && !isTextInput(e.target)) {
        e.preventDefault();
        onRandomizeKey();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const section = { params, onChange, onCommit };
  const historyControls = {
    canUndo: history.past.length > 0 || history.draftBase !== history.present,
    canRedo: history.future.length > 0,
    onUndo: () => dispatch({ type: 'undo' }),
    onRedo: () => dispatch({ type: 'redo' }),
  };

  return (
    <div className="app">
      <PanelHeader history={historyControls}>
        <FileActions params={params} onImport={(p) => dispatch({ type: 'set', params: p })} />
      </PanelHeader>
      <RandomizeButton locks={locks} onRandomize={randomizeAll} />
      <SettingsPanel
        section={section}
        locks={locks}
        onToggleLock={(look) => setLocks((l) => ({ ...l, [look]: !l[look] }))}
        onRandomizeLook={(look) => reroll([look])}
      />
      <Stage
        renderer={renderer}
        params={params}
        quality={quality}
        onQuality={setQuality}
        exporting={exporting}
        exportError={exportError}
        onDownload={download}
      />
    </div>
  );
}
