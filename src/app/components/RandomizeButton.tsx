import { keptHint, type LookLocks } from '../lib/randomize';

/** The primary creative action: re-roll every unlocked look. Names the kept looks when some are locked. */
export function RandomizeButton({ locks, onRandomize }: { locks: LookLocks; onRandomize: () => void }) {
  const hint = keptHint(locks);
  return (
    <div className="randomize">
      <button
        type="button"
        className="primary-btn wide"
        onClick={onRandomize}
        aria-keyshortcuts="R"
        aria-describedby="kept-hint"
      >
        Randomize <kbd aria-hidden="true">R</kbd>
      </button>
      {/* Always mounted with a reserved line so toggling a lock doesn't shift the panel. */}
      <p id="kept-hint" className="meta kept-hint">
        {hint}
      </p>
    </div>
  );
}
