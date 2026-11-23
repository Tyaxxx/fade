import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

/** Labelled range input with a numeric readout. `onChange` fires live, `onCommit` when the drag/key ends. */
export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const { label, value, min, max, step, format = (v) => String(v), onChange, onCommit } = props;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="value">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </div>
  );
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp'];

/**
 * Single-choice segmented control following the WAI-ARIA radio group pattern:
 * one tab stop (roving tabIndex), arrows move and select with wrap-around,
 * Home/End jump to the ends. `value` may be null when no option matches.
 */
export function Segmented<T extends string>(props: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { options, value, onChange } = props;
  const checked = options.findIndex((o) => o.value === value);
  const tabStop = checked === -1 ? 0 : checked;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = refs.current.findIndex((el) => el === e.target);
    const at = from === -1 ? tabStop : from;
    const n = options.length;
    let to: number;
    if (NEXT_KEYS.includes(e.key)) to = (at + 1) % n;
    else if (PREV_KEYS.includes(e.key)) to = (at - 1 + n) % n;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    else return;
    e.preventDefault();
    onChange(options[to].value);
    refs.current[to]?.focus();
  };

  return (
    <div className="field">
      <span className="field-label" id={id}>
        {props.label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id} onKeyDown={onKeyDown}>
        {options.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            className="segment"
            aria-checked={value === o.value}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Integer text field that commits on blur or Enter and reverts on Escape. */
export function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
  suffix?: string;
  /** Full accessible name when the visible label is an abbreviation ("W" → "Width"). */
  ariaLabel?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    setDraft(null);
    if (Number.isFinite(n) && draft.trim() !== '') props.onCommit(Math.min(props.max, Math.max(props.min, n)));
  };
  return (
    <div className="number-field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={props.ariaLabel}
        value={draft ?? String(props.value)}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      {props.suffix ? <span className="suffix">{props.suffix}</span> : null}
    </div>
  );
}

/** Always-open section with a plain heading, an optional summary and optional header `actions`. */
export function Section(props: { title: string; summary?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id} className="section-title">
          {props.title}
        </h2>
        {props.summary ? <span className="section-summary">{props.summary}</span> : null}
        {props.actions ? <div className="section-actions">{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  );
}

/** Open state of a collapsible section, owned by the parent (so it can expand or collapse all). */
export interface Collapse {
  open: boolean;
  onToggle: () => void;
}

/**
 * Index row that expands to reveal its controls. Controlled: the parent owns `open`.
 * Optional `actions` sit beside the toggle (a button can't live inside another button).
 */
export function CollapsibleSection(props: Collapse & { title: string; summary: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="section collapsible">
      <div className="section-head-row">
        <h2 className="section-heading">
          <button
            type="button"
            className="section-toggle"
            aria-expanded={props.open}
            aria-controls={`${id}-body`}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-summary`}
            onClick={props.onToggle}
          >
            <span id={`${id}-title`} className="section-title">
              {props.title}
            </span>
            <span id={`${id}-summary`} className="section-summary">
              {props.summary}
            </span>
            <span className="chevron">
              <ChevronIcon />
            </span>
          </button>
        </h2>
        {props.actions ? <div className="section-actions">{props.actions}</div> : null}
      </div>
      <div id={`${id}-body`} className="section-body" hidden={!props.open}>
        {props.children}
      </div>
    </section>
  );
}
