import { useState, type ReactNode } from 'react';
import { FALLOFF_CURVES, LIMITS, type FalloffCurve } from '../../core/index';
import { aspectLabel, FORMAT_PRESETS, resizeLocked } from '../lib/formats';
import { GRAIN_PRESETS, grainPresetId, shapeSummary, textureSummary } from '../lib/summaries';
import { CollapsibleSection, NumberField, Segmented, Slider, type Collapse } from './controls';
import { LinkIcon } from './icons';
import type { SectionProps } from './types';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const CURVE_LABELS: Record<FalloffCurve, string> = { linear: 'Linear', smooth: 'Smooth', gaussian: 'Gaussian' };

/** A collapsible look section: controlled open state plus optional header actions (lock, randomize). */
type LookSectionProps = SectionProps & Collapse & { actions?: ReactNode };

export function ShapeSection({ params, onChange, onCommit, open, onToggle, actions }: LookSectionProps) {
  const z = params.zones;
  const f = params.falloff;
  const setZones = (patch: Partial<typeof z>) => onChange({ ...params, zones: { ...z, ...patch } }, true);
  return (
    <CollapsibleSection title="Shape" summary={shapeSummary(z)} open={open} onToggle={onToggle} actions={actions}>
      <Slider label="Count" value={z.count} min={LIMITS.zoneCount.min} max={LIMITS.zoneCount.max} step={1} onChange={(v) => setZones({ count: v })} onCommit={onCommit} />
      <Slider label="Size" value={z.size} min={LIMITS.zoneSize.min} max={LIMITS.zoneSize.max} step={0.01} format={pct} onChange={(v) => setZones({ size: v })} onCommit={onCommit} />
      <Slider label="Size variation" value={z.sizeVariation} min={0} max={1} step={0.01} format={pct} onChange={(v) => setZones({ sizeVariation: v })} onCommit={onCommit} />
      <Segmented
        label="Falloff"
        value={f.curve}
        options={FALLOFF_CURVES.map((c) => ({ value: c, label: CURVE_LABELS[c] }))}
        onChange={(curve) => onChange({ ...params, falloff: { ...f, curve } })}
      />
      <Slider label="Softness" value={f.softness} min={0} max={1} step={0.01} format={pct} onChange={(v) => onChange({ ...params, falloff: { ...f, softness: v } }, true)} onCommit={onCommit} />
    </CollapsibleSection>
  );
}

export function TextureSection({ params, onChange, onCommit, open, onToggle, actions }: LookSectionProps) {
  const g = params.grain;
  const set = (patch: Partial<typeof g>, live = true) => onChange({ ...params, grain: { ...g, ...patch } }, live);
  return (
    <CollapsibleSection title="Texture" summary={textureSummary(g)} open={open} onToggle={onToggle} actions={actions}>
      <Segmented
        label="Grain"
        value={grainPresetId(g)}
        options={GRAIN_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        onChange={(id) => {
          const p = GRAIN_PRESETS.find((x) => x.id === id);
          if (p) onChange({ ...params, grain: { ...p.grain } });
        }}
      />
      <Slider label="Amount" value={g.amount} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ amount: v })} onCommit={onCommit} />
      <Slider
        label="Grain size"
        value={g.size}
        min={LIMITS.grainSize.min}
        max={LIMITS.grainSize.max}
        step={0.1}
        format={(v) => `${v.toFixed(1)} px`}
        onChange={(v) => set({ size: v })}
        onCommit={onCommit}
      />
      <Segmented
        label="Type"
        value={g.mode}
        options={[
          { value: 'mono', label: 'Mono' },
          { value: 'color', label: 'Colour' },
        ]}
        onChange={(mode) => set({ mode }, false)}
      />
      <Slider label="Blur" value={params.blur} min={0} max={1} step={0.01} format={pct} onChange={(v) => onChange({ ...params, blur: v }, true)} onCommit={onCommit} />
    </CollapsibleSection>
  );
}

export function FormatSection({ params, onChange, open, onToggle }: SectionProps & Collapse) {
  const [locked, setLocked] = useState(true);
  const preset = FORMAT_PRESETS.find((p) => p.width === params.width && p.height === params.height);
  const setSize = (side: 'width' | 'height', v: number) => {
    const next = locked ? resizeLocked(params.width, params.height, side, v) : { ...params, [side]: v };
    onChange({ ...params, width: next.width, height: next.height });
  };
  return (
    <CollapsibleSection title="Format" summary={aspectLabel(params.width, params.height)} open={open} onToggle={onToggle}>
      <div className="field">
        <label className="field-label" htmlFor="format-preset">
          Preset
        </label>
        <select
          id="format-preset"
          className="input select"
          value={preset?.id ?? 'custom'}
          onChange={(e) => {
            const p = FORMAT_PRESETS.find((f) => f.id === e.currentTarget.value);
            if (p) onChange({ ...params, width: p.width, height: p.height });
          }}
        >
          {FORMAT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {p.width} × {p.height}
            </option>
          ))}
          <option value="custom" disabled>
            Custom
          </option>
        </select>
      </div>
      <div className="size-row">
        <NumberField label="W" ariaLabel="Width" value={params.width} min={LIMITS.width.min} max={LIMITS.width.max} onCommit={(v) => setSize('width', v)} />
        <button
          type="button"
          className="icon-btn"
          aria-pressed={locked}
          aria-label="Lock aspect ratio"
          title={locked ? 'Ratio locked' : 'Ratio unlocked'}
          onClick={() => setLocked((l) => !l)}
        >
          <LinkIcon broken={!locked} />
        </button>
        <NumberField label="H" ariaLabel="Height" value={params.height} min={LIMITS.height.min} max={LIMITS.height.max} onCommit={(v) => setSize('height', v)} suffix="px" />
      </div>
    </CollapsibleSection>
  );
}
