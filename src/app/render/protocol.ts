import type { FadeParams, RenderedImage } from '../../core/index';

export type RenderRequest =
  | { id: number; kind: 'image'; params: FadeParams; scale: number }
  | { id: number; kind: 'jpeg'; params: FadeParams; quality: number };

export type RenderResponse =
  | { id: number; ok: true; kind: 'image'; image: RenderedImage }
  | { id: number; ok: true; kind: 'jpeg'; blob: Blob }
  | { id: number; ok: false; error: string };
