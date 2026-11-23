import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const EDGE = 8; // px kept free between the popover and its bounds

/**
 * Open/close state for one anchored popover. Every way of closing it (outside
 * pointerdown, focus moving outside, Escape, trigger toggle, explicit `close()`) goes through one
 * `close`, which calls `onClose` exactly once per open→closed transition.
 * The popover is shifted sideways to stay inside the nearest
 * `[data-popover-bounds]` ancestor (or the viewport).
 */
export function usePopover(opts: { onClose?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const onCloseRef = useRef(opts.onClose);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    onCloseRef.current = opts.onClose;
  });

  const close = useCallback((o: { restoreFocus?: boolean } = {}) => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    onCloseRef.current?.();
    if (o.restoreFocus) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    if (openRef.current) {
      close();
    } else {
      openRef.current = true;
      setOpen(true);
    }
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close({ restoreFocus: true });
    };
    // Keyboard focus leaving the popover (e.g. Tab past its last control) closes it.
    // A null relatedTarget (focus to body, pointer elsewhere) is left to `onDown`.
    const onFocusOut = (e: FocusEvent) => {
      const to = e.relatedTarget;
      if (to instanceof Node && !rootRef.current?.contains(to)) close();
    };
    const root = rootRef.current;
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    root?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!open || !el) return;
    el.style.transform = '';
    const rect = el.getBoundingClientRect();
    const host = el.parentElement?.closest('[data-popover-bounds]')?.getBoundingClientRect();
    const left = Math.max(host?.left ?? 0, 0) + EDGE;
    const right = Math.min(host?.right ?? Infinity, document.documentElement.clientWidth || Infinity) - EDGE;
    let dx = 0;
    if (rect.right > right) dx = right - rect.right;
    if (rect.left + dx < left) dx = left - rect.left;
    if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
  }, [open]);

  return { open, toggle, close, rootRef, triggerRef, popoverRef };
}
