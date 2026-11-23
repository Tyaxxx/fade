import { useEffect, useState, type ReactNode } from 'react';
import { HexColorPicker } from 'react-colorful';
import { LIMITS, PALETTES, randomPalette } from '../../core/index';
import { paletteName } from '../lib/summaries';
import { Section } from './controls';
import { CloseIcon, PlusIcon } from './icons';
import type { SectionProps } from './types';
import { usePopover } from './usePopover';

const HEX = /^#?[0-9a-f]{6}$/i;
const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

function Swatch(props: {
  color: string;
  index: number;
  canRemove: boolean;
  onLive: (hex: string) => void;
  onSet: (hex: string) => void;
  onCommit: () => void;
  onRemove: () => void;
}) {
  const { color, index, onCommit } = props;
  const { open, toggle, close, rootRef, triggerRef, popoverRef } = usePopover({ onClose: onCommit });
  const [draft, setDraft] = useState<string | null>(null);

  // Each finished drag in the picker is its own undo step, even while the popover stays open.
  useEffect(() => {
    if (!open) return;
    document.addEventListener('pointerup', onCommit);
    return () => document.removeEventListener('pointerup', onCommit);
  }, [open, onCommit]);

  const commitDraft = () => {
    if (draft === null) return;
    const v = draft.trim();
    setDraft(null);
    if (HEX.test(v)) props.onSet((v.startsWith('#') ? v : `#${v}`).toLowerCase());
  };
  const invalid = draft !== null && !HEX.test(draft.trim());
  const n = index + 1;

  return (
    <div className="swatch" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="swatch-chip"
        style={{ background: color }}
        aria-label={`Colour ${n}, ${color}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={color}
        onClick={toggle}
      />
      {open ? (
        <div className="popover" role="dialog" aria-label={`Edit colour ${n}`} ref={popoverRef}>
          <HexColorPicker color={color} onChange={props.onLive} />
          <div className="popover-row">
            <label className="sr-only" htmlFor={`hex-${n}`}>
              Colour {n} hex
            </label>
            <input
              id={`hex-${n}`}
              className="input hex"
              aria-invalid={invalid}
              spellCheck={false}
              autoComplete="off"
              value={draft ?? color}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft();
                if (e.key === 'Escape' && draft !== null) {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setDraft(null);
                }
              }}
            />
            <button
              type="button"
              className="quiet-btn"
              disabled={!props.canRemove}
              onClick={() => {
                close({ restoreFocus: false });
                props.onRemove();
              }}
            >
              <CloseIcon /> Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ColorsSection({ params, onChange, onCommit, actions }: SectionProps & { actions?: ReactNode }) {
  const palette = params.palette;
  const setAt = (i: number, hex: string, live = false) => {
    const next = palette.slice();
    next[i] = hex;
    onChange({ ...params, palette: next }, live);
  };
  const name = paletteName(palette);
  const full = palette.length >= LIMITS.paletteLength.max;

  return (
    <Section title="Colours" summary={name} actions={actions}>
      <div className="swatches" data-popover-bounds="">
        {palette.map((c, i) => (
          <Swatch
            key={i}
            index={i}
            color={c}
            canRemove={palette.length > LIMITS.paletteLength.min}
            onLive={(hex) => setAt(i, hex, true)}
            onSet={(hex) => setAt(i, hex)}
            onCommit={onCommit}
            onRemove={() => onChange({ ...params, palette: palette.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          type="button"
          className="swatch-add"
          aria-label="Add colour"
          title={full ? `Up to ${LIMITS.paletteLength.max} colours` : 'Add colour'}
          disabled={full}
          onClick={() => onChange({ ...params, palette: [...palette, randomPalette(randomSeed(), 3)[1]] })}
        >
          <PlusIcon />
        </button>
      </div>
      <div className="presets" role="group" aria-label="Palette presets">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            className="preset"
            aria-label={p.name}
            aria-pressed={name === p.name}
            title={p.name}
            onClick={() => onChange({ ...params, palette: [...p.colors] })}
          >
            <span className="preset-strip" style={{ background: `linear-gradient(90deg, ${p.colors.join(', ')})` }} />
          </button>
        ))}
      </div>
    </Section>
  );
}
