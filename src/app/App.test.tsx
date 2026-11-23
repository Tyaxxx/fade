// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FadeParams } from '../core/index';
import { DEFAULT_PARAMS, encodeSeedCode } from '../core/index';
import { App } from './App';
import type { Renderer } from './render/renderer';

function fakeRenderer() {
  const previews: FadeParams[] = [];
  const renderer: Renderer = {
    renderPreview: (params) => {
      previews.push(params);
    },
    exportImage: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
    dispose: () => undefined,
  };
  return { renderer, previews };
}

const panel = () => within(screen.getByRole('complementary', { name: 'Settings' }));
const sectionToggle = (name: string) => panel().getByRole('button', { name, expanded: false });
const expand = (name: string) => fireEvent.click(sectionToggle(name));
const seedCode = () => screen.getByLabelText('Seed code') as HTMLInputElement;
const SECTIONS = ['Shape', 'Texture', 'Format', 'Seed'];

afterEach(cleanup);

describe('App', () => {
  it('renders the header, the settings index and the stage', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Fade Generator' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Colours' })).toBeTruthy();
    for (const name of ['Shape', 'Texture', 'Format', 'Seed']) {
      expect(sectionToggle(name).getAttribute('aria-expanded')).toBe('false');
    }
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download JPEG' })).toBeTruthy();
    expect(screen.getByText('1920 × 1080 px')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'History' })).toBeNull();
  });

  it('has no dither control', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    for (const name of ['Shape', 'Texture', 'Format', 'Seed']) expand(name);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/dither/i)).toBeNull();
    expect(screen.queryByLabelText(/dither/i)).toBeNull();
  });

  it('expanding Shape reveals its sliders', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expect(screen.queryByRole('slider', { name: 'Count' })).toBeNull();
    expand('Shape');
    expect(screen.getByRole('slider', { name: 'Count' })).toBeTruthy();
    expect(panel().getByRole('button', { name: 'Shape', expanded: true })).toBeTruthy();
  });

  it('import, export and download are icon-only buttons with accessible names', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    for (const name of ['Import settings', 'Export settings', 'Download JPEG']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.textContent?.trim()).toBe('');
      expect(btn.getAttribute('data-tip')).toBe(name);
    }
  });

  it('expand all opens every section, collapse all closes them, and the label follows manual toggles', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    fireEvent.click(panel().getByRole('button', { name: 'Expand all' }));
    for (const name of SECTIONS) expect(panel().getByRole('button', { name, expanded: true })).toBeTruthy();
    fireEvent.click(panel().getByRole('button', { name: 'Collapse all' }));
    for (const name of SECTIONS) expect(sectionToggle(name)).toBeTruthy();
    fireEvent.click(panel().getByRole('button', { name: 'Expand all' }));
    fireEvent.click(panel().getByRole('button', { name: 'Shape', expanded: true }));
    expect(panel().getByRole('button', { name: 'Expand all' })).toBeTruthy();
    fireEvent.click(panel().getByRole('button', { name: 'Expand all' }));
    for (const name of SECTIONS) expect(panel().getByRole('button', { name, expanded: true })).toBeTruthy();
  });

  it('randomize texture changes only the texture look and is one undo step', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expand('Seed');
    const before = seedCode().value;
    fireEvent.click(screen.getByRole('button', { name: 'Randomize texture' }));
    const after = seedCode().value;
    expect(after.split('-')[3]).not.toBe(before.split('-')[3]);
    expect(after.split('-').slice(0, 3)).toEqual(before.split('-').slice(0, 3));
    expect(screen.getByText('Bloom')).toBeTruthy();
    expect(screen.getByText('6 zones')).toBeTruthy();
    expect(screen.getByText('1920 × 1080 px')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(seedCode().value).toBe(before);
  });

  it('randomize all keeps locked looks and the size, and undo/redo round-trip', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
    expand('Seed');
    const before = seedCode().value;
    const lock = screen.getByRole('button', { name: 'Lock colours' });
    fireEvent.click(lock);
    expect(lock.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Colours kept')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
    const after = seedCode().value;
    expect(after.split('-')[2]).toBe(before.split('-')[2]);
    expect(after.split('-')[0]).not.toBe(before.split('-')[0]);
    expect(screen.getByText('Bloom')).toBeTruthy();
    expect(screen.getByText('1920 × 1080 px')).toBeTruthy();
    act(() => {
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    });
    expect(seedCode().value).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(seedCode().value).toBe(after);
  });

  it('with every look locked, randomize changes nothing and adds no history', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    for (const name of ['Lock colours', 'Lock shape', 'Lock texture']) fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByText('Everything kept, so nothing will change')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the R key randomizes with the latest params', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expand('Shape');
    fireEvent.change(screen.getByRole('slider', { name: 'Count' }), { target: { value: '12' } });
    fireEvent.keyUp(screen.getByRole('slider', { name: 'Count' }));
    for (const name of ['Lock shape', 'Lock texture']) fireEvent.click(screen.getByRole('button', { name }));
    expand('Seed');
    const before = seedCode().value;
    act(() => {
      fireEvent.keyDown(window, { key: 'r' });
    });
    expect(seedCode().value.split('-')[2]).not.toBe(before.split('-')[2]);
    // Shape is locked, so the slider change (12 zones) survives: stale params would bring back 6.
    expect(screen.getByText('12 zones')).toBeTruthy();
    expect(screen.queryByText('Bloom')).toBeNull();
  });

  it('the seed section has no locks and pasting a seed code still applies', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expand('Seed');
    expect(screen.queryByRole('group', { name: 'Keep when randomizing' })).toBeNull();
    const input = seedCode();
    expect(input.getAttribute('autocomplete')).toBe('off');
    fireEvent.change(input, { target: { value: '1-2-3-4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(seedCode().value).toBe('1-2-3-4');
  });

  it('names the size fields Width and Height, and mounts live regions before any message', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expand('Format');
    expect(screen.getByRole('textbox', { name: 'Width' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Height' })).toBeTruthy();
    expand('Seed');
    const statuses = screen.getAllByRole('status');
    expect(statuses.some((el) => el.id === 'seed-note')).toBe(true);
    expect(statuses.length).toBeGreaterThanOrEqual(4); // seed, file, export, preview
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2); // file and export errors
  });

  it('applying a format preset updates the size readout', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expand('Format');
    fireEvent.change(screen.getByLabelText('Preset'), { target: { value: '4k' } });
    expect(screen.getByText('3840 × 2160 px')).toBeTruthy();
  });

  it('choosing a grain preset updates the texture summary', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expand('Texture');
    fireEvent.click(screen.getByRole('radio', { name: 'Rough' }));
    expect(screen.getByText('Rough grain')).toBeTruthy();
  });
});

