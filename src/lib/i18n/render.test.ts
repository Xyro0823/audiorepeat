import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * RUNTIME RENDER regression for the namespace-split registry.
 *
 * The production failure could NOT be seen by chunk-marker checks: modules
 * were bundled fine, but registration ran in the wrong module graph, so
 * `t()` returned raw keys ("landing.plan.bullet.standardTts") at render time.
 *
 * This suite actually RENDERS a real component with react-dom/server under a
 * fresh registry and asserts human-readable output:
 *  - CORE-only (global/layout context): non-core namespaces degrade to raw
 *    keys BY DESIGN — asserted explicitly so the fallback stays observable.
 *  - After the route bundle registers (what each route's client entry now
 *    does at module scope), the SAME render yields translated text.
 */

async function freshCore() {
  vi.resetModules();
  const i18n = await import('./index'); // registers CORE synchronously
  return i18n;
}

describe('rendered i18n output (react-dom/server)', () => {
  it('renders landing plan copy once the landing bundle registers', async () => {
    const i18n = await freshCore();
    const { PlanText } = await import('@/lib/i18n/PlanText');

    // CORE-only context (e.g. a route that did not register landing yet):
    // the missing namespace degrades to its raw key — this is exactly the
    // production bug shape, pinned here so any regression is loud…
    const before = renderToStaticMarkup(
      createElement(PlanText, { text: 'Standard TTS audio' }),
    );
    expect(before).toContain('landing.plan.bullet.standardTts');

    // …and after the landing bundle registers (module-scope call in
    // LandingPage.tsx), the same render is translated.
    const { landingBundle } = await import('./register/landing');
    const { registerNamespaces } = await import('./dictionaries');
    registerNamespaces(landingBundle);
    void i18n;
    const after = renderToStaticMarkup(
      createElement(PlanText, { text: 'Standard TTS audio' }),
    );
    expect(after).toContain('Standard TTS audio');
  });

  it('renders dashboard copy translated right after registerRoute("dashboard")', async () => {
    await freshCore();
    const { registerRoute } = await import('./register/route');
    registerRoute('dashboard');
    const { translate } = await import('./index');
    const enTitle = translate('en', 'dashboard.welcome.title');
    expect(enTitle).toBeTruthy();
    expect(enTitle).not.toMatch(/^dashboard\./);
    expect(translate('mn', 'dashboard.welcome.title')).not.toMatch(/^dashboard\./);
  });

  it('update-toast keys resolve from CORE alone on any route', async () => {
    const i18n = await freshCore();
    for (const key of [
      'dashboard.update.title',
      'dashboard.update.body',
      'dashboard.update.reload',
      'dashboard.update.dismissAria',
    ]) {
      expect(i18n.translate('en', key as never)).not.toBe(key);
      expect(i18n.translate('mn', key as never)).not.toBe(key);
    }
  });
});
