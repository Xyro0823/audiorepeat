'use client';

import { useEffect, useState } from 'react';
import { cloudTtsConfigured } from '@/lib/tts/cloudTts';

export function useCloudTtsStatus(): boolean {
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    let active = true;
    void cloudTtsConfigured()
      .then((ready) => {
        if (active) setConfigured(ready);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return configured;
}
