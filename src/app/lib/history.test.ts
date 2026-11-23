import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type FadeParams } from '../../core/index';
import { HISTORY_CAP, historyReducer, initHistory } from './history';

const w = (width: number): FadeParams => ({ ...DEFAULT_PARAMS, width });

describe('historyReducer', () => {
  it('update without commit changes present but adds no entry', () => {
    let s = initHistory(w(100));
    s = historyReducer(s, { type: 'update', params: w(200) });
    s = historyReducer(s, { type: 'update', params: w(300) });
    expect(s.present.width).toBe(300);
    expect(s.past).toHaveLength(0);
  });

  it('commit adds one entry holding the state before the drag', () => {
    let s = initHistory(w(100));
    s = historyReducer(s, { type: 'update', params: w(200) });
    s = historyReducer(s, { type: 'update', params: w(300) });
    s = historyReducer(s, { type: 'commit' });
    expect(s.past.map((p) => p.width)).toEqual([100]);
    s = historyReducer(s, { type: 'commit' });
    expect(s.past).toHaveLength(1);
  });

  it('undo, redo and jumpTo restore exact params', () => {
    let s = initHistory(w(100));
    s = historyReducer(s, { type: 'set', params: w(200) });
    s = historyReducer(s, { type: 'set', params: w(300) });
    s = historyReducer(s, { type: 'undo' });
    expect(s.present).toEqual(w(200));
    s = historyReducer(s, { type: 'undo' });
    expect(s.present).toEqual(w(100));
    s = historyReducer(s, { type: 'undo' });
    expect(s.present).toEqual(w(100));
    s = historyReducer(s, { type: 'redo' });
    expect(s.present).toEqual(w(200));
    s = historyReducer(s, { type: 'jumpTo', index: 2 });
    expect(s.present).toEqual(w(300));
    s = historyReducer(s, { type: 'jumpTo', index: 0 });
    expect(s.present).toEqual(w(100));
    expect(s.future.map((p) => p.width)).toEqual([200, 300]);
  });

  it('a new commit clears redo', () => {
    let s = initHistory(w(100));
    s = historyReducer(s, { type: 'set', params: w(200) });
    s = historyReducer(s, { type: 'undo' });
    s = historyReducer(s, { type: 'set', params: w(500) });
    expect(s.future).toHaveLength(0);
    expect(s.past.map((p) => p.width)).toEqual([100]);
  });

  it('undo during an uncommitted drag commits it first', () => {
    let s = initHistory(w(100));
    s = historyReducer(s, { type: 'update', params: w(150) });
    s = historyReducer(s, { type: 'undo' });
    expect(s.present).toEqual(w(100));
    expect(s.future.map((p) => p.width)).toEqual([150]);
  });

  it('caps at 40 entries', () => {
    let s = initHistory(w(16));
    for (let i = 0; i < 60; i++) s = historyReducer(s, { type: 'set', params: w(100 + i) });
    expect(HISTORY_CAP).toBe(40);
    expect(s.past.length + 1 + s.future.length).toBe(40);
    expect(s.present.width).toBe(159);
  });
});
