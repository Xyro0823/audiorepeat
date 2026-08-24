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
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
      aria-label={t('checkout.downgrade.aria')}
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
            <h2 className="mt-4 text-lg font-bold text-white">{t('checkout.downgrade.doneTitle')}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {t('checkout.downgrade.keptPrefix')}{' '}
              <span className="font-semibold text-neon-amber">{keep?.label}</span>
              {keep && keep.setCount > 1
                ? t('checkout.downgrade.setsWrap', {
                    sets: t('checkout.downgrade.sets.other', { count: keep.setCount }),
                  })
                : ''}
              .{' '}
              {hiddenLangsCount > 0 ? (
                <>
                  {hiddenLangsCount === 1
                    ? t('checkout.downgrade.hiddenLangs.one')
                    : t('checkout.downgrade.hiddenLangs.other', { count: hiddenLangsCount })}{' '}
                  {t('checkout.downgrade.setsWrap', {
                    sets: t(
                      hiddenSetsCount === 1
                        ? 'checkout.downgrade.sets.one'
                        : 'checkout.downgrade.sets.other',
                      { count: hiddenSetsCount },
                    ),
                  })}
                  {t('checkout.downgrade.hiddenNote')}
                </>
              ) : (
                t('checkout.downgrade.nothingHidden')
              )}
            </p>
            <button
              onClick={onClose}
              className="btn-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-7 text-sm font-semibold text-white"
            >
              {t('common.done')}
            </button>
          </div>
        ) : langs.length <= FREE_LANG_LIMIT ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
              📚
            </span>
            <h2 className="mt-4 text-lg font-bold text-white">{t('checkout.downgrade.withinLimit.title')}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {t(
                FREE_LANG_LIMIT === 1
                  ? 'checkout.downgrade.withinLimit.body.one'
                  : 'checkout.downgrade.withinLimit.body.other',
                { limit: FREE_LANG_LIMIT },
              )}
            </p>
            <button
              onClick={onClose}
              className="btn-clean mt-6 inline-flex h-11 items-center justify-center rounded-xl px-7 text-sm font-semibold text-white"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{t('checkout.downgrade.title')}</h2>
              <button
                onClick={onClose}
                aria-label={t('common.close')}
                className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {t(
                FREE_LANG_LIMIT === 1
                  ? 'checkout.downgrade.intro.one'
                  : 'checkout.downgrade.intro.other',
                { limit: FREE_LANG_LIMIT },
              )}
              {t('checkout.downgrade.introMiddle')}{' '}
              <span className="text-slate-200">{t('checkout.downgrade.hiddenBold')}</span>
              {t('checkout.downgrade.introSuffix')}
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
                        {t('checkout.downgrade.langMeta', {
                          sets: t(
                            l.setCount === 1
                              ? 'checkout.downgrade.sets.one'
                              : 'checkout.downgrade.sets.other',
                            { count: l.setCount },
                          ),
                          words: `${l.wordCount} ${t('common.words')}`,
                        })}
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
                  {t('checkout.downgrade.keepPrefix')}{' '}
                  <span className="font-semibold text-white">{keep.label}</span>{' '}
                  {t(
                    hiddenLangsCount === 1
                      ? 'checkout.downgrade.keepSuffix.one'
                      : 'checkout.downgrade.keepSuffix.other',
                    {
                      count: hiddenLangsCount,
                      sets: t(
                        hiddenSetsCount === 1
                          ? 'checkout.downgrade.sets.one'
                          : 'checkout.downgrade.sets.other',
                        { count: hiddenSetsCount },
                      ),
                    },
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-500">{t('checkout.downgrade.selectPrompt')}</p>
              )}
              <button
                onClick={confirm}
                disabled={!keep}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-4 py-2.5 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('checkout.downgrade.confirmCta')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
