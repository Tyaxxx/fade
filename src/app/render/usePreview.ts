import { useEffect, useState, type RefObject } from 'react';
import type { FadeParams } from '../../core/index';
import type { Renderer } from './renderer';

const PREVIEW_MAX_EDGE = 1280;

/** Render scale so the preview has about as many pixels as the stage shows (capped). */
export function previewScale(params: FadeParams, stageLongEdge: number, dpr: number): number {
  const target = Math.min(PREVIEW_MAX_EDGE, Math.max(64, stageLongEdge * dpr));
  return Math.min(1, target / Math.max(params.width, params.height));
}

/**
 * Keep `canvasRef` showing a live render of `params`. `ready` turns true once
 * the first frame has been drawn; `error` holds the last preview failure and
 * clears on the next successful frame.
 */
export function usePreview(
  renderer: Renderer,
  params: FadeParams,
  stageLongEdge: number,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stageLongEdge <= 0) return;
    const scale = previewScale(params, stageLongEdge, window.devicePixelRatio || 1);
    renderer.renderPreview(
      params,
      scale,
      (image) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (canvas.width !== image.width) canvas.width = image.width;
        if (canvas.height !== image.height) canvas.height = image.height;
        const c2d = canvas.getContext('2d');
        c2d?.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0);
        setReady(true);
        setError(null);
      },
      setError,
    );
  }, [renderer, params, stageLongEdge, canvasRef]);

  return { ready, error };
}
