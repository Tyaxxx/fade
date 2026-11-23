import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, encodeSeedCode } from '../../core/index';
import { encodeOptions, EXPORT_FORMATS, exportFilename, formatLabel } from './exportFormat';

describe('encodeOptions', () => {
  it('encodes JPEG at the given quality', () => {
    expect(encodeOptions({ format: 'jpeg', quality: 0.8 })).toEqual({ type: 'image/jpeg', quality: 0.8 });
  });

  it('encodes PNG without a quality', () => {
    const opts = encodeOptions({ format: 'png' });
    expect(opts).toEqual({ type: 'image/png' });
    expect('quality' in opts).toBe(false);
  });
});

describe('exportFilename', () => {
  const prefix = `fade-${encodeSeedCode(DEFAULT_PARAMS.seeds)}-`;

  it('names a PNG with the seed code, size and .png', () => {
    expect(exportFilename(DEFAULT_PARAMS, 'png')).toBe(`${prefix}1920x1080.png`);
  });

  it('names a JPEG with .jpg', () => {
    expect(exportFilename({ ...DEFAULT_PARAMS, width: 800, height: 600 }, 'jpeg')).toBe(`${prefix}800x600.jpg`);
  });
});

describe('formatLabel', () => {
  it('names each format', () => {
    expect(formatLabel('jpeg')).toBe('JPEG');
    expect(formatLabel('png')).toBe('PNG');
  });

  it('lists JPEG then PNG as choices', () => {
    expect(EXPORT_FORMATS).toEqual([
      { value: 'jpeg', label: 'JPEG' },
      { value: 'png', label: 'PNG' },
    ]);
  });
});
