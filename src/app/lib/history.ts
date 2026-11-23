import type { FadeParams } from '../../core/index';

export const HISTORY_CAP = 40;

export interface HistoryState {
  past: FadeParams[];
  present: FadeParams;
  future: FadeParams[];
  /** Committed state the current live edits started from. */
  draftBase: FadeParams;
}

export type HistoryAction =
  | { type: 'update'; params: FadeParams } // live change (slider drag), no entry
  | { type: 'commit' } // end of a drag: record draftBase if it differs
  | { type: 'set'; params: FadeParams } // discrete change: update + commit
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'jumpTo'; index: number }; // index into [...past, present, ...future]

export function initHistory(params: FadeParams): HistoryState {
  return { past: [], present: params, future: [], draftBase: params };
}

const same = (a: FadeParams, b: FadeParams) => a === b || JSON.stringify(a) === JSON.stringify(b);

function commit(s: HistoryState): HistoryState {
  if (same(s.draftBase, s.present)) return s.draftBase === s.present ? s : { ...s, draftBase: s.present };
  const past = [...s.past, s.draftBase].slice(-(HISTORY_CAP - 1));
  return { past, present: s.present, future: [], draftBase: s.present };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'update':
      return { ...state, present: action.params };
    case 'commit':
      return commit(state);
    case 'set':
      return commit({ ...state, present: action.params });
    case 'undo': {
      const s = commit(state);
      if (s.past.length === 0) return s;
      const present = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present, future: [s.present, ...s.future], draftBase: present };
    }
    case 'redo': {
      const s = commit(state);
      if (s.future.length === 0) return s;
      const present = s.future[0];
      return { past: [...s.past, s.present], present, future: s.future.slice(1), draftBase: present };
    }
    case 'jumpTo': {
      const s = commit(state);
      const all = [...s.past, s.present, ...s.future];
      const i = Math.max(0, Math.min(all.length - 1, action.index));
      return { past: all.slice(0, i), present: all[i], future: all.slice(i + 1), draftBase: all[i] };
    }
  }
}
