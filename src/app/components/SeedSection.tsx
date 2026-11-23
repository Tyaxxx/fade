import { useState } from 'react';
import { decodeSeedCode, encodeSeedCode } from '../../core/index';
import { CollapsibleSection, type Collapse } from './controls';
import type { SectionProps } from './types';

export function SeedSection({ params, onChange, open, onToggle }: SectionProps & Collapse) {
  const code = encodeSeedCode(params.seeds);
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = () => {
    if (draft === null) return;
    const seeds = decodeSeedCode(draft);
    setDraft(null);
    if (seeds) {
      setNote(null);
      onChange({ ...params, seeds });
    } else if (draft.trim() !== code) {
      setNote('That seed code isn’t valid. It looks like four groups of letters and digits, e.g. 3k9f-0a1b-zz12-8c7d.');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setNote('Seed copied.');
    } catch {
      setNote('Couldn’t reach the clipboard. Select the code and copy it.');
    }
  };

  return (
    <CollapsibleSection title="Seed" open={open} onToggle={onToggle} summary={<span className="seed-summary">{code}</span>}>
      <div className="seed-row">
        <label className="sr-only" htmlFor="seed-code">
          Seed code
        </label>
        <input
          id="seed-code"
          className="input seed-input"
          spellCheck={false}
          autoComplete="off"
          value={draft ?? code}
          aria-describedby="seed-note"
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') setDraft(null);
          }}
        />
        <button type="button" className="quiet-btn" onClick={copy}>
          Copy seed
        </button>
      </div>
      <p id="seed-note" className="note" role="status">
        {note}
      </p>
    </CollapsibleSection>
  );
}
