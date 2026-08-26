import { describe, expect, it } from 'vitest';
import { createMongolianGlossary, mongolianGlossFor } from './mongolianGlosses';

const glossary = createMongolianGlossary([
  ['сайн байна уу', 'hello'],
  ['уучлаарай', 'excuse me / sorry'],
  ['явах', 'to go'],
]);

describe('Mongolian starter glossary', () => {
  it('returns a Mongolian meaning for simple English pack glosses', () => {
    expect(mongolianGlossFor(glossary, 'hello')).toBe('сайн байна уу');
    expect(mongolianGlossFor(glossary, 'Sorry!')).toBe('уучлаарай');
  });

  it('understands slash alternatives and infinitive glosses', () => {
    expect(mongolianGlossFor(glossary, 'excuse me')).toBe('уучлаарай');
    expect(mongolianGlossFor(glossary, 'go')).toBe('явах');
  });

  it('does not pretend to translate meanings it does not know', () => {
    expect(mongolianGlossFor(glossary, 'unmapped technical term')).toBeUndefined();
  });
});