describe('App export format', () => {
  const formatGroup = () => within(screen.getByRole('radiogroup', { name: 'Export format' }));
  const pick = (name: 'JPEG' | 'PNG') => fireEvent.click(formatGroup().getByRole('radio', { name }));
  const quality = () => screen.getByRole('slider', { name: 'JPEG quality' }) as HTMLInputElement;
  const prefix = `fade-${encodeSeedCode(DEFAULT_PARAMS.seeds)}-`;

  /** Records the filename of every anchor download. */
  function captureDownloads() {
    const names: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    return names;
  }

  afterEach(() => vi.restoreAllMocks());

  it('offers JPEG and PNG, with JPEG checked by default', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    expect(formatGroup().getByRole('radio', { name: 'JPEG' }).getAttribute('aria-checked')).toBe('true');
    expect(formatGroup().getByRole('radio', { name: 'PNG' }).getAttribute('aria-checked')).toBe('false');
  });

  it('disables the quality slider for PNG and restores it with the same value for JPEG', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    fireEvent.change(quality(), { target: { value: '0.8' } });
    pick('PNG');
    expect(quality().disabled).toBe(true);
    pick('JPEG');
    expect(quality().disabled).toBe(false);
    expect(quality().value).toBe('0.8');
  });

  it('names the download button after the chosen format, without adding an undo step', () => {
    const { renderer } = fakeRenderer();
    render(<App renderer={renderer} />);
    pick('PNG');
    const btn = screen.getByRole('button', { name: 'Download PNG' });
    expect(btn.getAttribute('data-tip')).toBe('Download PNG');
    expect(screen.queryByRole('button', { name: 'Download JPEG' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('downloads a PNG with no quality and a .png name', async () => {
    const { renderer } = fakeRenderer();
    const names = captureDownloads();
    render(<App renderer={renderer} />);
    pick('PNG');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download PNG' })));
    expect(renderer.exportImage).toHaveBeenCalledWith(DEFAULT_PARAMS, { format: 'png' });
    expect(names).toEqual([`${prefix}1920x1080.png`]);
  });

  it('downloads a JPEG at the chosen quality with a .jpg name', async () => {
    const { renderer } = fakeRenderer();
    const names = captureDownloads();
    render(<App renderer={renderer} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download JPEG' })));
    expect(renderer.exportImage).toHaveBeenCalledWith(DEFAULT_PARAMS, { format: 'jpeg', quality: 0.92 });
    expect(names).toEqual([`${prefix}1920x1080.jpg`]);
  });

  it('announces the format being rendered, even if the choice changes mid-export', async () => {
    const { renderer } = fakeRenderer();
    let finish: (b: Blob) => void = () => {};
    vi.mocked(renderer.exportImage).mockImplementation(() => new Promise<Blob>((r) => (finish = r)));
    captureDownloads();
    render(<App renderer={renderer} />);
    pick('PNG');
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(screen.getByText('Rendering PNG…')).toBeTruthy();
    pick('JPEG');
    expect(screen.getByText('Rendering PNG…')).toBeTruthy();
    await act(async () => finish(new Blob(['x'])));
    expect(screen.queryByText(/Rendering/)).toBeNull();
  });
});
