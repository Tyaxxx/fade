import { useState, type ReactNode } from 'react';
import type { Look, LookLocks } from '../lib/randomize';
import { ColorsSection } from './ColorsSection';
import { CollapseAllIcon, ExpandAllIcon, RedoIcon, UndoIcon } from './icons';
import { LookActions } from './LookActions';
import { FormatSection, ShapeSection, TextureSection } from './sections';
import { SeedSection } from './SeedSection';
import type { SectionProps } from './types';

export interface HistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Wordmark, undo/redo, then `children` (the settings-file actions). Rendered by
 * App outside the scrolling panel so it stays put on desktop and can sit above
 * the image (sticky) on phones.
 */
export function PanelHeader({ history, children }: { history: HistoryControls; children?: ReactNode }) {
  return (
    <header className="panel-head">
      <h1 className="wordmark">Fade Generator</h1>
      <div className="head-group history-buttons" role="group" aria-label="Undo and redo">
        <button
          type="button"
          className="icon-btn has-tip"
          onClick={history.onUndo}
          disabled={!history.canUndo}
          aria-label="Undo"
          data-tip="Undo (Ctrl+Z)"
          aria-keyshortcuts="Control+Z Meta+Z"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="icon-btn has-tip"
          onClick={history.onRedo}
          disabled={!history.canRedo}
          aria-label="Redo"
          data-tip="Redo (Ctrl+Shift+Z)"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        >
          <RedoIcon />
        </button>
      </div>
      {children}
    </header>
  );
}

type SectionId = 'shape' | 'texture' | 'format' | 'seed';
const SECTION_IDS: readonly SectionId[] = ['shape', 'texture', 'format', 'seed'];
const ALL_CLOSED: Record<SectionId, boolean> = { shape: false, texture: false, format: false, seed: false };
const ALL_OPEN: Record<SectionId, boolean> = { shape: true, texture: true, format: true, seed: true };

/** One click opens every collapsible section, or closes them all once they're all open. */
function ExpandAllButton({ allOpen, onClick }: { allOpen: boolean; onClick: () => void }) {
  return (
    <div className="index-tools">
      <button type="button" className="quiet-btn small" onClick={onClick}>
        {allOpen ? <CollapseAllIcon /> : <ExpandAllIcon />}
        {allOpen ? 'Collapse all' : 'Expand all'}
      </button>
    </div>
  );
}

/** The left-hand settings index: colours, then the collapsible sections. */
export function SettingsPanel(props: {
  section: SectionProps;
  locks: LookLocks;
  onToggleLock: (look: Look) => void;
  onRandomizeLook: (look: Look) => void;
}) {
  const { section, locks, onToggleLock, onRandomizeLook } = props;
  const [open, setOpen] = useState<Record<SectionId, boolean>>(ALL_CLOSED);
  const allOpen = SECTION_IDS.every((id) => open[id]);
  const collapse = (id: SectionId) => ({ open: open[id], onToggle: () => setOpen((o) => ({ ...o, [id]: !o[id] })) });
  const actions = (look: Look) => (
    <LookActions look={look} locked={locks[look]} onToggleLock={() => onToggleLock(look)} onRandomize={() => onRandomizeLook(look)} />
  );

  return (
    <aside className="panel scroll" aria-label="Settings" data-popover-bounds="">
      <ColorsSection {...section} actions={actions('colors')} />
      <div>
        <ExpandAllButton allOpen={allOpen} onClick={() => setOpen(allOpen ? ALL_CLOSED : ALL_OPEN)} />
        <div className="index">
          <ShapeSection {...section} {...collapse('shape')} actions={actions('shape')} />
          <TextureSection {...section} {...collapse('texture')} actions={actions('texture')} />
          <FormatSection {...section} {...collapse('format')} />
          <SeedSection {...section} {...collapse('seed')} />
        </div>
      </div>
    </aside>
  );
}
