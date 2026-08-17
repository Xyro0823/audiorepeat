import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Entitlement-copy regression guard. Customer-facing plan copy must never
 * hardcode the Free-plan language allowance (FREE_LANG_LIMIT, currently 1) —
 * it must come from the canonical constant in src/lib/plans.ts. If a future
 * edit reintroduces a literal like "includes 1 language", the number drifts
 * from the entitlement model and this test fails.
 *
 * See the fixes in:
 *   - src/components/library/LanguageLock.tsx
 *   - src/components/onboarding/ChangeFreeLanguageModal.tsx
 */
const FORBIDDEN_LITERALS = [
  'includes 1 language',
  'includes 1 active language',
  'includes 1 active',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p, acc);
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      // Test files may mention the literal in negative assertions.
      !/\.(test|spec)\.(ts|tsx)$/.test(entry)
    ) {
      acc.push(p);
    }
  }
  return acc;
}

function findOffenders(): { file: string; line: string }[] {
  const offenders: { file: string; line: string }[] = [];
  for (const file of walk(join('src', 'components'))) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (FORBIDDEN_LITERALS.some((lit) => line.includes(lit))) {
        offenders.push({ file, line: `${i + 1}: ${line.trim()}` });
      }
    });
  }
  return offenders;
}

describe('customer-facing entitlement copy', () => {
  it('never hardcodes the Free-plan language allowance in components', () => {
    const offenders = findOffenders();
    expect(offenders).toEqual([]);
  });

  it('renders the allowance from FREE_LANG_LIMIT where it appears', () => {
    // The two fixed surfaces must keep deriving their copy from the
    // canonical constant (guards against a future regression to a literal).
    for (const file of [
      'src/components/library/LanguageLock.tsx',
      'src/components/onboarding/ChangeFreeLanguageModal.tsx',
    ]) {
      expect(readFileSync(file, 'utf8'), file).toContain('FREE_LANG_LIMIT');
    }
  });
});
