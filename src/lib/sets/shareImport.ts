import type { VocabSet } from '@/types/app';
import { decodeSetFromUrl } from './share';

/** A generous guard against accidentally decoding an unbounded URL payload. */
export const MAX_SHARED_SET_PAYLOAD_LENGTH = 2_000_000;

export type SharedSetLinkSource = 'query' | 'fragment';

export interface SharedSetPreview {
  set: VocabSet;
  source: SharedSetLinkSource;
  name: string;
  wordCount: number;
  targetLang: string;
  nativeLang: string;
  cefr?: VocabSet['cefr'];
  samples: Array<{ target: string; translation: string }>;
  remainingWordCount: number;
}

export type SharedSetLinkResult =
  | { status: 'none' }
  | {
      status: 'invalid';
      reason: 'malformed-url' | 'empty-payload' | 'payload-too-large' | 'invalid-payload';
    }
  | { status: 'ready'; preview: SharedSetPreview };

function asUrl(input: string | URL): URL | null {
  if (input instanceof URL) return new URL(input.toString());
  try {
    // The base also makes this helper useful with relative app URLs in tests
    // and client navigation utilities.
    return new URL(input, 'https://audiorepeat.app');
  } catch {
    return null;
  }
}

function payloadFromUrl(url: URL): { encoded: string; source: SharedSetLinkSource } | null {
  // Query comes first to preserve the behavior of legacy links that happen to
  // contain an unrelated hash. New links put the same payload in the fragment.
  if (url.searchParams.has('set')) {
    return { encoded: url.searchParams.get('set') ?? '', source: 'query' };
  }

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  if (fragment.has('set')) {
    return { encoded: fragment.get('set') ?? '', source: 'fragment' };
  }
  return null;
}

/**
 * Parse and validate a share URL without writing anything to the library.
 * The returned set already has fresh ids because decodeSetFromUrl reuses the
 * regular import sanitizer, but callers must wait for explicit confirmation
 * before persisting it.
 */
export function previewSharedSetLink(input: string | URL): SharedSetLinkResult {
  const url = asUrl(input);
  if (!url) return { status: 'invalid', reason: 'malformed-url' };

  const payload = payloadFromUrl(url);
  if (!payload) return { status: 'none' };

  const encoded = payload.encoded.trim();
  if (!encoded) return { status: 'invalid', reason: 'empty-payload' };
  if (encoded.length > MAX_SHARED_SET_PAYLOAD_LENGTH) {
    return { status: 'invalid', reason: 'payload-too-large' };
  }

  const set = decodeSetFromUrl(encoded);
  if (!set) return { status: 'invalid', reason: 'invalid-payload' };

  const samples = set.words.slice(0, 3).map(({ target, translation }) => ({
    target,
    translation,
  }));
  return {
    status: 'ready',
    preview: {
      set,
      source: payload.source,
      name: set.name,
      wordCount: set.words.length,
      targetLang: set.lang,
      nativeLang: set.nativeLang,
      cefr: set.cefr,
      samples,
      remainingWordCount: Math.max(0, set.words.length - samples.length),
    },
  };
}

/** Remove only share payloads while preserving every unrelated query/hash value. */
export function withoutSharedSetPayload(input: string | URL): string {
  const url = asUrl(input);
  if (!url) return '/dashboard';

  url.searchParams.delete('set');

  const rawFragment = url.hash.replace(/^#/, '');
  if (rawFragment) {
    const fragment = new URLSearchParams(rawFragment);
    if (fragment.has('set')) {
      fragment.delete('set');
      const nextFragment = fragment.toString();
      url.hash = nextFragment ? `#${nextFragment}` : '';
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

/** Exact content duplicate check; avoids the old name + word-count false positives. */
export function findDuplicateSharedSet(
  candidate: VocabSet,
  existingSets: readonly VocabSet[],
): VocabSet | null {
  const name = normalized(candidate.name);
  const lang = normalized(candidate.lang);
  const nativeLang = normalized(candidate.nativeLang);

  return (
    existingSets.find((existing) => {
      if (
        normalized(existing.name) !== name ||
        normalized(existing.lang) !== lang ||
        normalized(existing.nativeLang) !== nativeLang ||
        existing.words.length !== candidate.words.length
      ) {
        return false;
      }
      return existing.words.every((word, index) => {
        const incoming = candidate.words[index];
        return (
          incoming !== undefined &&
          normalized(word.target) === normalized(incoming.target) &&
          normalized(word.translation) === normalized(incoming.translation)
        );
      });
    }) ?? null
  );
}
