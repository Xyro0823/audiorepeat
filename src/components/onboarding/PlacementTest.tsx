'use client';

import { useEffect, useState } from 'react';
import { createPlacementQuestions, placementLevelForScore, type PlacementQuestion } from '@/lib/placementTest';
import type { CefrLevel } from '@/types/app';
import { useT } from '@/lib/i18n';

function createAttemptId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

export default function PlacementTest({ lang, onComplete, onBack }: { lang: string; onComplete: (level: CefrLevel) => void; onBack: () => void }) {
  const t = useT();
  const [questions, setQuestions] = useState<PlacementQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [attemptId] = useState(createAttemptId);

  useEffect(() => {
    let active = true;
    void createPlacementQuestions(lang, attemptId).then((next) => {
      if (active) setQuestions(next);
    }).catch(() => {
      if (active) setQuestions([]);
    });
    return () => { active = false; };
  }, [attemptId, lang]);

  if (questions === null) {
    return <p className="py-12 text-center text-sm text-slate-400" aria-live="polite">{t('onboarding.placement.loading')}</p>;
  }

  if (questions.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm leading-6 text-slate-400">{t('onboarding.level.selfAssessment')}</p>
        <button type="button" onClick={onBack} className="mt-5 min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">{t('onboarding.back')}</button>
      </div>
    );
  }

  if (index >= questions.length) {
    const score = answers.reduce((total, answer, answerIndex) => total + Number(answer === questions[answerIndex]?.answer), 0);
    const level = placementLevelForScore(score);
    return (
      <div className="py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neon-cyan">{t('onboarding.placement.resultKicker')}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">{level}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{t('onboarding.placement.resultBody', { score, total: questions.length })}</p>
        <button type="button" onClick={() => onComplete(level)} className="btn-primary mt-6 min-h-12 w-full rounded-xl px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">{t('onboarding.placement.useLevel', { level })}</button>
        <button type="button" onClick={onBack} className="mt-3 min-h-11 text-sm font-semibold text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">{t('onboarding.placement.chooseManually')}</button>
      </div>
    );
  }

  const question = questions[index];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{t('onboarding.placement.questionCount', { current: index + 1, total: questions.length })}</span><span>{question.level}</span></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-[width]" style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
      <h2 className="mt-8 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">{question.meaning}</h2>
      <p className="mt-2 text-center text-sm text-slate-400">{t('onboarding.placement.prompt')}</p>
      <div className="mt-6 grid gap-2" role="radiogroup" aria-label={t('onboarding.placement.answersAria')}>
        {question.options.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={selected === option} onClick={() => setSelected(option)} className={`min-h-12 rounded-xl border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${selected === option ? 'border-neon-cyan/60 bg-neon-cyan/10 text-white' : 'border-white/10 bg-night-800/60 text-slate-300 hover:border-white/25'}`}>{option}</button>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">{t('onboarding.back')}</button>
        <button type="button" disabled={!selected} onClick={() => { if (selected) { setAnswers((current) => [...current, selected]); setSelected(null); setIndex((current) => current + 1); } }} className="btn-primary min-h-11 flex-1 rounded-xl px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">{t('common.continue')}</button>
      </div>
      <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">{t('onboarding.placement.note')}</p>
    </div>
  );
}
