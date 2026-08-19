import { describe, expect, it } from 'vitest';
import { cleanEditorWords } from './editor';

describe('cleanEditorWords', () => {
  it('drops incomplete and subtitle-placeholder rows', () => {
    expect(cleanEditorWords([
      { id: '1', target: 'hello', translation: '—' },
      { id: '2', target: '', translation: 'empty' },
      { id: '3', target: ' valid ', translation: ' зөв ', example: ' example ' },
    ])).toEqual([{ id: '3', target: 'valid', translation: 'зөв', example: 'example' }]);
  });

  it('returns an empty list when no playable row remains', () => {
    expect(cleanEditorWords([{ id: '1', target: ' ', translation: '—' }])).toEqual([]);
  });
});
