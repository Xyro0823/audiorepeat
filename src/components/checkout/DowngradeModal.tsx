'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { flagFor } from '@/components/LanguageBadge';
import { useLists } from '@/hooks/useLists';
import { findLanguage } from '@/lib/languages';
import { updateAccountPrefs } from '@/lib/accountPrefs';
import { FREE_LANG_LIMIT } from '@/lib/plans';
import { updateSettings } from '@/lib/settingsStore';
import { PACK_LANG } from '@/lib/starterSets';

interface Props {
  onClose: () => void;
}

interface LangEntry {
  key: string; // normalized limit key, e.g. "es"
  raw: string; // a representative BCP-47 tag for the label/flag
  label: string;
  setCount: number;
  wordCount: number;
}

/**
 * Downgrade-to-Free flow with language choice. Free includes one active
 * language (FREE_LANG_LIMIT); the user picks which one to keep and every
 * other language is
 * HIDDEN (not deleted — hidden sets return automatically on upgrade). This is
 * the explicit sign-off path for the "retroactive enforcement" caveat: unlike
 * a fresh install (which only seeds the first language), a downgrade has to
 * deal with sets the user already owns, and hiding beats destroying data.
 */
export default function DowngradeModal({ onClose }: Props) {
  const { sets } = useLists();
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Group the user's visible languages by the normalized limit key, so a
  // language split across seed (BCP-47, e.g. "es-ES") and topic-pack (bare
  // code, "es") sets counts once and hides together.
  const langs = useMemo<LangEntry[]>(() => {
    const map = new Map<string, LangEntry>();
    for (const s of sets) {
      const key = PACK_LANG[s.lang] ?? s.lang;
      const existing = map.get(key);
      if (existing) {
        existing.setCount += 1;
        existing.wordCount += s.words.length;
      } else {
        map.set(key, {
          key,
          raw: s.lang,
          label: findLanguage(s.lang)?.label ?? s.lang,
          setCount: 1,
          wordCount: s.words.length,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => b.setCount - a.setCount || b.wordCount - a.wordCount,
    );
  }, [sets]);

  const keep = langs.find((l) => l.key === selected) ?? null;
  const hiddenLangsCount = keep ? langs.length - 1 : 0;
  const hiddenSetsCount = keep
    ? sets.filter((s) => (PACK_LANG[s.lang] ?? s.lang) !== keep.key).length
    : 0;

  const confirm = () => {
    if (!keep) return;
    // The plan itself stays in the (device-global) settings record — that is
    // the shipped architecture; the entitlement mirror re-verifies it from
    // /api/entitlement. The kept language + hidden set are ACCOUNT-SCOPED:
    // signed-in users write their own uid record, guests the global settings
    // record, so one account's downgrade never alters another's language.
    updateSettings({ plan: 'basic', planBilling: 'annual' });
    updateAccountPrefs({
      selectedFreeLang: keep.key,
      hiddenLangs: langs.filter((l) => l.key !== keep.key).map((l) => l.key),
    });
    setDone(true);
  };

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Switch to the Free plan"
    >
      <div className="glass animate-fade-up w-full max-w-md rounded-3xl p-6">
        {done ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-neon-green/40 bg-neon-green/10">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-neon-green"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <h2 className="mt-4 text-lg font-bold text-white">Free plan active</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              You&apos;re keeping <span className="font-semibold text-neon-amber">{keep?.label}</span>
              {keep && keep.setCount > 1 ? ` (${keep.setCount} sets)` : ''}.{' '}
              {hiddenLangsCount > 0 ? (
                <>
                  {hiddenLangsCount === 1
                    ? '1 other language was hidden'
                    : `${hiddenLangsCount} other languages were hidden`}{' '}
                  ({hiddenSetsCount} set{hiddenSetsCount === 1 ? '' : 's'}) — nothing was
                  deleted, and they&apos;ll come back automatically if you upgrade again.
                </>
              ) : (
                'Nothing was hidden.'
              )}
            </p>
            <button
              onClick={onClose}
              className="btn-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-7 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : langs.length <= FREE_LANG_LIMIT ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
              📚
            </span>
            <h2 className="mt-4 text-lg font-bold text-white">Already within the limit</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              Your library already uses a single language, so there&apos;s nothing to hide.
              The Free plan includes {FREE_LANG_LIMIT} active language
              {FREE_LANG_LIMIT === 1 ? '' : 's'}.
            </p>
            <button
              onClick={onClose}
              className="btn-clean mt-6 inline-flex h-11 items-center justify-center rounded-xl px-7 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Switch to the Free plan</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Free includes {FREE_LANG_LIMIT} active language
              {FREE_LANG_LIMIT === 1 ? '' : 's'}. Pick the language you want to keep —
              sets in other languages are <span className="text-slate-200">hidden, not deleted</span>,
              and return automatically if you upgrade again.
            </p>

            <div className="mt-4 max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
              {langs.map((l) => {
                const active = selected === l.key;
                return (
                  <button
                    key={l.key}
                    onClick={() => setSelected(l.key)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                      active
                        ? 'border-neon-cyan/60 bg-neon-cyan/10 ring-1 ring-neon-cyan/50'
                        : 'border-white/10 bg-night-800/60 hover:border-white/25'
                    }`}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {flagFor(l.raw) ?? '🌐'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{l.label}</span>
                      <span className="block text-[11px] text-slate-500">
                        {l.setCount} set{l.setCount === 1 ? '' : 's'} · {l.wordCount} words
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        active ? 'border-neon-cyan bg-neon-cyan' : 'border-white/20'
                      }`}
                      aria-hidden
                    >
                      {active && (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3 text-night-950"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-night-900/50 p-3">
              {keep ? (
                <p className="text-xs leading-relaxed text-slate-400">
                  Keep <span className="font-semibold text-white">{keep.label}</span> and hide{' '}
                  {hiddenLangsCount} other language
                  {hiddenLangsCount === 1 ? '' : 's'} ({hiddenSetsCount} set
                  {hiddenSetsCount === 1 ? '' : 's'}). Your streaks, stats and word mastery are
                  kept.
                </p>
              ) : (
                <p className="text-xs text-slate-500">Select a language to continue.</p>
              )}
              <button
                onClick={confirm}
                disabled={!keep}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-4 py-2.5 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm — switch to Free
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
