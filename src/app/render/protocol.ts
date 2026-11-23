import type { FadeParams, RenderedImage } from '../../core/index';
import type { ExportEncoding } from '../lib/exportFormat';

export type RenderRequest =
  | { id: number; kind: 'image'; params: FadeParams; scale: number }
  | { id: number; kind: 'export'; params: FadeParams; encoding: ExportEncoding };

export type RenderResponse =
  | { id: number; ok: true; kind: 'image'; image: RenderedImage }
  | { id: number; ok: true; kind: 'export'; blob: Blob }
  | { id: number; ok: false; error: string };
