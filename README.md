# Evoq 🔁

[![CI](https://github.com/Xyro0823/audiorepeat/actions/workflows/ci.yml/badge.svg)](https://github.com/Xyro0823/audiorepeat/actions/workflows/ci.yml)

Offline-first, hands-free vocabulary looping for auditory language learners.
Each word is repeated in your target language N times (1/2/3/5), followed once
by its translation — looped until you stop it. Built for walks, commutes and
remote areas: works fully offline and as an installable PWA.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- Native Web Speech API (`speechSynthesis`) — zero-cost TTS
- IndexedDB (via `idb`) for vocab sets & settings; Cache API for pre-generated audio
- Media Session API (lock-screen / bluetooth controls) + Screen Wake Lock
- Hand-rolled service worker (offline shell) + typed PWA manifest

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # type-check + production build
npm start          # serve the production build (enables the service worker)
npm run lint
npm run icons      # regenerate PWA icons (public/icons/*.png)
```

> The service worker registers only in production builds to avoid dev caching
> headaches — run `npm run build && npm start` to exercise offline/PWA mode.

## Architecture

```
app/            layout, library (/), player (/player?id=…), manifest, SW
components/     library (SetList, SetEditor) + player (Controls, WordCard, …)
hooks/          useAudioLoop · useSpeechVoices · useLists (IndexedDB CRUD)
lib/tts/        engine.ts (interface) · speechSynthesisEngine · cachedAudioEngine
lib/audio/      Cache API helpers for pre-generated TTS audio
lib/db/         IndexedDB schema + accessors
scripts/        dependency-free PWA icon generator
```

**`useAudioLoop`** is the audio queue state machine: for each word it plays
`[target × repeats, gap, translation, gap]` then advances, driven by
`onend` callbacks + gap timers. Refs hold the cursor (async callbacks never
read stale state), a monotonically increasing token invalidates in-flight
speech on stop/pause/skip, and pause is cancel-based because Chromium's
`speechSynthesis.pause()/resume()` is unreliable. All audio goes through the
`TTSEngine` interface, so engines are swappable: Web Speech API by default,
or the hybrid `CachedAudioEngine` (cached `<audio>` → speech fallback) when
"Prefer cached audio" is enabled.

## Offline / PWA notes

- **Voices:** Chrome exposes online voices (`localService: false`). The voice
  picker marks voices `offline`/`cloud`; `pickVoice()` prefers offline voices.
  Fully offline speech needs local voices (Windows system voices, or Google
  TTS offline packs on Android).
- **Background audio:** `speechSynthesis` does not register with the Media
  Session API, and iOS stops it with the screen locked. Pre-generated audio
  played via `<audio>` (the cached engine) is the reliable hands-free path.
- **Wake Lock** keeps the screen on while drilling (Chrome Android; best-effort
  elsewhere).

## Deploying

Live at **https://audiorepeat.vercel.app** — Vercel + GitHub connected.
Every push to github.com/Xyro0823/audiorepeat deploys automatically.
Manual CLI deploy: `vercel --prod` from this folder.

**Environment variables:** all app vars are documented in `.env.example`.
The 7 `NEXT_PUBLIC_FIREBASE_*` values are configured in Vercel Production
(Firebase Auth for project `audiorepeat-819d9`, domain `audiorepeat.vercel.app`
authorized).

**Payments:** checkout currently shows the honest placeholder state until
payment credentials are configured. The app previously used Stripe; a Paddle
migration is in progress (provider-agnostic entitlement infrastructure is in
place and Paddle catalog prices are reflected in the UI, but no Paddle
checkout/webhook is implemented yet). The Stripe code paths remain until the
Paddle cutover is complete.

## Roadmap

- Cloud TTS fallback (ElevenLabs / Google Cloud TTS) + "Download for offline"
  that pre-generates audio into the Cache API
- Unit tests for the audio loop scheduler
