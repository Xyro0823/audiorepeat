import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('core accessibility baseline', () => {
  it('keeps a shared skip link and core workflow targets', () => {
    expect(source('src/app/layout.tsx')).toContain('<SkipToContent />');
    for (const path of [
      'src/components/library/SetLibrary.tsx',
      'src/components/player/PlayerView.tsx',
      'src/components/review/ReviewSession.tsx',
      'src/components/checkout/CheckoutFlow.tsx',
    ]) {
      expect(source(path), path).toContain('id="main-content"');
    }
  });

  it('keeps auth controls labelled and loading state announced', () => {
    const auth = source('src/components/auth/AuthScreen.tsx');
    for (const id of ['auth-display-name', 'auth-email', 'auth-password', 'auth-confirm-password']) {
      expect(auth).toContain(`htmlFor="${id}"`);
      expect(auth).toContain(`id="${id}"`);
    }
    expect(auth).toContain('aria-busy={busy}');
    expect(auth).toContain("t('common.loading')");
  });

  it('announces player and review loading states', () => {
    for (const path of [
      'src/components/player/PlayerView.tsx',
      'src/components/review/ReviewSession.tsx',
    ]) {
      const view = source(path);
      expect(view, path).toContain('role="status"');
      expect(view, path).toContain('aria-live="polite"');
    }
  });
});
