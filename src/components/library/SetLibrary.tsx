'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Search } from 'lucide-react';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import { flagFor } from '@/components/LanguageBadge';
import StreakBadge from '@/components/StreakBadge';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useLists } from '@/hooks/useLists';
import { useLibraryMeta } from '@/hooks/useLibraryMeta';
import { formatDuration } from '@/lib/format';
import { findLanguage, LANGUAGES } from '@/lib/languages';
import { prewarmKey, requestSetPrewarm } from '@/lib/tts/cloudTts';
import { isIOSWebKit } from '@/lib/tts/speechSynthesisEngine';
import { isProPlan } from '@/lib/plans';
import { canUseLang as planGateCanUseLang } from '@/lib/planGate';
import { CEFR_META } from '@/lib/starterSets';
import { decodeSetFromUrl, shareUrlForSet } from '@/lib/sets/share';
import { downloadSet, parseSetJson } from '@/lib/sets/io';
import type { CefrLevel, VocabSet } from '@/types/app';
import CefrBadge from './CefrBadge';
import LeaderboardModal from './LeaderboardModal';
import NewSetButton from './NewSetButton';
import ProfileDropdown from '@/components/auth/ProfileDropdown';
import SetEditor from './SetEditor';
import SettingsButton from '@/components/settings/SettingsButton';
import SpeedChallenge from '../speed/SpeedChallenge';
import StarterLibraryModal from './StarterLibraryModal';
import SubtitleImportModal from './SubtitleImportModal';
import InstallAppButton from '@/components/pwa/InstallAppButton';
import AiAssistantButton from '@/components/dashboard/AiAssistantButton';
import AiInsightsCard from '@/components/dashboard/AiInsightsCard';
import FreePlanNotice from '@/components/dashboard/FreePlanNotice';
import MetricCards from '@/components/dashboard/MetricCards';
import WelcomeHero from '@/components/dashboard/WelcomeHero';

function Logo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-neon-violet" fill="currentColor">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
    </div>
  );
}

function languageLabel(code: string): string {
  return findLanguage(code)?.label ?? code;
}

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Deterministic hue per language code — tints cover gradients distinctively. */
function hueFor(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return h % 360;
}

function masteryPct(set: VocabSet): number {
  const total = set.words.length;
  if (total === 0) return 0;
  return Math.round((set.words.filter((w) => w.mastery === 'mastered').length / total) * 100);
}

function hardCount(set: VocabSet): number {
  return set.words.filter((w) => w.mastery === 'hard').length;
}

