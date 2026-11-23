// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '../../core/index';
import { App } from '../App';
import type { Renderer } from '../render/renderer';

const renderer: Renderer = {
  renderPreview: () => undefined,
  exportJpeg: vi.fn(async () => new Blob()),
  dispose: () => undefined,
};

const original = DEFAULT_PARAMS.palette[0];
const swatch = () => screen.getByRole('button', { name: /^Colour 1, / });
const swatchHex = () => swatch().getAttribute('aria-label')!.split(', ')[1];
const undo = () =>
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });

/** Open swatch 1 and nudge its hue with the keyboard (react-colorful's slider). */
function editWithPicker() {
  fireEvent.click(swatch());
  const dialog = screen.getByRole('dialog', { name: 'Edit colour 1' });
  const hue = within(dialog).getByRole('slider', { name: 'Hue' });
  for (let i = 0; i < 5; i++) fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 });
  expect(swatchHex()).not.toBe(original);
  return swatchHex();
}

afterEach(cleanup);

describe('colour picker history (R1)', () => {
  it('commits keyboard edits as one undo step when closed with Escape', () => {
    render(<App renderer={renderer} />);
    editWithPicker();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    undo();
    expect(swatchHex()).toBe(original);
  });

  it('commits when an outside pointerdown closes the popover', () => {
    render(<App renderer={renderer} />);
    editWithPicker();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    undo();
    expect(swatchHex()).toBe(original);
  });

  it('closes and commits once when focus moves out of the popover (R4)', () => {
    render(<App renderer={renderer} />);
    editWithPicker();
    const dialog = screen.getByRole('dialog', { name: 'Edit colour 1' });
    const outside = screen.getByRole('button', { name: 'Undo' });
    fireEvent.focusOut(within(dialog).getByRole('slider', { name: 'Hue' }), { relatedTarget: outside });
    expect(screen.queryByRole('dialog')).toBeNull();
    undo();
    expect(swatchHex()).toBe(original);
  });

  it('commits when the trigger is clicked again', () => {
    render(<App renderer={renderer} />);
    editWithPicker();
    fireEvent.click(swatch());
    expect(screen.queryByRole('dialog')).toBeNull();
    undo();
    expect(swatchHex()).toBe(original);
  });

  it('keeps a picker edit and a later change as separate undo steps', () => {
    render(<App renderer={renderer} />);
    const edited = editWithPicker();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Nightfall' }));
    undo();
    expect(swatchHex()).toBe(edited);
    undo();
    expect(swatchHex()).toBe(original);
  });

  it('commits a pointer drag on release even while the popover stays open', () => {
    render(<App renderer={renderer} />);
    const edited = editWithPicker();
    fireEvent.pointerUp(document.body);
    expect(screen.getByRole('dialog')).toBeTruthy();
    const hue = screen.getByRole('slider', { name: 'Hue' });
    fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    undo();
    expect(swatchHex()).toBe(edited);
  });
});
