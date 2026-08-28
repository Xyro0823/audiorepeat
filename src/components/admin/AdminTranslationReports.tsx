'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminBackNav from '@/components/admin/AdminBackNav';
import { useAuth } from '@/hooks/useAuth';
import { getAuthIdToken } from '@/lib/authStore';

type AdminState = 'checking' | 'admin' | 'forbidden' | 'server-error';
type ReviewStatus = 'approved' | 'rejected';

type TranslationReport = {
  id: string;
  language: string;
  target: string;
  currentTranslation: string;
  suggestion: string;
  createdAt: string;
};

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-[#10101f] p-5">{children}</section>;
}

export default function AdminTranslationReports() {
  const { status, user } = useAuth();
  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [checkedUid, setCheckedUid] = useState<string | null>(null);
  const [reports, setReports] = useState<TranslationReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async (expectedUid: string): Promise<void> => {
    setLoadError(null);
    const token = await getAuthIdToken().catch(() => null);
    if (!token) {
      setCheckedUid(expectedUid);
      setAdminState('server-error');
      return;
    }
    try {
      const response = await fetch('/api/admin/translation-reports', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as { reports?: TranslationReport[] } | null;
      setCheckedUid(expectedUid);
      if (response.status === 403) {
        setAdminState('forbidden');
      } else if (response.ok && Array.isArray(data?.reports)) {
        setReports(data.reports);
        setAdminState('admin');
      } else {
        setLoadError('Саналуудыг одоогоор авч чадсангүй.');
        setAdminState('server-error');
      }
    } catch {
      setCheckedUid(expectedUid);
      setLoadError('Саналуудыг одоогоор авч чадсангүй.');
      setAdminState('server-error');
    }
  }, []);

  useEffect(() => {
    if (status !== 'signed-in' || !user) return;
    // Defer the fetch state transition until after this render is committed.
    const timer = window.setTimeout(() => void load(user.id), 0);
    return () => window.clearTimeout(timer);
  }, [status, user, load]);

  const review = useCallback(async (id: string, reviewStatus: ReviewStatus) => {
    setReviewingId(id);
    try {
      const token = await getAuthIdToken();
      const response = await fetch('/api/admin/translation-reports', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: reviewStatus }),
      });
      if (!response.ok) throw new Error('review-failed');
      setReports((current) => current.filter((report) => report.id !== id));
    } catch {
      setLoadError('Шийдвэр хадгалагдсангүй. Дахин оролдоно уу.');
    } finally {
      setReviewingId(null);
    }
  }, []);

  const visibleAdminState = user && checkedUid === user.id ? adminState : 'checking';
  if (status === 'loading' || (status === 'signed-in' && visibleAdminState === 'checking')) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
        <p className="text-sm text-slate-400">Админ эрх шалгаж байна…</p>
        <AdminBackNav />
      </main>
    );
  }

  if (status !== 'signed-in' || visibleAdminState === 'forbidden') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card>
          <h1 className="font-display text-xl font-bold text-white">Админ · Орчуулгын санал</h1>
          <p className="mt-3 text-sm text-neon-amber">Энэ хэсэг зөвхөн админ эрхтэй хэрэглэгчид нээлттэй.</p>
          <div className="mt-4"><AdminBackNav /></div>
        </Card>
      </main>
    );
  }

  if (visibleAdminState === 'server-error') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card>
          <h1 className="font-display text-xl font-bold text-white">Админ · Орчуулгын санал</h1>
          <p className="mt-3 text-sm text-slate-400">{loadError ?? 'Админ үйлчилгээ бэлэн биш байна.'}</p>
          <button type="button" onClick={() => user && void load(user.id)} className="mt-4 rounded-lg bg-neon-cyan px-4 py-2 text-sm font-semibold text-night-950">Дахин оролдох</button>
          <div className="mt-4"><AdminBackNav /></div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Админ · Орчуулгын санал</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Хэрэглэгчийн илгээсэн засварын саналыг энд хянаж шийднэ. Зөвшөөрсөн санал автоматаар үгийн санг өөрчлөхгүй.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => user && void load(user.id)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Шинэчлэх</button>
          <AdminBackNav />
        </div>
      </header>

      {loadError && <p role="alert" className="mb-4 text-sm text-neon-amber">{loadError}</p>}
      {reports.length === 0 ? (
        <Card><p className="text-sm text-slate-400">Шинэ орчуулгын санал алга байна.</p></Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const reviewing = reviewingId === report.id;
            return (
              <Card key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-neon-cyan">{report.language}</p>
                    <p className="mt-1 break-words text-lg font-semibold text-white">{report.target}</p>
                    <p className="mt-1 text-xs text-slate-500">Илгээсэн: {new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={reviewing} onClick={() => void review(report.id, 'rejected')} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50">Татгалзах</button>
                    <button type="button" disabled={reviewing} onClick={() => void review(report.id, 'approved')} className="rounded-lg bg-neon-green px-3 py-1.5 text-xs font-semibold text-night-950 disabled:opacity-50">Зөвшөөрөх</button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Одоогийн орчуулга</p>
                    <p className="mt-1 break-words text-sm text-slate-200">{report.currentTranslation}</p>
                  </div>
                  <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neon-green">Санал болгосон</p>
                    <p className="mt-1 break-words text-sm font-medium text-white">{report.suggestion}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
