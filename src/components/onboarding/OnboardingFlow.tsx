'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { flagFor } from '@/components/LanguageBadge';
import { useAuth } from '@/hooks/useAuth';
import {
  buildRecommendedSet,
  findRecommendedSet,
  recommendFirstPractice,
  recommendationIdOf,
  type FirstPracticeRecommendation,
} from '@/lib/firstPractice';
import { fireOnboardingEvent } from '@/lib/analytics/client';
import { buildSeedSetForLang, hideAllExcept, seedCodeForLangKey } from '@/lib/freeLang';
import { seedSetForLang } from '@/lib/seedSets';
import { findLanguage } from '@/lib/languages';
import { getTopicManifest, getWordBankManifest } from '@/lib/vocab/wordBanks';
import {
  ONBOARDING_GOALS,
  ONBOARDING_LEVELS,
  completeOnboarding,
  getOnboardingPendingVersion,
  readOnboardingRecord,
  readOnboardingPending,
  saveOnboardingRecord,
  shouldShowOnboarding,
  subscribeOnboardingPending,
  type GoalId,
  type OnboardingRecord,
} from '@/lib/onboarding';
import { getSettingsSnapshot, subscribeSettings } from '@/lib/settingsStore';
import { useT, type TKey } from '@/lib/i18n';
import { updateAccountPrefs } from '@/lib/accountPrefs';
import { isProPlan } from '@/lib/plans';
import { getAllSets, putSet } from '@/lib/db/indexedDb';
import type { CefrLevel } from '@/types/app';
import FreeLanguagePicker from './FreeLanguagePicker';

type Step = 1 | 2 | 3 | 4;

const STEP_TITLE_KEYS: Record<Step, TKey> = {
  1: 'onboarding.step.title.language',
  2: 'onboarding.step.title.level',
  3: 'onboarding.step.title.goal',
  4: 'onboarding.step.title.ready',
};

/**
 * First-time onboarding: language → level → goal → ready. Mounted at the app
 * level (layout) so it appears over ANY route for a fresh account.
 *
 * State is scoped per account in localStorage (lib/onboarding): the pending
 * marker is set the moment the account is created (auth store), the flow saves
 * a partial record after every step so a refresh resumes mid-flow, and
 * completion writes a versioned record that permanently suppresses it. Existing
 * accounts (no pending marker) never see it, and switching accounts re-mounts
 * this component (keyed by uid) so no other user's state leaks in.
 *
 * On "Start practicing": the chosen language's starter set is seeded
 * idempotently (never overwriting an existing set — a no-op for Pro installs,
 * which already seeded everything) and the user lands in the player.
 */
export default function OnboardingFlow() {
  const { status, user } = useAuth();
  // Only signed-in accounts onboard (guests keep the old experience).
  if (status !== 'signed-in' || !user) return null;
  return <OnboardingFlowInner key={user.id} uid={user.id} />;
}

