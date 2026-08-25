'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { shareUrlForSet } from '@/lib/sets/share';
import { useT } from '@/lib/i18n';
import useDialogA11y from '@/hooks/useDialogA11y';
import type { VocabSet } from '@/types/app';

interface Props {
  set: VocabSet;
  onClose: () => void;
}

const subscribeHydration = () => () => {};

export default function ShareSetModal({ set, onClose }: Props) {
  const t = useT();
  const mounted = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = shareUrlForSet(set);
  // The portal only renders once `mounted` is true; keep the dialog hook on
  // the same lifecycle by gating it with the mounted flag.
  const dialogRef = useDialogA11y<HTMLDivElement>(mounted, onClose);

  useEffect(() => {
    let active = true;
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#090b14', light: '#ffffff' },
        }),
      )
      .then((dataUrl) => {
        if (active) setQr(dataUrl);
      })
      .catch(() => {
        if (active) setQrError(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t('library.share.promptCopy'), url);
    }
  }, [url, t]);

  const share = useCallback(async () => {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: set.name,
        text: t('library.share.nativeText', { name: set.name }),
        url,
      });
    } catch {
      // User cancellation is not an error that needs UI.
    }
  }, [copy, set.name, url, t]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[130] flex overflow-y-auto bg-night-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-set-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass animate-fade-up m-auto w-full max-w-lg rounded-3xl border border-white/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-cyan">{t('library.share.set')}</p>
            <h2 id="share-set-title" className="mt-1 truncate text-xl font-bold text-white">{set.name}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {t('library.share.privacyLine', { count: set.words.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('library.share.closeAria')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
          <div className="mx-auto flex h-[180px] w-[180px] items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
            {qr ? (
              // Generated locally; no QR contents are sent to a third party.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={t('library.share.qrAlt', { name: set.name })} className="h-full w-full" />
            ) : qrError ? (
              <p className="px-3 text-center text-xs leading-relaxed text-slate-600">
                {t('library.share.qrTooLarge')}
              </p>
            ) : (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-white">{t('library.share.scanToImport')}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {t('library.share.recipientBody')}
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => void share()}
                className="min-h-11 rounded-xl bg-neon-cyan px-4 text-sm font-bold text-night-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                {t('library.share.set')}
              </button>
              <button
                type="button"
                onClick={() => void copy()}
                className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                {copied ? t('library.share.linkCopied') : t('library.share.copyLink')}
              </button>
              {qr && (
                <a
                  href={qr}
                  download={`${set.name.replace(/[^\w-]+/g, '-').toLowerCase()}-qr.png`}
                  className="min-h-10 rounded-xl px-4 py-2.5 text-center text-xs font-semibold text-slate-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  {t('library.share.downloadQr')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
