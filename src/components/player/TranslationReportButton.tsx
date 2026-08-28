'use client';

import { useState } from 'react';
import { getAuthIdToken } from '@/lib/authStore';
import { useT } from '@/lib/i18n';

export default function TranslationReportButton({ language, target, translation }: { language: string; target: string; translation: string }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  async function report() {
    const suggestion = window.prompt(t('player.translationReport.prompt'), translation)?.trim();
    if (!suggestion || suggestion === translation) return;
    const token = await getAuthIdToken().catch(() => null);
    if (!token) { setState('error'); return; }
    const response = await fetch('/api/translation-reports', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ language, target, currentTranslation: translation, suggestion }) });
    setState(response.ok ? 'sent' : 'error');
  }
  if (state === 'sent') return <p className="mt-5 text-xs font-semibold text-neon-green">{t('player.translationReport.sent')}</p>;
  return <button type="button" onClick={() => void report()} className="mt-5 min-h-10 rounded-full border border-white/10 px-3 text-xs font-semibold text-slate-500 transition hover:border-neon-violet/50 hover:text-neon-violet">{state === 'error' ? t('player.translationReport.error') : t('player.translationReport.action')}</button>;
}
