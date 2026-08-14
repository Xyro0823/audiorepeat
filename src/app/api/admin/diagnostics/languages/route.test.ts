import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const verifyAdminRequest = vi.fn();
  return { verifyAdminRequest };
});

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
}));

// Real analysis by default; loadRepo can be flipped to throw so the route's
// 500 data-failure path is exercised without touching Firebase. `vi.fn(real)`
// wraps the real implementation directly (no re-import), so only the 500 test
// needs mockImplementationOnce.
vi.mock('@/lib/vocabHealth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vocabHealth')>();
  return {
    ...actual,
    loadRepo: vi.fn(actual.loadRepo),
  };
});

import { GET } from '@/app/api/admin/diagnostics/languages/route';
import { loadRepo } from '@/lib/vocabHealth';

function diagRequest(token?: string): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://audiorepeat.vercel.app/api/admin/diagnostics/languages', { headers });
}

beforeEach(() => {
  h.verifyAdminRequest.mockReset();
  vi.mocked(loadRepo).mockClear();
});

describe('GET /api/admin/diagnostics/languages — authorization', () => {
  it('returns 401 for an unauthenticated request', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 401, error: 'unauthenticated' });
    const res = await GET(diagRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(loadRepo).not.toHaveBeenCalled();
  });

  it('returns 403 for a valid token that is not on the allowlist', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await GET(diagRequest('user-token'));
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 503 when the admin layer is not configured', async () => {
    h.verifyAdminRequest.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'auth-server-not-configured',
    });
    const res = await GET(diagRequest('token'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('GET /api/admin/diagnostics/languages — admin success', () => {
  it('returns the live vocabulary health report with no-store', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-1' });
    const res = await GET(diagRequest('admin-token'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const report = (await res.json()) as Record<string, unknown>;
    expect(report.status).toBe('ok');

    // Dashboard summary — live repository-backed analysis, not hardcoded in
    // the route (the route calls analyze(loadRepo()) directly).
    const counts = report.counts as {
      packLanguages: number;
      bankFiles: number;
      totalVocabPairs: number;
      topics: number;
      topicLanguages: number;
      totalTopicPairs: number;
    };
    expect(counts.packLanguages).toBe(13);
    expect(counts.bankFiles).toBe(78);
    expect(counts.totalVocabPairs).toBe(34_716);
    expect(counts.topics).toBe(19);
    expect(counts.topicLanguages).toBe(15);
    expect(counts.totalTopicPairs).toBe(11_595);
  });

  it('exposes hardErrors, variantRows and failures for the diagnostics UI', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-1' });
    const res = await GET(diagRequest('admin-token'));
    const report = (await res.json()) as {
      failures: unknown[];
      warnings: unknown[];
      hardErrorRows: unknown[];
      variantRows: unknown[];
      terminology: { violations: unknown[] };
      topicDetails: unknown[];
    };
    expect(Array.isArray(report.failures)).toBe(true);
    expect(Array.isArray(report.warnings)).toBe(true);
    expect(Array.isArray(report.hardErrorRows)).toBe(true);
    expect(report.hardErrorRows).toHaveLength(0); // healthy current data
    expect(report.variantRows.length).toBeGreaterThan(0); // review rows exist
    expect(report.variantRows.length).toBe(1_505);
    expect(report.terminology.violations).toEqual([]);
    expect(report.topicDetails.length).toBe(19);
  });

  it('never leaks secrets or private auth data', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-1' });
    const res = await GET(diagRequest('admin-token'));
    const text = await res.text();

    // No credential material, allowlist values, auth tokens, or user records.
    expect(text).not.toMatch(/ADMIN_UIDS/i);
    expect(text).not.toMatch(/FIREBASE_SERVICE_ACCOUNT|private_key|client_email/i);
    expect(text).not.toMatch(/Bearer /i);
    expect(text).not.toMatch(/authorization/i);
    expect(text).not.toMatch(/pdl_|PADDLE_WEBHOOK_SECRET|api[_-]?key/i);
    expect(text).not.toMatch(/VERCEL_BYPASS|bypass/i);
    // The admin uid from the (mocked) request must not appear either.
    expect(text).not.toContain('admin-1');

    // Only expected top-level report keys.
    const report = JSON.parse(text) as Record<string, unknown>;
    for (const key of Object.keys(report)) {
      expect([
        'status',
        'counts',
        'perLanguage',
        'topicStats',
        'topicDetails',
        'topicLanguageSummary',
        'topicCoverage',
        'crossLevel',
        'isolation',
        'terminology',
        'b1Overlap',
        'variantRows',
        'hardErrorRows',
        'warnings',
        'failures',
      ]).toContain(key);
    }
  });

  it('returns 500 with no-store when vocabulary data cannot be loaded', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-1' });
    vi.mocked(loadRepo).mockImplementationOnce(() => {
      throw new Error('simulated data load failure');
    });
    const res = await GET(diagRequest('admin-token'));
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'diagnostics-unavailable' });
  });
});
