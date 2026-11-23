import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { FadeParams } from '../../core/index';
import { stageReadout } from '../lib/formats';
import { DEAD_ERROR, type Renderer } from '../render/renderer';
import { usePreview } from '../render/usePreview';
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
  exporting: boolean;
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
          <label className="quality" htmlFor="jpeg-quality">
            JPEG quality
          </label>
          <input
            id="jpeg-quality"
            className="range compact"
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={props.quality}
            style={{ '--pct': `${qualityFill}%` } as CSSProperties}
            onChange={(e) => props.onQuality(Number(e.currentTarget.value))}
          />
          <output htmlFor="jpeg-quality" className="value quality-value">
            {qualityPct}
          </output>
          <button
            type="button"
            className="primary-btn icon-only download has-tip"
            aria-label="Download JPEG"
            data-tip="Download JPEG"
            data-tip-pos="top"
            data-tip-align="end"
            onClick={props.exporting ? undefined : props.onDownload}
            aria-disabled={props.exporting}
            aria-busy={props.exporting}
          >
            {props.exporting ? <span className="spinner" aria-hidden="true" /> : <DownloadIcon />}
          </button>
        </div>
        <div className="stage-messages">
          {/* Screen-reader only: a visible line here would resize the stage and re-render the preview mid-export. */}
          <p className="sr-only" role="status">
            {props.exporting ? 'Rendering JPEG…' : null}
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
