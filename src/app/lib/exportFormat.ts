import { encodeSeedCode, type FadeParams } from '../../core/index';

/** The image formats the full-resolution download can be saved as. */
export type ExportFormat = 'jpeg' | 'png';
/** What the export lane is asked to encode. Quality only exists for JPEG. */
export type ExportEncoding = { format: 'jpeg'; quality: number } | { format: 'png' };

const FORMATS: Record<ExportFormat, { label: string; type: string; ext: string }> = {
  jpeg: { label: 'JPEG', type: 'image/jpeg', ext: 'jpg' },
  png: { label: 'PNG', type: 'image/png', ext: 'png' },
};

/** Choices for the format picker, in display order. */
export const EXPORT_FORMATS: readonly { value: ExportFormat; label: string }[] = (['jpeg', 'png'] as const).map((value) => ({
  value,
  label: FORMATS[value].label,
}));

export function formatLabel(format: ExportFormat): string {
  return FORMATS[format].label;
}

/** Options for `OffscreenCanvas.convertToBlob`. */
export function encodeOptions(e: ExportEncoding): ImageEncodeOptions {
  const type = FORMATS[e.format].type;
  return e.format === 'jpeg' ? { type, quality: e.quality } : { type };
}

/** `fade-<seed>-<W>x<H>.jpg|.png` */
export function exportFilename(params: FadeParams, format: ExportFormat): string {
  return `fade-${encodeSeedCode(params.seeds)}-${params.width}x${params.height}.${FORMATS[format].ext}`;
}
