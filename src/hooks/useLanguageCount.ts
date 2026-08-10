import { useEffect, useState } from "react";
import { getWordBankManifest } from "@/lib/vocab/wordBanks";

/**
 * Number of languages that ship real vocabulary packs, derived from
 * /data/vocab/manifest.json at runtime so marketing copy never drifts out
 * of sync with the actual data. The initial/fallback value is a snapshot of
 * the current manifest (13 languages) — keep it in sync if the manifest is
 * ever updated to a smaller set; the runtime fetch will correct it upward.
 */
export function useLanguageCount(): number {
  const [count, setCount] = useState(13);

  useEffect(() => {
    let alive = true;
    getWordBankManifest()
      .then((manifest) => {
        if (alive) setCount(Object.keys(manifest).length);
      })
      .catch(() => {
        /* keep the snapshot fallback if the manifest can't be loaded */
      });
    return () => {
      alive = false;
    };
  }, []);

  return count;
}
