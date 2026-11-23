import { LOOK_LABELS, type Look } from '../lib/randomize';
import { LockIcon, ShuffleIcon } from './icons';

/**
 * Header actions of a look section: a lock that keeps the section when
 * randomizing all, and a button that re-rolls just this section (lock or not).
 */
export function LookActions({ look, locked, onToggleLock, onRandomize }: { look: Look; locked: boolean; onToggleLock: () => void; onRandomize: () => void }) {
  const label = LOOK_LABELS[look];
  const lower = label.toLowerCase();
  return (
    <>
      <button
        type="button"
        className="head-btn has-tip"
        aria-pressed={locked}
        aria-label={`Lock ${lower}`}
        data-tip={locked ? `${label} locked` : 'Keep when randomizing'}
        data-tip-align="end"
        onClick={onToggleLock}
      >
        <LockIcon open={!locked} />
      </button>
      <button type="button" className="head-btn has-tip" aria-label={`Randomize ${lower}`} data-tip={`Randomize ${lower}`} data-tip-align="end" onClick={onRandomize}>
        <ShuffleIcon />
      </button>
    </>
  );
}
