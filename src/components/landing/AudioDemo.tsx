"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Square, Volume2 } from "lucide-react";
import { AUDIO_SAMPLES } from "./landingContent";

type DemoStatus = "idle" | "playing" | "error";

function matchingVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const normalized = lang.toLowerCase();
  const base = normalized.split("-")[0];
  return voices.find((voice) => voice.localService && voice.lang.toLowerCase() === normalized)
    ?? voices.find((voice) => voice.lang.toLowerCase() === normalized)
    ?? voices.find((voice) => voice.localService && voice.lang.toLowerCase().split("-")[0] === base)
    ?? voices.find((voice) => voice.lang.toLowerCase().split("-")[0] === base);
}

export default function AudioDemo() {
  const [selectedKey, setSelectedKey] = useState<(typeof AUDIO_SAMPLES)[number]["key"]>(AUDIO_SAMPLES[0].key);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [slow, setSlow] = useState(false);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [message, setMessage] = useState("Ready to play a five-phrase sample lesson.");
  const sequenceRef = useRef(0);
  const selected = AUDIO_SAMPLES.find((sample) => sample.key === selectedKey) ?? AUDIO_SAMPLES[0];
  const phrase = selected.phrases[phraseIndex] ?? selected.phrases[0];

  useEffect(() => () => {
    sequenceRef.current += 1;
    window.speechSynthesis?.cancel();
  }, []);

  function stop() {
    sequenceRef.current += 1;
    window.speechSynthesis?.cancel();
    setStatus("idle");
    setMessage("Lesson stopped. Choose a phrase or play the lesson again.");
  }

  function play() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setStatus("error");
      setMessage("Speech playback is not available in this browser. Try a current version of Edge, Chrome or Safari.");
      return;
    }

    window.speechSynthesis.cancel();
    const sequence = ++sequenceRef.current;
    const voices = window.speechSynthesis.getVoices();
    const items = selected.phrases.flatMap((item, index) => [
      { text: item.target, lang: selected.lang, phraseIndex: index },
      { text: item.translation, lang: "en-US", phraseIndex: index },
      { text: item.target, lang: selected.lang, phraseIndex: index },
    ]);

    setStatus("playing");
    setPhraseIndex(0);
    setMessage(`Playing a five-phrase ${selected.language} sample lesson.`);

    const speakAt = (index: number) => {
      if (sequenceRef.current !== sequence) return;
      if (index >= items.length) {
        setStatus("idle");
        setMessage("Loop complete. Play it again or try another language.");
        return;
      }

      const item = items[index];
      setPhraseIndex(item.phraseIndex);
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = item.lang;
      utterance.rate = slow ? 0.72 : 0.92;
      utterance.voice = matchingVoice(voices, item.lang) ?? null;
      utterance.onend = () => speakAt(index + 1);
      utterance.onerror = (event) => {
        if (sequenceRef.current !== sequence || event.error === "interrupted" || event.error === "canceled") return;
        setStatus("error");
        setMessage("This voice could not play. Install the language voice on your device or choose another sample.");
      };
      window.speechSynthesis.speak(utterance);
    };

    speakAt(0);
  }

  function chooseSample(key: typeof AUDIO_SAMPLES[number]["key"]) {
    if (status === "playing") stop();
    setSelectedKey(key);
    setPhraseIndex(0);
    const next = AUDIO_SAMPLES.find((sample) => sample.key === key) ?? AUDIO_SAMPLES[0];
    setMessage(`${next.language} selected. Five phrases ready to play.`);
  }

  function choosePhrase(index: number) {
    if (status === "playing") stop();
    setPhraseIndex(index);
    setMessage(`Phrase ${index + 1} of ${selected.phrases.length} selected.`);
  }

  return (
    <section id="demo" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
      <div className="glass-neural overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">Try it now</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
              Try a five-phrase lesson before you sign up
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              This sample lesson uses a speech voice installed on your device. Choose a language, adjust the speed and hear every phrase in a target → translation → target loop.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Voice quality and availability vary by device, browser and installed language pack.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sample language</legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AUDIO_SAMPLES.map((sample) => (
                  <button
                    key={sample.key}
                    type="button"
                    aria-pressed={selected.key === sample.key}
                    onClick={() => chooseSample(sample.key)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                      selected.key === sample.key
                        ? "border-cyan-400/60 bg-cyan-500/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <span aria-hidden className="mr-1.5">{sample.flag}</span>{sample.language}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center">
              <div className="mb-4 flex items-center justify-center gap-1.5" aria-label={`Phrase ${phraseIndex + 1} of ${selected.phrases.length}`}>
                {selected.phrases.map((item, index) => (
                  <span key={item.target} aria-hidden className={`h-1.5 rounded-full transition-[width,background-color] ${index === phraseIndex ? "w-7 bg-cyan-300" : "w-3 bg-white/15"}`} />
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Phrase {phraseIndex + 1} of {selected.phrases.length}</p>
              <p lang={selected.lang} className="mt-2 break-words text-2xl font-bold text-white sm:text-3xl">{phrase.target}</p>
              <p className="mt-2 text-sm text-cyan-300">{phrase.translation}</p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button type="button" onClick={() => choosePhrase(Math.max(0, phraseIndex - 1))} disabled={phraseIndex === 0} aria-label="Previous phrase" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button type="button" onClick={() => choosePhrase(Math.min(selected.phrases.length - 1, phraseIndex + 1))} disabled={phraseIndex === selected.phrases.length - 1} aria-label="Next phrase" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex self-start rounded-full border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Playback speed">
                <button
                  type="button"
                  aria-pressed={!slow}
                  onClick={() => setSlow(false)}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${!slow ? "bg-white text-black" : "text-slate-400 hover:text-white"}`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  aria-pressed={slow}
                  onClick={() => setSlow(true)}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${slow ? "bg-white text-black" : "text-slate-400 hover:text-white"}`}
                >
                  Slow
                </button>
              </div>

              {status === "playing" ? (
                <button type="button" onClick={stop} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  <Square className="h-4 w-4" aria-hidden /> Stop
                </button>
              ) : (
                <button type="button" onClick={play} className="btn-neural inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  <Volume2 className="h-4 w-4" aria-hidden /> Play 5-Phrase Lesson
                </button>
              )}
            </div>

            <p aria-live="polite" className={`mt-4 min-h-5 text-xs ${status === "error" ? "text-rose-300" : "text-slate-500"}`}>
              {message}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
