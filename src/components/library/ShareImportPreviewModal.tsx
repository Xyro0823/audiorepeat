'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, BookOpenText, ShieldCheck, X } from 'lucide-react';
import { flagFor } from '@/components/LanguageBadge';
import { findLanguage } from '@/lib/languages';
import type { SharedSetPreview } from '@/lib/sets/shareImport';
import { useT } from '@/lib/i18n';
import type { VocabSet } from '@/types/app';

interface Props {
  preview: SharedSetPreview;
  duplicate?: VocabSet | null;
  onConfirm: (set: VocabSet) => void | Promise<void>;
  onClose: () => void;
}

const subscribeHydration = () => () => {};
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function languageLabel(code: string): string {
  return findLanguage(code)?.label ?? code;
}

export default function ShareImportPreviewModal({
  preview,
  duplicate = null,
  onConfirm,
  onClose,
}: Props) {
  const t = useT();
  const mounted = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (!busyRef.current) onCloseRef.current();
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (activeElement === dialogRef.current || !dialogRef.current.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mounted, requestClose]);

  const confirm = async () => {
    if (busyRef.current || duplicate) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(preview.set);
      onCloseRef.current();
    } catch {
      if (activeRef.current) {
        busyRef.current = false;
        setBusy(false);
        setError(t('library.importPreview.importError'));
      }
    }
  };

  if (!mounted) return null;

  const titleId = 'share-import-title';
  const descriptionId = 'share-import-description';
  const targetLabel = languageLabel(preview.targetLang);
  const nativeLabel = languageLabel(preview.nativeLang);

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-end overflow-y-auto bg-black/75 sm:items-center sm:justify-center sm:p-4 sm:backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="dropdown-panel animate-fade-up flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] focus:outline-none sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-[28px]"
      >
        <div className="h-1 shrink-0 bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-green" />

        <header className="flex shrink-0 items-start gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan">
            <BookOpenText className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-cyan">
              {t('library.importPreview.eyebrow')}
            </p>
            <h2 id={titleId} className="mt-1 break-words text-xl font-bold leading-tight text-white">
              {preview.name}
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-slate-400">
              {t('library.importPreview.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label={t('library.importPreview.closeAria')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-wait disabled:opacity-40"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <section aria-label={t('library.importPreview.detailsAria')} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="min-w-0 text-center sm:text-left">
                <span className="text-2xl leading-none" aria-hidden>{flagFor(preview.targetLang) ?? '🌐'}</span>
                <p className="mt-2 truncate text-sm font-semibold text-white" title={targetLabel}>{targetLabel}</p>
                <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">{t('library.importPreview.learn')}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-night-900 text-slate-400">
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 text-center sm:text-right">
                <span className="text-2xl leading-none" aria-hidden>{flagFor(preview.nativeLang) ?? '🌐'}</span>
                <p className="mt-2 truncate text-sm font-semibold text-white" title={nativeLabel}>{nativeLabel}</p>
                <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">{t('library.importPreview.translation')}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4 sm:justify-start">
              <span className="rounded-lg bg-neon-cyan/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-neon-cyan">
                {t('library.wordsCount', { count: preview.wordCount })}
              </span>
              {preview.cefr && (
                <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  {t('library.importPreview.cefrLevel', { level: preview.cefr })}
                </span>
              )}
            </div>
          </section>

          <section aria-labelledby="sample-words-title" className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <h3 id="sample-words-title" className="text-sm font-semibold text-white">{t('library.importPreview.sampleWords')}</h3>
              <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t('library.importPreview.previewOnly')}</span>
            </div>
            <div className="mt-2 overflow-hidden rounded-2xl border border-white/10">
              {preview.samples.map((sample, index) => (
                <div
                  key={`${sample.target}\u0000${sample.translation}\u0000${index}`}
                  className="grid min-w-0 grid-cols-2 gap-3 border-b border-white/10 px-3.5 py-3 last:border-b-0 sm:gap-6 sm:px-4"
                >
                  <p className="min-w-0 break-words text-sm font-semibold text-white">{sample.target}</p>
                  <p className="min-w-0 break-words text-sm text-slate-400">{sample.translation}</p>
                </div>
              ))}
            </div>
            {preview.remainingWordCount > 0 && (
              <p className="mt-2 text-center text-xs text-slate-500">
                {t('library.importPreview.moreWords', { count: preview.remainingWordCount.toLocaleString() })}
              </p>
            )}
          </section>

          <div className="mt-5 flex gap-3 rounded-2xl border border-neon-green/20 bg-neon-green/[0.06] p-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neon-green" aria-hidden />
            <p className="text-xs leading-relaxed text-slate-400">
              {t('library.importPreview.privacyNote')}
            </p>
          </div>

          {duplicate && (
            <div role="status" className="mt-4 flex gap-3 rounded-2xl border border-neon-amber/30 bg-neon-amber/[0.08] p-3.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-neon-amber" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-white">{t('library.importPreview.duplicateTitle')}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {t('library.importPreview.duplicateBody', { name: duplicate.name })}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-neon-magenta/30 bg-neon-magenta/10 px-3.5 py-3 text-sm text-neon-magenta">
              {error}
            </p>
          )}
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-night-900/95 px-5 py-4 sm:flex sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            className={`${duplicate ? 'col-span-2 sm:col-span-1' : ''} min-h-11 rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-wait disabled:opacity-40`}
          >
            {duplicate ? t('common.close') : t('common.cancel')}
          </button>
          {!duplicate && (
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="min-h-11 rounded-xl bg-neon-cyan px-5 text-sm font-bold text-night-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-900 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? t('library.importPreview.importing') : t('library.importPreview.importSet')}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
