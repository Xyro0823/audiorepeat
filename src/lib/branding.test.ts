import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Branding regression guard: the public product is AudioRepeat. The old
 * "Evoq" name must not appear in any app/service-worker source except for the
 * small set of intentional references listed below: internal dev comments
 * (backup-format notes, health-script headers) and the owner-approved legal
 * operator identity (Evoq is the operator/legal entity named in the public
 * Privacy / Terms / Refund pages). This keeps a Paddle reviewer from ever
 * seeing stale product branding in a future edit.
 */
const ALLOWED_INTERNAL_COMMENTS = [
  'Shared Evoq vocabulary/language health analysis',
  'Parse and validate an Evoq backup',
  'Evoq service worker — offline app shell + audio caching',
  'Evoq vocabulary/language health report (read-only)',
  'Read-only Production health check for Evoq/AudioRepeat',
  // Owner-approved legal operator identity (see src/lib/legalIdentity.ts).
  'Evoq is the operator/legal',
  'legalName: "Evoq",',
  'The service is operated by Evoq',
  'owned by Evoq, the operator of',
  'Contact Evoq, the',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p, acc);
    } else if (
      /\.(ts|tsx|js|mjs)$/.test(entry) &&
      // Test files intentionally mention Evoq in negative assertions; they
      // never ship to customers.
      !/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(entry)
    ) {
      acc.push(p);
    }
  }
  return acc;
}

function findOffenders(): { file: string; line: string }[] {
  const offenders: { file: string; line: string }[] = [];
  for (const root of ['src', 'scripts', join('public', 'sw.js')]) {
    const files = root.endsWith('.js')
      ? [root]
      : walk(root);
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/Evoq/i.test(line)) return;
        const allowed = ALLOWED_INTERNAL_COMMENTS.some((c) => line.includes(c));
        if (!allowed) offenders.push({ file, line: `${i + 1}: ${line.trim()}` });
      });
    }
  }
  return offenders;
}

describe('AudioRepeat branding', () => {
  it('has no customer-facing Evoq references outside the internal allowlist', () => {
    const offenders = findOffenders();
    expect(offenders).toEqual([]);
  });
});
