'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAudioLoop } from '@/hooks/useAudioLoop';
import { useLists } from '@/hooks/useLists';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import { CachedAudioEngine } from '@/lib/tts/cachedAudioEngine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import type { TTSEngine } from '@/lib/tts/engine';
import PlayerControls from './PlayerControls';
import ProgressBar from './ProgressBar';
import SettingsPanel from './SettingsPanel';
import WordCard from './WordCard';

export default function PlayerView({ setId }: { setId: string | null }) {
  const { sets, loading, settings, saveSettings } = useLists();
  const set = sets.find((s) => s.id === setId) ?? null;

  const words = useMemo(
    () =>
      set
        ? set.words.map((w) => ({ ...w, lang: set.lang, nativeLang: set.nativeLang }))
        : [],
    [set],
  );

  // Swappable engine: cached <audio> (offline) when enabled, else speechSynthesis.
  const engine = useMemo<TTSEngine | undefined>(() => {
    if (!settings.cachedAudio) return undefined;
    return new CachedAudioEngine(new SpeechSynthesisEngine());
  }, [settings.cachedAudio]);

  const { progress, currentWord, isPlaying, play, pause, stop, skipNext, replayWord } =
    useAudioLoop({ words, settings, engine });

  const { voices, loading: voicesLoading } = useSpeechVoices(engine);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-5">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!set) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-2xl font-semibold text-white">Set not found</p>
        <p className="text-sm text-slate-400">It may have been deleted.</p>
        <Link
          href="/"
          className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110"
        >
          Back to library
        </Link>
      </main>
    );
  }

  const currentRepeats = currentWord?.repeats ?? settings.repeats;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-52 pt-6">
      <header className="animate-fade-up flex items-center gap-2">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Back to library"
        >
          <span>←</span>
          <span>Library</span>
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="truncate text-sm font-semibold text-slate-200">{set.name}</h1>
        <span className="ml-auto shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400">
          {set.words.length} words
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center py-8">
        <WordCard
          word={currentWord}
          wordIndex={progress.wordIndex}
          repeatIndex={progress.repeatIndex}
          isTranslation={progress.isTranslation}
          repeats={currentRepeats}
          total={set.words.length}
        />
        <ProgressBar
          wordIndex={progress.wordIndex}
          repeatIndex={progress.repeatIndex}
          isTranslation={progress.isTranslation}
          repeats={currentRepeats}
          total={set.words.length}
        />
      </div>

      <SettingsPanel
        settings={settings}
        onChange={saveSettings}
        voices={voices}
        voicesLoading={voicesLoading}
        targetLang={set.lang}
        nativeLang={set.nativeLang}
      />

      <PlayerControls
        isPlaying={isPlaying}
        onPlayPause={isPlaying ? pause : play}
        onStop={stop}
        onSkipNext={skipNext}
        onReplay={replayWord}
      />
    </main>
  );
}
