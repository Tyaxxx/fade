import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { FadeParams } from '../../core/index';
import { EXPORT_FORMATS, formatLabel, type ExportFormat } from '../lib/exportFormat';
import { stageReadout } from '../lib/formats';
import { DEAD_ERROR, type Renderer } from '../render/renderer';
import { usePreview } from '../render/usePreview';
import { Segmented } from './controls';
import { DownloadIcon } from './icons';

/** Fit a w×h image into a box, keeping its ratio. */
function fit(w: number, h: number, boxW: number, boxH: number) {
  const s = Math.min(boxW / w, boxH / h);
  return { width: Math.max(1, Math.floor(w * s)), height: Math.max(1, Math.floor(h * s)) };
}

export function Stage(props: {
  renderer: Renderer;
  params: FadeParams;
  quality: number;
  onQuality: (q: number) => void;
  format: ExportFormat;
  onFormat: (f: ExportFormat) => void;
  /** The format being rendered, or null when no export is running. */
  exporting: ExportFormat | null;
  exportError: string | null;
  onDownload: () => void;
}) {
  const { params } = props;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = fit(params.width, params.height, Math.max(1, size.w), Math.max(1, size.h));
  // 0 until the stage has been measured, so no throwaway low-res frame is rendered.
  const longEdge = size.w > 0 && size.h > 0 ? Math.max(shown.width, shown.height) : 0;
  const { ready, error } = usePreview(props.renderer, params, longEdge, canvas);
  const readout = stageReadout(params.width, params.height);
  const qualityPct = Math.round(props.quality * 100);
  const qualityFill = ((props.quality - 0.5) / 0.5) * 100;
  const busy = props.exporting !== null;
  const downloadLabel = `Download ${formatLabel(props.format)}`;

  return (
    <main className="stage" aria-label="Image" style={{ '--aspect': `${params.width} / ${params.height}` } as CSSProperties}>
      <div className="stage-box" ref={box}>
        <div className={ready ? 'frame' : 'frame loading'} style={{ width: shown.width, height: shown.height }}>
          <canvas
            ref={canvas}
            className="preview"
            role="img"
            aria-label={`Preview of the ${params.width} by ${params.height} pixel image`}
          />
        </div>
      </div>
      <div className="stage-bar">
        <p className="readout">
          <span className="readout-name">{readout.name}</span>
          <span className="readout-dims">{readout.dims}</span>
          {readout.ratio ? <span className="readout-ratio">{readout.ratio}</span> : null}
        </p>
        <div className="export">
          <div className="format-choice">
            <Segmented label="Export format" hideLabel value={props.format} options={EXPORT_FORMATS} onChange={props.onFormat} />
          </div>
          {/* PNG is lossless: the slider stays in place (no row jump) but is disabled and dimmed. */}
          <div className="quality-group" data-disabled={props.format === 'png' || undefined}>
            <label className="quality" htmlFor="jpeg-quality">
              <span className="sr-only">JPEG quality</span>
              <span aria-hidden="true">Quality</span>
            </label>
            <input
              id="jpeg-quality"
              className="range compact"
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={props.quality}
              disabled={props.format === 'png'}
              style={{ '--pct': `${qualityFill}%` } as CSSProperties}
              onChange={(e) => props.onQuality(Number(e.currentTarget.value))}
            />
            <output htmlFor="jpeg-quality" className="value quality-value">
              {qualityPct}
            </output>
          </div>
          <button
            type="button"
            className="primary-btn icon-only download has-tip"
            aria-label={downloadLabel}
            data-tip={downloadLabel}
            data-tip-pos="top"
            data-tip-align="end"
            onClick={busy ? undefined : props.onDownload}
            aria-disabled={busy}
            aria-busy={busy}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : <DownloadIcon />}
          </button>
        </div>
        <div className="stage-messages">
          {/* Screen-reader only: a visible line here would resize the stage and re-render the preview mid-export. */}
          <p className="sr-only" role="status">
            {props.exporting ? `Rendering ${formatLabel(props.exporting)}…` : null}
          </p>
          <p className="note error" role="status" title={error ?? undefined}>
            {error === DEAD_ERROR ? 'The preview couldn’t start. Reload the page.' : error ? 'Preview failed. Change a setting to try again.' : null}
          </p>
          <p className="note error" role="alert">
            {props.exportError}
          </p>
        </div>
      </div>
    </main>
  );
}
