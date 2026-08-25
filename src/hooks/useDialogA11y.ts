'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Stack of currently-open dialogs so only the topmost one reacts to Escape
 * (nested modals: Settings → Downgrade confirm) and restores focus in LIFO
 * order when they close.
 */
const openDialogs: symbol[] = [];

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // offsetParent is null for display:none / hidden elements.
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Shared dialog a11y behavior for modal overlays:
 *  - moves focus into the dialog on open (unless the app already focused
 *    something inside, e.g. an autoFocus input)
 *  - contains Tab / Shift+Tab within the dialog
 *  - closes on Escape (topmost dialog only)
 *  - restores focus to the previously-focused element on close
 */
export default function useDialogA11y<T extends HTMLElement = HTMLElement>(
  active: boolean,
  onClose: () => void,
): RefObject<T> {
  const containerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container || typeof document === 'undefined') return;

    const id = Symbol('dialog');
    openDialogs.push(id);

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!container.contains(document.activeElement)) {
      const items = focusableIn(container);
      (items[0] ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const i = openDialogs.indexOf(id);
      if (i !== -1) openDialogs.splice(i, 1);
      // Restore focus to the element that opened the dialog, but only if
      // focus is still inside the dialog (a nested dialog may already have
      // moved it) and the opener is still in the document.
      if (
        opener &&
        opener.isConnected &&
        container.contains(document.activeElement)
      ) {
        opener.focus();
      }
    };
  }, [active]);

  return containerRef as RefObject<T>;
}
