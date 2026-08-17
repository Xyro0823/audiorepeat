'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onNew: () => void;
  onImport: () => void;
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white';

/**
 * Primary call-to-action: create a new set or import a JSON set. One button
 * with a small menu, keeping the top bar to a single primary action.
 */
export default function NewSetButton({ onNew, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Create a new set or import one"
        className="btn-primary-toolbar flex h-10 items-center gap-1 rounded-lg px-4 text-[13px] font-semibold text-white"
      >
        <span className="text-base leading-none">+</span> New
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="New set"
          className="dropdown-panel animate-fade-up absolute right-0 top-full z-[100] mt-2 w-48 rounded-2xl p-1.5"
        >
          <button role="menuitem" className={itemClass} onClick={() => { close(); onNew(); }}>
            <span aria-hidden>✏️</span> New set
          </button>
          <button role="menuitem" className={itemClass} onClick={() => { close(); onImport(); }}>
            <span aria-hidden>⬆</span> Import (JSON)
          </button>
        </div>
      )}
    </div>
  );
}
