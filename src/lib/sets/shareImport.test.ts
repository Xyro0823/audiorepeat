import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { VocabSet } from '@/types/app';
import { encodeSetForUrl } from './share';
import {
  MAX_SHARED_SET_PAYLOAD_LENGTH,
  findDuplicateSharedSet,
  previewSharedSetLink,
  withoutSharedSetPayload,
} from './shareImport';

const set: VocabSet = {
  id: 'sender-set',
  name: '  Travel Spanish  ',
  lang: 'es-ES',
  nativeLang: 'en-US',
  cefr: 'A2',
  words: [
    { id: 'sender-1', target: 'hola', translation: 'hello', mastery: 'mastered' },
    { id: 'sender-2', target: 'gracias', translation: 'thank you', mastery: 'hard' },
    { id: 'sender-3', target: 'adiós', translation: 'goodbye' },
    { id: 'sender-4', target: 'por favor', translation: 'please' },
  ],
  createdAt: 1,
  updatedAt: 1,
};

beforeAll(() => {
  let id = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `fresh-${++id}` });
});

afterAll(() => vi.unstubAllGlobals());

describe('shared set import preview', () => {
  it('previews a new fragment link without importing personal progress', () => {
    const encoded = encodeSetForUrl(set);
    const result = previewSharedSetLink(`https://audiorepeat.app/dashboard#set=${encoded}`);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.preview).toMatchObject({
      source: 'fragment',
      name: 'Travel Spanish',
      wordCount: 4,
      targetLang: 'es-ES',
      nativeLang: 'en-US',
      cefr: 'A2',
      remainingWordCount: 1,
    });
    expect(result.preview.samples).toEqual([
      { target: 'hola', translation: 'hello' },
      { target: 'gracias', translation: 'thank you' },
      { target: 'adiós', translation: 'goodbye' },
    ]);
    expect(result.preview.set.words.every((word) => word.mastery === undefined)).toBe(true);
  });

  it('keeps accepting legacy query links and gives them precedence', () => {
    const query = encodeSetForUrl(set);
    const other = encodeSetForUrl({ ...set, name: 'Other set' });
    const result = previewSharedSetLink(`/dashboard?set=${query}#set=${other}`);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.preview.source).toBe('query');
    expect(result.preview.name).toBe('Travel Spanish');
  });

  it.each([
    { label: 'a regular dashboard URL', url: '/dashboard', expected: 'none' },
    { label: 'an empty share payload', url: '/dashboard#set=', expected: 'empty-payload' },
    {
      label: 'a corrupt share payload',
      url: '/dashboard#set=not-valid-base64',
      expected: 'invalid-payload',
    },
    {
      label: 'an unbounded share payload',
      url: `/dashboard#set=${'a'.repeat(MAX_SHARED_SET_PAYLOAD_LENGTH + 1)}`,
      expected: 'payload-too-large',
    },
    { label: 'a malformed absolute URL', url: 'http://[', expected: 'malformed-url' },
  ])('classifies $label without throwing', ({ url, expected }) => {
    const result = previewSharedSetLink(url);
    const classification =
      result.status === 'none' ? 'none' : result.status === 'invalid' ? result.reason : 'ready';
    expect(classification).toBe(expected);
  });

  it('removes both share formats while preserving unrelated URL state', () => {
    expect(
      withoutSharedSetPayload('https://audiorepeat.app/dashboard?view=grid&set=legacy#tab=recent'),
    ).toBe('/dashboard?view=grid#tab=recent');
    expect(
      withoutSharedSetPayload('https://audiorepeat.app/dashboard?view=grid#set=new&tab=recent'),
    ).toBe('/dashboard?view=grid#tab=recent');

    const original = new URL('https://audiorepeat.app/dashboard?set=legacy#tab=recent');
    withoutSharedSetPayload(original);
    expect(original.toString()).toBe(
      'https://audiorepeat.app/dashboard?set=legacy#tab=recent',
    );
  });

  it('detects only exact set content, not the old name-and-count false positive', () => {
    const candidate = { ...set, name: 'Travel Spanish' };
    const differentContent: VocabSet = {
      ...candidate,
      id: 'different',
      words: candidate.words.map((word, index) =>
        index === 0 ? { ...word, target: 'buenos días' } : word,
      ),
    };
    const exactWithFreshIds: VocabSet = {
      ...candidate,
      id: 'existing',
      name: 'travel spanish',
      lang: 'ES-es',
      words: candidate.words.map((word, index) => ({ ...word, id: `existing-${index}` })),
    };

    expect(findDuplicateSharedSet(candidate, [differentContent])).toBeNull();
    expect(findDuplicateSharedSet(candidate, [differentContent, exactWithFreshIds])?.id).toBe(
      'existing',
    );
  });
});
