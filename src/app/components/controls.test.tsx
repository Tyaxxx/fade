// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './controls';

type V = 'a' | 'b' | 'c';
const OPTIONS: { value: V; label: string }[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

function Harness({ initial, onChange }: { initial: V | null; onChange?: (v: V) => void }) {
  const [value, setValue] = useState<V | null>(initial);
  return (
    <Segmented
      label="Pick"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLButtonElement;

afterEach(cleanup);

describe('Segmented (radio group pattern)', () => {
  it('makes only the checked option a tab stop', () => {
    render(<Harness initial="b" />);
    expect(radio('Alpha').tabIndex).toBe(-1);
    expect(radio('Beta').tabIndex).toBe(0);
    expect(radio('Gamma').tabIndex).toBe(-1);
  });

  it('makes the first option the tab stop when nothing is checked', () => {
    render(<Harness initial={null} />);
    expect(radio('Alpha').tabIndex).toBe(0);
    expect(radio('Beta').tabIndex).toBe(-1);
  });

  it('wraps from the last option to the first with ArrowRight and moves focus', () => {
    const onChange = vi.fn();
    render(<Harness initial="c" onChange={onChange} />);
    radio('Gamma').focus();
    fireEvent.keyDown(radio('Gamma'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('a');
    expect(document.activeElement).toBe(radio('Alpha'));
    expect(radio('Alpha').getAttribute('aria-checked')).toBe('true');
  });

  it('wraps from the first option to the last with ArrowUp', () => {
    const onChange = vi.fn();
    render(<Harness initial="a" onChange={onChange} />);
    fireEvent.keyDown(radio('Alpha'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('c');
    expect(document.activeElement).toBe(radio('Gamma'));
  });

  it('jumps to the ends with Home and End', () => {
    const onChange = vi.fn();
    render(<Harness initial="b" onChange={onChange} />);
    fireEvent.keyDown(radio('Beta'), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(radio('Gamma'), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(document.activeElement).toBe(radio('Alpha'));
  });
});

describe('Segmented hideLabel', () => {
  it('keeps the group named by its label while hiding the label visually', () => {
    render(<Segmented label="Export format" hideLabel value="a" options={OPTIONS} onChange={() => {}} />);
    screen.getByRole('radiogroup', { name: 'Export format' });
    expect(screen.getByText('Export format').className).toBe('sr-only');
  });
});
