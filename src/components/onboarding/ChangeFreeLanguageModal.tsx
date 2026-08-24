'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { hideAllExcept, buildSeedSetForLang } from '@/lib/freeLang';
import { FREE_LANG_LIMIT } from '@/lib/plans';
import { seedSetForLang } from '@/lib/seedSets';
import { getAllSets } from '@/lib/db/indexedDb';
import { updateAccountPrefs } from '@/lib/accountPrefs';
import { useT } from '@/lib/i18n';
import type { VocabSet } from '@/types/app';
import FreeLanguagePicker from './FreeLanguagePicker';

interface Props {
  /** The user's CURRENT included language (normalized key), preselected. */
  currentKey: string | null;
  /** Unfiltered library (hidden sets included) so hiding is never lossy. */
  allSets: VocabSet[];
  /** saveSet from useLists — keeps the dashboard state in sync after seeding. */
  saveSet: (set: VocabSet) => Promise<VocabSet>;
  onClose: () => void;
}

/**
 * Lets a Free user switch their one included language. The new language is
 * seeded (idempotent — an existing set is never overwritten) and every OTHER
 * owned language is hidden via settings.hiddenLangs — never deleted, so an
 * upgrade restores them automatically. Enforcement stays in planGate.
 */
export default function ChangeFreeLanguageModal({ currentKey, allSets, saveSet, onClose }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const confirm = useCallback(
    async (key: string) => {
      if (busy || key === currentKey) {
        onClose();
        return;
      }
      setBusy(true);
      try {
        // Seed the newly chosen language idempotently: never overwrite a set
        // that already exists (would erase mastery marks).
        const seed = seedSetForLang(key);
        if (seed) {
          const existing = await getAllSets();
          if (!existing.some((s) => s.id === seed.id)) {
            const built = await buildSeedSetForLang(key);
            if (built) await saveSet(built);
          }
        }
        // Hide every OTHER owned language (normalized keys). Sets are kept in
        // IndexedDB — the useLists filter restores them on upgrade. The choice
        // goes to THIS account's prefs (guests: the global settings record) so
        // switching on one account never touches another account's language.
        const hide = hideAllExcept(allSets, key);
        updateAccountPrefs({ selectedFreeLang: key, hiddenLangs: hide });
        window.dispatchEvent(new Event('audiorepeat:data-changed'));
      } finally {
        setBusy(false);
        onClose();
      }
    },
    [busy, currentKey, allSets, saveSet, onClose],
  );

  const modal = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.changeLang.aria')}
    >
      <div className="glass animate-fade-up max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 sm:p-8">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('onboarding.changeLang.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">{t('onboarding.changeLang.body')}</p>
        <div className="mt-4">
          <FreeLanguagePicker
            pro={false}
            initialKey={currentKey}
            onContinue={(key) => void confirm(key)}
            subtitle={t(
              FREE_LANG_LIMIT === 1
                ? 'onboarding.changeLang.pickerSubtitle.one'
                : 'onboarding.changeLang.pickerSubtitle.other',
              { limit: FREE_LANG_LIMIT },
            )}
          />
        </div>
        {busy && (
          <p className="mt-3 text-center text-xs text-slate-500">
            {t('onboarding.changeLang.settingUp')}
          </p>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