/** Small rounded flag tile — used for recent-set rows and cover accents. */
function MiniCover({ lang, className = '' }: { lang: string; className?: string }) {
  return (
    <span
      className={`cover-art inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ '--cover-hue': hueFor(lang) } as CSSProperties}
    >
      <span className="text-lg leading-none drop-shadow">{flagFor(lang) ?? '🌐'}</span>
    </span>
  );
}

function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div
        className="h-full rounded-full bg-neon-violet transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const CEFR_LABEL: Record<string, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-intermediate',
  C1: 'Advanced',
  C2: 'Proficiency',
};

/** Curated order of "featured" languages for the sidebar list. */
const FEATURED_LANGS = [
  'es-ES',
  'fr-FR',
  'ja-JP',
  'de-DE',
  'it-IT',
  'ko-KR',
  'zh-CN',
  'pt-BR',
  'ru-RU',
  'tr-TR',
];

/* ------------------------------------------------------------------ */
/* Featured spotlight card                                             */
/* ------------------------------------------------------------------ */

interface FeaturedCardProps {
  set: VocabSet;
  bookmarked: boolean;
  onBookmark: () => void;
  onPlay: () => void;
}

function FeaturedCard({ set, bookmarked, onBookmark, onPlay }: FeaturedCardProps) {
  const pct = masteryPct(set);
  const flag = flagFor(set.lang) ?? '🌐';

  return (
    <section className="glass-card animate-fade-up relative overflow-hidden rounded-3xl">
      {/* Ambient cover gradient + oversized flag watermark */}
      <div
        className="cover-art absolute inset-0"
        style={{ '--cover-hue': hueFor(set.lang) } as CSSProperties}
      />
      <div className="pointer-events-none absolute -right-6 -top-12 select-none text-[230px] leading-none opacity-[0.13]">
        {flag}
      </div>
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-neon-violet/20 blur-3xl" />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1 text-[11px] font-semibold text-neon-amber">
            <span aria-hidden>★</span> Editor&apos;s Pick
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-neon-cyan">
            <span aria-hidden>🎧</span> Native Speaker Audio
          </span>
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Featured set of the day
        </p>
        <h2 className="mt-1 max-w-xl text-2xl font-bold tracking-tight text-white md:text-3xl">
          {set.name}
        </h2>
        <p className="mt-1.5 text-sm text-slate-400">
          {languageLabel(set.lang)} → {languageLabel(set.nativeLang)} · {set.words.length} words
          {set.cefr ? ` · ${set.cefr} ${CEFR_LABEL[set.cefr]}` : ''}
        </p>
        <p className="mt-2.5 max-w-lg text-[13px] leading-relaxed text-slate-400">
          Loop, repeat, and retain {set.words.length} essential {languageLabel(set.lang)} words
          with hands-free audio drilling — perfect for commutes, chores, and winding down.
        </p>

        <div className="mt-5 max-w-md">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-medium text-slate-300">{pct}% mastered</span>
            <span>
              {set.words.filter((w) => w.mastery === 'mastered').length} words known
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-neon-violet shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onPlay}
            className="btn-primary flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
            Start Learning
          </button>
          <button
            onClick={onBookmark}
            className={`btn-clean flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-medium transition ${
              bookmarked ? 'text-neon-amber' : 'text-slate-300'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill={bookmarked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {bookmarked ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Portrait library card                                               */
/* ------------------------------------------------------------------ */

interface PortraitCardProps {
  set: VocabSet;
  index: number;
  pro: boolean;
  onPlay: () => void;
  onChallenge: () => void;
  onEdit: () => void;
  onExport: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function PortraitCard({
  set,
  index,
  pro,
  onPlay,
  onChallenge,
  onEdit,
  onExport,
  onShare,
  onDelete,
}: PortraitCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  const pct = masteryPct(set);
  const hard = hardCount(set);

  // Close the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    setConfirmDelete(false);
    fn();
  };

  const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition';

  return (
    <article
      ref={rootRef}
      className={`glass-card animate-fade-up relative flex flex-col rounded-2xl ${
        menuOpen ? 'z-40 border-white/25' : ''
      }`}
      style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
    >
      {/* Cover art */}
      <div
        className="cover-art relative aspect-[4/3] overflow-hidden rounded-t-2xl"
        style={{ '--cover-hue': hueFor(set.lang) } as CSSProperties}
      >
        <span className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-lg">
          {flagFor(set.lang) ?? '🌐'}
        </span>

        {set.cefr && (
          <span className="absolute left-3 top-3">
            <CefrBadge level={set.cefr} />
          </span>
        )}

        <span className="glass absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-200">
          {set.words.length} words
        </span>

        {/* Three-dots actions menu (dropdown renders outside the clipped cover) */}
        <button
          onClick={() => {
            setMenuOpen((o) => !o);
            setConfirmDelete(false);
          }}
          aria-label={`Actions for ${set.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="btn-clean absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          aria-label={`Actions for ${set.name}`}
          className="glass animate-fade-up absolute right-2.5 top-12 z-40 w-48 rounded-xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          <button
            role="menuitem"
            className={`${menuItem} text-neon-amber hover:bg-neon-amber/10`}
            onClick={run(onChallenge)}
          >
            <span aria-hidden>⚡</span> 1-Min challenge
            {!pro && (
              <span className="ml-auto rounded-full bg-neon-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-amber">
                Pro
              </span>
            )}
          </button>
          <button
            role="menuitem"
            className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
            onClick={run(onEdit)}
          >
            <span aria-hidden>✏️</span> Edit
          </button>
          <button
            role="menuitem"
            className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
            onClick={run(onExport)}
          >
            <span aria-hidden>⬇</span> Download JSON
          </button>
          {!set.id.startsWith('seed-') && (
            <button
              role="menuitem"
              className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
              onClick={run(onShare)}
            >
              <span aria-hidden>🔗</span> Copy share link
            </button>
          )}
          <div className="my-1 h-px bg-white/10" />
          {confirmDelete ? (
            <div className="rounded-lg bg-neon-magenta/10 p-1">
              <button
                role="menuitem"
                className={`${menuItem} text-neon-magenta hover:bg-neon-magenta/10`}
                onClick={run(onDelete)}
              >
                <span aria-hidden>🗑</span> Confirm delete
              </button>
              <button
                role="menuitem"
                className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              role="menuitem"
              className={`${menuItem} text-neon-magenta hover:bg-neon-magenta/10`}
              onClick={() => setConfirmDelete(true)}
            >
              <span aria-hidden>🗑</span> Delete
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-white">
          {set.name}
        </h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {languageLabel(set.lang)} → {languageLabel(set.nativeLang)}
          {set.settings ? ' · custom settings' : ''}
        </p>

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-500">{pct}% mastered</span>
            {hard > 0 && <span className="text-neon-amber">{hard} to review</span>}
          </div>
          <ProgressBar pct={pct} className="mt-1.5" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onPlay}
            className="btn-primary flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
            Play
          </button>
          <button
            onClick={onChallenge}
            title={pro ? 'Quick 1-minute speed test' : 'Speed challenges are a Pro feature'}
            className="btn-clean flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium text-slate-300"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5M9 2h6" />
            </svg>
            Quick Test
            {!pro && (
              <span className="rounded-full bg-neon-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-amber">
                Pro
              </span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

type ImportMsg = { kind: 'ok' | 'err'; text: string } | null;

export default function SetLibrary() {
  const { sets, loading, settings, saveSet, removeSet } = useLists();
  const { wordsToday, msToday, streak, week, recordWords } = usePracticeStats();
  const { recents, favorites, toggleFavorite } = useLibraryMeta();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<VocabSet | 'new' | null>(null);
  const [browse, setBrowse] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [subtitleImport, setSubtitleImport] = useState<{ fileName: string; text: string } | null>(
    null,
  );
  const [challengeSet, setChallengeSet] = useState<VocabSet | null>(null);
  const [importMsg, setImportMsg] = useState<ImportMsg>(null);
  const [pendingImport, setPendingImport] = useState<VocabSet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | 'all'>('all');
  const [langFilter, setLangFilter] = useState<string>('all');

  const flash = useCallback((msg: ImportMsg) => {
    setImportMsg(msg);
    if (msg) window.setTimeout(() => setImportMsg((m) => (m === msg ? null : m)), 4000);
  }, []);

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSetJson(text);
      if (!parsed) {
        flash({ kind: 'err', text: 'That file is not a valid AudioRepeat set.' });
        return;
      }
      await saveSet(parsed);
      flash({ kind: 'ok', text: `Imported "${parsed.name}" (${parsed.words.length} words).` });
    } catch {
      flash({ kind: 'err', text: 'Could not read that file.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubtitleFile = async (file: File) => {
    try {
      const text = await file.text();
      setSubtitleImport({ fileName: file.name, text });
    } catch {
      flash({ kind: 'err', text: 'Could not read that subtitle file.' });
    } finally {
      if (subtitleInputRef.current) subtitleInputRef.current.value = '';
    }
  };

  // Default subtitle language: the language the user studies most, else Spanish.
  const defaultSubtitleLang = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) counts.set(s.lang, (counts.get(s.lang) ?? 0) + 1);
    let best = 'es-ES';
    let bestCount = 0;
    for (const [lang, count] of counts) {
      if (count > bestCount) {
        best = lang;
        bestCount = count;
      }
    }
    return best;
  }, [sets]);

  // The hero's "Browse Library" button dispatches this event to open the
  // starter library modal (the hero lives above this component).
  useEffect(() => {
    const onOpenBrowse = () => setBrowse(true);
    window.addEventListener('audiorepeat:open-browse', onOpenBrowse);
    return () => window.removeEventListener('audiorepeat:open-browse', onOpenBrowse);
  }, []);

  // Handle a shared-deck link: /?set=<encoded>. Decoded once on mount, then
  // imported as soon as the library has loaded (so duplicates can be spotted).
  useEffect(() => {
    try {
      const encoded = new URLSearchParams(window.location.search).get('set');
      if (!encoded) return;
      const parsed = decodeSetFromUrl(encoded);
      if (parsed) queueMicrotask(() => setPendingImport(parsed));
      else
        queueMicrotask(() =>
          flash({ kind: 'err', text: 'That share link is invalid or corrupted.' }),
        );
      // Strip the param so a refresh doesn't re-import (and the URL stays clean).
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      queueMicrotask(() => flash({ kind: 'err', text: 'Could not read that share link.' }));
    }
  }, [flash]);

  useEffect(() => {
    if (loading || !pendingImport) return;
    const duplicate = sets.some(
      (s) => s.name === pendingImport.name && s.words.length === pendingImport.words.length,
    );
    if (duplicate) {
      queueMicrotask(() =>
        flash({ kind: 'ok', text: `"${pendingImport.name}" is already in your library.` }),
      );
    } else {
      void saveSet(pendingImport).then(() =>
        flash({
          kind: 'ok',
          text: `Imported "${pendingImport.name}" (${pendingImport.words.length} words).`,
        }),
      );
    }
    queueMicrotask(() => setPendingImport(null));
  }, [loading, pendingImport, sets, saveSet, flash]);

  const handleShare = async (set: VocabSet) => {
    const url = shareUrlForSet(set);
    try {
      await navigator.clipboard.writeText(url);
      flash({ kind: 'ok', text: 'Share link copied — anyone who opens it imports this set.' });
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — fall back to a prompt.
      const ok = window.prompt('Copy this share link:', url);
      flash(ok !== null ? { kind: 'ok', text: 'Share link ready to send.' } : { kind: 'err', text: 'Share cancelled.' });
    }
  };

  // Recents resolved against the live library (deleted sets drop out).
  const recentSets = useMemo(
    () =>
      recents
        .map((r) => sets.find((s) => s.id === r.setId))
        .filter((s): s is VocabSet => Boolean(s))
        .slice(0, 5),
    [recents, sets],
  );

  // Featured languages — one representative set per curated popular language,
  // padded with other languages if the curated list has gaps.
  const featuredSets = useMemo(() => {
    const firstByLang = new Map<string, VocabSet>();
    for (const s of sets) if (!firstByLang.has(s.lang)) firstByLang.set(s.lang, s);
    const picked: VocabSet[] = [];
    for (const lang of FEATURED_LANGS) {
      const s = firstByLang.get(lang);
      if (s) picked.push(s);
    }
    for (const s of sets) {
      if (picked.length >= 5) break;
      if (!picked.some((p) => p.lang === s.lang)) picked.push(s);
    }
    return picked.slice(0, 5);
  }, [sets]);

  // Featured set of the day: most recently practiced, else a CEFR-tagged set
  // (feels curated), else simply the first set in the library.
  const featured = useMemo<VocabSet | null>(() => {
    if (sets.length === 0) return null;
    const recent = recentSets[0];
    if (recent) return recent;
    return sets.find((s) => s.cefr) ?? sets[0];
  }, [sets, recentSets]);

  const totalWords = useMemo(() => sets.reduce((n, s) => n + s.words.length, 0), [sets]);
  const langCount = useMemo(() => new Set(sets.map((s) => s.lang)).size, [sets]);

  // --- Library grid filters (search + CEFR + language, AND'd together) ---
  const langOptions = useMemo(
    () =>
      Array.from(new Set(sets.map((s) => s.lang))).sort((a, b) =>
        languageLabel(a).localeCompare(languageLabel(b)),
      ),
    [sets],
  );
  const hasCefrSets = useMemo(() => sets.some((s) => s.cefr), [sets]);

  const filteredSets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sets.filter((s) => {
      if (cefrFilter !== 'all' && s.cefr !== cefrFilter) return false;
      if (langFilter !== 'all' && s.lang !== langFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !languageLabel(s.lang).toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [sets, searchQuery, cefrFilter, langFilter]);

  const filtersActive = searchQuery.trim() !== '' || cefrFilter !== 'all' || langFilter !== 'all';
  const filteredWords = useMemo(
    () => filteredSets.reduce((n, s) => n + s.words.length, 0),
    [filteredSets],
  );
  const filteredLangCount = useMemo(
    () => new Set(filteredSets.map((s) => s.lang)).size,
    [filteredSets],
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setCefrFilter('all');
    setLangFilter('all');
  }, []);
  const hasWeekActivity = week.some((d) => d.words > 0 || d.ms > 0);

  // Dashboard metrics: mastery across the whole library + daily goal progress.
  const masteryStats = useMemo(() => {
    let mastered = 0;
    let hard = 0;
    for (const s of sets) {
      for (const w of s.words) {
        if (w.mastery === 'mastered') mastered += 1;
        else if (w.mastery === 'hard') hard += 1;
      }
    }
    return { mastered, hard };
  }, [sets]);
  const accuracyPct =
    masteryStats.mastered + masteryStats.hard > 0
      ? Math.round((masteryStats.mastered / (masteryStats.mastered + masteryStats.hard)) * 100)
      : 0;
  const DAILY_GOAL_MS = 15 * 60 * 1000; // 15 minutes of listening per day
  const goalPct = Math.min(100, Math.round((msToday / DAILY_GOAL_MS) * 100));

  // The floating AI button reveals the insights card and briefly highlights it.
  const openAiInsights = useCallback(() => {
    const el = document.getElementById('ai-insights');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-blue-400/50');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400/50'), 1600);
  }, []);

  // Start warm-up as soon as a set is tapped, BEFORE the player screen mounts
  // (iOS / cached-audio only, same conditions as the player). PlayerView adopts
  // the same run via the shared manager, so this never starts a second queue.
  const warmIfNeeded = useCallback(
    (set: VocabSet) => {
      if (set.words.length === 0) return;
      if (!settings.cachedAudio && !isIOSWebKit()) return;
      // Resolve per-set voice overrides exactly like the player's `effective`
      // settings so the dedupe key matches what PlayerView computes.
      const overrides = set.settings ?? {};
      const targetVoiceURI = overrides.targetVoiceURI ?? settings.targetVoiceURI;
      const translationVoiceURI = overrides.translationVoiceURI ?? settings.translationVoiceURI;
      const nativeLang =
        set.nativeLang ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
      requestSetPrewarm(set.words, {
        key: prewarmKey(set.id, set.lang, nativeLang, targetVoiceURI, translationVoiceURI),
        lang: set.lang,
        nativeLang,
        targetVoiceURI,
        translationVoiceURI,
      });
    },
    [settings],
  );

  const playSet = (set: VocabSet) => {
    warmIfNeeded(set);
    router.push(`/player?id=${set.id}`);
  };

  // Pro gate: the 1-Minute speed challenge is a paid feature. Free users are
  // routed to the upgrade flow instead of the challenge modal.
  const pro = isProPlan(settings.plan);

  // Free-plan language gate for the + New Set editor: a Free user may only
  // create/edit sets in languages they already have visible sets in (the
  // single active language; settings.hiddenLangs already filters visibility).
  // Pro/Lifetime users can use any language. Shared logic: lib/planGate.
  const canUseLang = useCallback(
    (code: string) => planGateCanUseLang(pro, sets, code),
    [pro, sets],
  );

  const openChallenge = (set: VocabSet) => {
    if (!pro) {
      void router.push('/checkout?plan=pro');
      return;
    }
    // Warm the set at launch (iOS / cached-audio) so the challenge's audio is
    // cached before its 60s timer runs.
    warmIfNeeded(set);
    setChallengeSet(set);
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 pt-8">
      {/* Sleek floating glass navbar — z-50 lifts its stacking context (the
          .glass backdrop-blur + fade-up transform both create one) above the
          hero banner so dropdown popovers always render on top. */}
      <header className="animate-fade-up glass relative z-50 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 py-2.5 sm:mb-8 sm:gap-x-4 sm:gap-y-3 sm:px-4 sm:py-3">
        <Logo />
        <div className="mr-auto">
          <h1 className="text-[15px] font-semibold tracking-tight text-white">AudioRepeat</h1>
          <p className="hidden text-[11px] text-slate-500 sm:block">
            {LANGUAGES.length} languages · hands-free drilling
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <SettingsButton />
          <StreakBadge streak={streak} />
          <InstallAppButton />
          <ProfileDropdown
            onLeaderboard={() => setLeaderboardOpen(true)}
            onSubtitles={() => subtitleInputRef.current?.click()}
            onBrowse={() => setBrowse(true)}
          />
          <NewSetButton
            onNew={() => setEditing('new')}
            onImport={() => fileInputRef.current?.click()}
          />
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />
      <input
        ref={subtitleInputRef}
        type="file"
        accept=".srt,.vtt,.txt,.ass,.ssa,text/plain,application/x-subrip,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleSubtitleFile(file);
        }}
      />

      <WelcomeHero
        wordsToday={wordsToday}
        msToday={msToday}
        streak={streak}
        onStart={featured ? () => playSet(featured) : undefined}
      />

      <FreePlanNotice sets={sets} pro={pro} />

      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ */}
        {/* Left sidebar — featured languages + continue practice        */}
        {/* ------------------------------------------------------------ */}
        <aside className="glass animate-fade-up rounded-3xl p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Featured Languages
          </h2>

          <ul className="mt-2.5 space-y-0.5">
            {featuredSets.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => playSet(s)}
                  title={`Play ${s.name}`}
                  className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-white/5"
                >
                  <MiniCover lang={s.lang} className="h-10 w-10 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-200">
                      {s.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                      {s.cefr && <CefrBadge level={s.cefr} className="!px-1.5 !py-0 !text-[9px]" />}
                      <span className="truncate">{s.words.length} words</span>
                    </span>
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 shrink-0 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <div className="my-4 h-px bg-white/10" />

          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Continue Practice
          </h2>

          {recentSets.length > 0 ? (
            <>
              <button
                onClick={() => playSet(recentSets[0])}
                className="btn-primary mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
                </svg>
                Play Last Practice
              </button>

              <ul className="mt-2 space-y-0.5">
                {recentSets.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => playSet(s)}
                      title={`Play ${s.name}`}
                      className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-white/5"
                    >
                      <MiniCover lang={s.lang} className="h-10 w-10 rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-200">
                          {s.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                          {s.cefr && <CefrBadge level={s.cefr} className="!px-1.5 !py-0 !text-[9px]" />}
                          <span className="truncate">{s.words.length} words</span>
                        </span>
                      </span>
                      <span className="flex w-12 shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] font-semibold tabular-nums text-slate-400">
                          {masteryPct(s)}%
                        </span>
                        <ProgressBar pct={masteryPct(s)} className="h-1 w-12" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Practice any set and it will show up here so you can resume right where you left
              off.
            </p>
          )}

          <div className="my-4 h-px bg-white/10" />

          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Today
          </h2>
          <dl className="mt-2.5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Words listened</dt>
              <dd className="font-semibold tabular-nums text-slate-200">{wordsToday}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Study time</dt>
              <dd className="font-semibold tabular-nums text-slate-200">
                {formatDuration(msToday)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Streak</dt>
              <dd className="font-semibold tabular-nums text-neon-amber">
                {streak > 0 ? `🔥 ${streak} day${streak === 1 ? '' : 's'}` : '—'}
              </dd>
            </div>
          </dl>

          <div className="my-4 h-px bg-white/10" />

          <AiInsightsCard reviewCount={masteryStats.hard} goalPct={goalPct} streak={streak} />

          {hasWeekActivity && <ActivityHeatmap week={week} />}
        </aside>

        {/* ------------------------------------------------------------ */}
        {/* Main column — spotlight + library grid                       */}
        {/* ------------------------------------------------------------ */}
        <div className="min-w-0 space-y-6">
          <MetricCards
            accuracyPct={accuracyPct}
            masteredCount={masteryStats.mastered}
            streak={streak}
          />

          {featured && (
            <FeaturedCard
              set={featured}
              bookmarked={favorites.includes(featured.id)}
              onBookmark={() => toggleFavorite(featured.id)}
              onPlay={() => playSet(featured)}
            />
          )}

          {importMsg && (
            <div
              className={`animate-fade-up rounded-xl border px-4 py-3 text-sm ${
                importMsg.kind === 'ok'
                  ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                  : 'border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta'
              }`}
            >
              {importMsg.text}
            </div>
          )}

          {/* Library grid — floating glass panel */}
          <section id="vocab-grid" className="glass animate-fade-up scroll-mt-6 rounded-3xl p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Language Sets &amp; Library
                </h2>
                <p className="text-xs text-slate-500">
                  {loading
                    ? 'Loading your sets…'
                    : filtersActive
                      ? `${filteredSets.length} of ${sets.length} set${sets.length === 1 ? '' : 's'} · ${filteredWords.toLocaleString()} words · ${filteredLangCount} language${filteredLangCount === 1 ? '' : 's'}`
                      : `${sets.length} set${sets.length === 1 ? '' : 's'} · ${totalWords.toLocaleString()} words · ${langCount} language${langCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                onClick={() => setBrowse(true)}
                className="btn-clean flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-300"
              >
                <span aria-hidden>＋</span> Browse library
              </button>
            </div>

            {/* Search + filters — only affect the grid below */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sets or languages…"
                  aria-label="Search sets"
                  className="btn-clean h-9 w-full rounded-xl pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-neon-violet/60"
                />
              </div>

              {hasCefrSets && (
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Filter by CEFR level"
                >
                  {(['all', ...CEFR_LEVELS] as const).map((lvl) => {
                    const active = cefrFilter === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setCefrFilter(lvl)}
                        aria-pressed={active}
                        className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                          active
                            ? lvl === 'all'
                              ? 'bg-white/15 text-white ring-1 ring-white/30'
                              : CEFR_META[lvl].chip
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {lvl === 'all' ? 'All' : lvl}
                      </button>
                    );
                  })}
                </div>
              )}

              {langOptions.length > 1 && (
                <select
                  value={langFilter}
                  onChange={(e) => setLangFilter(e.target.value)}
                  aria-label="Filter by language"
                  className="btn-clean h-9 rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet/60 [&>option]:bg-slate-900"
                >
                  <option value="all">All languages</option>
                  {langOptions.map((l) => (
                    <option key={l} value={l}>
                      {languageLabel(l)}
                    </option>
                  ))}
                </select>
              )}

              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-neon-violet transition hover:text-white"
                >
                  Clear filters
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="glass-card h-72 animate-pulse rounded-2xl"
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
            ) : sets.length === 0 ? (
              <div className="glass-card mx-auto max-w-md rounded-2xl p-10 text-center">
                <p className="text-lg font-semibold text-white">No vocabulary sets yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  Create your first set with the + New button, import a JSON set, or grab a
                  starter pack from the library.
                </p>
                <button
                  onClick={() => setBrowse(true)}
                  className="btn-primary mx-auto mt-5 flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white"
                >
                  Browse starter library
                </button>
              </div>
            ) : filteredSets.length === 0 ? (
              <div className="glass-card mx-auto max-w-md rounded-2xl p-10 text-center">
                <p className="text-lg font-semibold text-white">No sets match your filters</p>
                <p className="mt-2 text-sm text-slate-400">
                  Try a different search, level, or language.
                </p>
                <button
                  onClick={clearFilters}
                  className="btn-clean mx-auto mt-5 flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {filteredSets.map((set, i) => (
                  <PortraitCard
                    key={set.id}
                    set={set}
                    index={i}
                    pro={pro}
                    onPlay={() => playSet(set)}
                    onChallenge={() => openChallenge(set)}
                    onEdit={() => setEditing(set)}
                    onExport={() => downloadSet(set)}
                    onShare={() => void handleShare(set)}
                    onDelete={() => void removeSet(set.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <SetEditor
          set={editing === 'new' ? null : editing}
          canUseLang={canUseLang}
          onClose={() => setEditing(null)}
          onSave={async (set) => {
            const saved = await saveSet(set);
            warmIfNeeded(saved); // Save & play — warm the fresh set too
            router.push(`/player?id=${saved.id}`);
          }}
        />
      )}

      {challengeSet && (
        <SpeedChallenge
          set={challengeSet}
          onClose={() => setChallengeSet(null)}
          onRecordWord={(n) => recordWords(n, challengeSet.lang)}
        />
      )}

      {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}

      {subtitleImport && (
        <SubtitleImportModal
          fileName={subtitleImport.fileName}
          text={subtitleImport.text}
          defaultLang={defaultSubtitleLang}
          canUseLang={canUseLang}
          onClose={() => setSubtitleImport(null)}
          onCreate={(set) => {
            // Open the editor to review translations before saving (Save & play).
            setSubtitleImport(null);
            setEditing(set);
          }}
        />
      )}

      {browse && (
        <StarterLibraryModal
          sets={sets}
          pro={pro}
          onClose={() => setBrowse(false)}
          onImport={async (set) => {
            try {
              await saveSet(set);
              flash({ kind: 'ok', text: `Imported "${set.name}" (${set.words.length} words).` });
            } catch {
              flash({ kind: 'err', text: 'Could not import that starter set.' });
            }
          }}
        />
      )}

      <AiAssistantButton onOpen={openAiInsights} />
    </main>
  );
}
