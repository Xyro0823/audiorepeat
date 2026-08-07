'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, VocabSet } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';
import {
  deleteSet as dbDeleteSet,
  getAllSets,
  getSettings,
  putSet,
  putSettings,
} from '@/lib/db/indexedDb';

const SEED_SET: VocabSet = {
  id: 'seed-spanish-essentials',
  name: 'Spanish Essentials',
  lang: 'es-ES',
  nativeLang: 'en-US',
  words: [
    { id: 'w-hola', target: 'hola', translation: 'hello' },
    { id: 'w-gracias', target: 'gracias', translation: 'thank you' },
    { id: 'w-por-favor', target: 'por favor', translation: 'please', repeats: 3 },
    { id: 'w-lo-siento', target: 'lo siento', translation: 'I am sorry' },
    { id: 'w-adios', target: 'adiós', translation: 'goodbye' },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export function useLists() {
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await getAllSets();
      if (list.length === 0) {
        await putSet({ ...SEED_SET, createdAt: Date.now(), updatedAt: Date.now() });
        list = await getAllSets();
      }
      const stored = await getSettings();
      if (alive) {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        settingsRef.current = merged;
        setSets(list);
        setSettings(merged);
        setLoading(false);
      }
    })().catch((err) => {
      console.error('[useLists] hydration failed', err);
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // flush any pending settings write on unmount
  useEffect(
    () => () => {
      if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    },
    [],
  );

  const saveSet = useCallback(async (set: VocabSet): Promise<VocabSet> => {
    const next = { ...set, updatedAt: Date.now() };
    await putSet(next);
    setSets((prev) => {
      const idx = prev.findIndex((s) => s.id === next.id);
      const copy = [...prev];
      if (idx >= 0) copy[idx] = next;
      else copy.unshift(next);
      return copy;
    });
    return next;
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await dbDeleteSet(id);
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Debounced persistence: state updates are instant; IndexedDB writes coalesce
  // (e.g. during slider drags). No side effects inside the state updater.
  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void putSettings(settingsRef.current).catch((err) =>
        console.error('[useLists] save settings', err),
      );
    }, 250);
  }, []);

  return { sets, settings, loading, saveSet, removeSet, saveSettings };
}