function OnboardingFlowInner({ uid }: { uid: string }) {
  const router = useRouter();
  const t = useT();
  // Plan-aware: Pro/Lifetime accounts see an unrestricted language step (no
  // locks) and still record a preferred language. Settings hydrate asynchron
  // (entitlement sync / IndexedDB), so the picker upgrades in place if needed.
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
  const pro = isProPlan(settings.plan);
  // Visibility is DERIVED from the per-uid pending marker + completion record
  // (not local state): the marker can land a beat after the auth listener
  // mounts this flow on signup, and completion clears it — both cases re-read
  // via the observable pending-version store, so a brand-new account always
  // sees onboarding and an existing account never does.
  useSyncExternalStore(subscribeOnboardingPending, getOnboardingPendingVersion, getOnboardingPendingVersion);
  const record = readOnboardingRecord(uid);
  const visible = shouldShowOnboarding(readOnboardingPending(uid), record);

  const [step, setStep] = useState<Step>(() =>
    record?.lang && record.level && record.goal ? 4 : record?.lang && record.level ? 3 : record?.lang ? 2 : 1,
  );
  const [lang, setLang] = useState<string | null>(record?.lang ?? null);
  const [level, setLevel] = useState<CefrLevel | null>(record?.level ?? null);
  const [goal, setGoal] = useState<GoalId | null>(record?.goal ?? null);
  const [finishing, setFinishing] = useState(false);
  // Personalized first-session recommendation, computed once the manifests are
  // available. Until then the seed-based fallback is shown, so the Ready step
  // is never blank and never dead-ends.
  const [recommendation, setRecommendation] = useState<FirstPracticeRecommendation | null>(null);

  useEffect(() => {
    if (!lang || !level || !goal) return;
    let alive = true;
    void (async () => {
      let availableBanks = null;
      let availableTopics = null;
      try {
        availableBanks = await getWordBankManifest();
      } catch {
        /* offline — recommendation falls back to the seed */
      }
      try {
        availableTopics = await getTopicManifest();
      } catch {
        /* offline — topic recommendations unavailable */
      }
      if (!alive) return;
      setRecommendation(
        recommendFirstPractice({ lang, level, goal, availableBanks, availableTopics }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [lang, level, goal]);

  // Fallback shown immediately (and used if the manifest fetch fails): with no
  // manifests the pure helper always lands on the curated seed. Null only when
  // the flow hasn't reached a full selection yet (step < 4).
  const shownRecommendation: FirstPracticeRecommendation | null =
    recommendation ??
    (lang && level && goal
      ? recommendFirstPractice({ lang, level, goal, availableBanks: null, availableTopics: null })
      : null);

  // ready_viewed fires once per arrival at the Ready step — never on rerenders
  // (ref guard) and never on a refresh that RESUMES straight onto Ready
  // (mountedAtReady), so the funnel isn't inflated by reloads.
  const mountedAtReady = useRef(step === 4);
  const readyFiredRef = useRef(false);

  useEffect(() => {
    if (step !== 4) {
      readyFiredRef.current = false;
      return;
    }
    if (mountedAtReady.current) return;
    if (!recommendation || readyFiredRef.current) return;
    readyFiredRef.current = true;
    fireOnboardingEvent('onboarding_ready_viewed', {
      language: lang ?? '',
      level: level ?? 'A1',
      goal: goal ?? 'general',
      recommendationType: recommendation.type,
      recommendationId: recommendationIdOf(recommendation),
    });
  }, [step, recommendation, lang, level, goal]);

  const save = useCallback(
    (patch: OnboardingRecord) => saveOnboardingRecord(uid, patch),
    [uid],
  );

  const pickLang = useCallback(
    (key: string) => {
      setLang(key);
      save({ lang: key });
      setStep(2);
      // User-action events — one per click, never inflated by rerenders.
      fireOnboardingEvent('onboarding_language_selected', { language: key });
    },
    [save],
  );

  const pickLevel = useCallback(
    (l: CefrLevel) => {
      setLevel(l);
      save({ level: l });
      setStep(3);
      if (lang) {
        fireOnboardingEvent('onboarding_level_selected', { language: lang, level: l });
      }
    },
    [save, lang],
  );

  const pickGoal = useCallback(
    (g: GoalId) => {
      setGoal(g);
      save({ goal: g });
      setStep(4);
      if (lang && level) {
        fireOnboardingEvent('onboarding_goal_selected', { language: lang, level, goal: g });
      }
    },
    [save, lang, level],
  );

  const finish = useCallback(
    async (start: boolean) => {
      if (!lang || !level || !goal || finishing) return;
      setFinishing(true);
      try {
        // Seed the chosen language's starter content, idempotently: never touch
        // a set that already exists (would erase mastery marks), and never seed
        // the old Spanish default merely because it used to be the default.
        const existing = await getAllSets();
        const seed = seedSetForLang(lang);
        if (seed && !existing.some((s) => s.id === seed.id)) {
          const built = await buildSeedSetForLang(lang);
          if (built) await putSet(built);
        }
        // Re-read so the idempotency check sees the freshly seeded card.
        const current = await getAllSets();

        // Recommended first session: reuse an existing equivalent set when one
        // already exists (never duplicate), otherwise build it from the bank or
        // topic data. Any failure falls back to the starter seed — the start
        // action never dead-ends. The recommendation is deterministic and
        // computed once so the analytics events always match what was opened.
        let openId: string | null = null;
        const rec =
          shownRecommendation ??
          recommendFirstPractice({ lang, level, goal, availableBanks: null, availableTopics: null });
        if (start) {
          if (rec.type !== 'seed') {
            const reuse = findRecommendedSet(current, rec);
            if (reuse) {
              openId = reuse.id;
            } else {
              const built = await buildRecommendedSet(rec);
              if (built) {
                await putSet(built);
                openId = built.id;
              }
            }
          }
          // Never dead-end: any failure (or a seed recommendation) falls back
          // to the starter seed. "Go to dashboard" (start=false) skips all of
          // this and lands on the dashboard.
          openId ??= seed?.id ?? null;
          fireOnboardingEvent('onboarding_recommended_practice_started', {
            language: lang,
            level,
            goal,
            recommendationType: rec.type,
            recommendationId: recommendationIdOf(rec),
          });
          fireOnboardingEvent('onboarding_completed', {
            language: lang,
            level,
            goal,
            completionAction: 'practice',
          });
        } else {
          fireOnboardingEvent('onboarding_dashboard_skipped', {
            language: lang,
            level,
            goal,
            recommendationType: rec.type,
          });
          fireOnboardingEvent('onboarding_completed', {
            language: lang,
            level,
            goal,
            completionAction: 'dashboard',
          });
        }

        // Persist the choice through the ACCOUNT-scoped prefs store (normalized
        // pack key — planGate.canUseLang enforces it for Free; harmless for Pro).
        // Onboarding only runs for signed-in accounts, so this always writes the
        // uid's own record — never another account's, and never the guest's
        // global settings. For Free, every OTHER owned language (e.g. device-
        // level sets inherited from an earlier guest session) is hidden — never
        // deleted — so the library matches the one-language plan. Pro keeps
        // everything visible.
        const proNow = isProPlan(getSettingsSnapshot().plan);
        updateAccountPrefs(
          proNow
            ? { selectedFreeLang: lang }
            : { selectedFreeLang: lang, hiddenLangs: hideAllExcept(current, lang) },
        );
        // Completing clears the pending marker (and bumps the observable store),
        // which hides the overlay automatically — no local state flip needed.
        completeOnboarding(uid, { lang, level, goal });
        // Notify any mounted library so it picks up the new seed immediately.
        window.dispatchEvent(new Event('audiorepeat:data-changed'));
        router.push(openId ? `/player?id=${openId}` : '/dashboard');
      } finally {
        setFinishing(false);
      }
    },
    [lang, level, goal, finishing, uid, router, shownRecommendation],
  );

  if (!visible) return null;

  const langLabel = lang ? findLanguage(seedCodeForLangKey(lang) ?? lang)?.label ?? lang : null;
  const levelLabel = level ? ONBOARDING_LEVELS.find((o) => o.level === level)?.label : null;
  const goalLabel = goal ? ONBOARDING_GOALS.find((o) => o.id === goal)?.label : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex overflow-y-auto bg-night-950/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.aria.title')}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-neon-cyan/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-neon-violet/15 blur-3xl" />

      <div className="glass animate-fade-up m-auto w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(34,228,255,0.12)]">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {([1, 2, 3, 4] as const).map((s) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full transition ${
                s <= step ? 'bg-gradient-to-r from-neon-cyan to-neon-violet' : 'bg-white/10'
              }`}
              aria-hidden
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('onboarding.step.count', { step, total: 4 })} · {t(STEP_TITLE_KEYS[step])}
        </p>

        <div className="mt-5">
          {step === 1 && <FreeLanguagePicker pro={pro} initialKey={lang} onContinue={pickLang} />}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">{t('onboarding.level.heading')}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {t('onboarding.level.sub')}
              </p>
              <div className="mt-5 space-y-2" role="radiogroup" aria-label={t('onboarding.level.groupAria')}>
                {ONBOARDING_LEVELS.map((o) => {
                  const active = level === o.level;
                  return (
                    <button
                      key={o.level}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickLevel(o.level)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                        active
                          ? 'border-neon-cyan/60 bg-neon-cyan/10 ring-1 ring-neon-cyan/50'
                          : 'border-white/10 bg-night-800/60 hover:border-white/25'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                          active ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        {o.level}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">{o.label}</span>
                        <span className="block text-[11px] text-slate-500">{o.description}</span>
                      </span>
                      <span
                        className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
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
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  {t('onboarding.back')}
                </button>
                <button
                  type="button"
                  onClick={() => level && setStep(3)}
                  disabled={!level}
                  className="flex-1 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet py-3 text-sm font-bold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('common.continue')}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">{t('onboarding.goal.heading')}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {t('onboarding.goal.sub')}
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('onboarding.goal.groupAria')}>
                {ONBOARDING_GOALS.map((o) => {
                  const active = goal === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickGoal(o.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                        active
                          ? 'border-neon-violet/60 bg-neon-violet/10 ring-1 ring-neon-violet/50'
                          : 'border-white/10 bg-night-800/60 hover:border-white/25'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{o.label}</span>
                        <span className="block text-[11px] text-slate-500">{o.description}</span>
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                          active ? 'border-neon-violet bg-neon-violet' : 'border-white/20'
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
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  {t('onboarding.back')}
                </button>
                <button
                  type="button"
                  onClick={() => goal && setStep(4)}
                  disabled={!goal}
                  className="flex-1 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet py-3 text-sm font-bold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('common.continue')}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#141433] to-night-950 text-3xl shadow-[0_0_30px_rgba(34,228,255,0.25)]">
                <span aria-hidden>{lang ? flagFor(seedCodeForLangKey(lang) ?? lang) ?? '🌐' : '🌐'}</span>
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">{t('onboarding.ready.heading')}</h2>
              <p className="mt-1.5 text-sm text-slate-400">{t('onboarding.ready.planIntro')}</p>

              <dl className="mx-auto mt-5 max-w-sm space-y-2.5 text-left">
                {[
                  { label: t('onboarding.summary.language'), value: langLabel },
                  { label: t('onboarding.summary.startingLevel'), value: levelLabel },
                  { label: t('onboarding.summary.goal'), value: goalLabel },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-night-900/50 px-4 py-2.5"
                  >
                    <dt className="text-xs uppercase tracking-wider text-slate-500">{row.label}</dt>
                    <dd className="text-sm font-semibold text-white">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Recommended first session — always present once step 4
                  renders (step 4 requires a full selection, so the fallback
                  recommendation is non-null by construction). */}
              {shownRecommendation && (
                <div className="mt-5 rounded-2xl border border-neon-cyan/25 bg-neon-cyan/[0.06] p-4 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neon-cyan/80">
                    {t('onboarding.ready.recommended')}
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-white">{shownRecommendation.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{shownRecommendation.reason}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => void finish(true)}
                disabled={finishing}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet py-3.5 text-sm font-bold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finishing ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night-950/30 border-t-night-950 align-middle" />
                ) : (
                  t('onboarding.ready.startPractice')
                )}
              </button>
              <button
                type="button"
                onClick={() => void finish(false)}
                disabled={finishing}
                className="mt-2.5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                {t('onboarding.ready.goDashboard')}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="mt-2 w-full text-xs font-medium text-slate-500 transition hover:text-slate-300"
              >
                {t('onboarding.back')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
