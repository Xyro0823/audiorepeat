'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthIdToken } from '@/lib/authStore';
import { checkAdminAccess } from '@/lib/adminDiagnostics';
import { resolveAdminStatus, type AdminGate } from '@/lib/adminNav';

/**
 * Client-side admin gate for NAV VISIBILITY ONLY — never a security control.
 *
 * The actual check is server-side: the caller's Firebase ID token is sent to
 * /api/admin/status, which verifies it against the ADMIN_UIDS allowlist and
 * returns 200 only for allowlisted admins. This hook maps that verdict onto
 * the UI gate via resolveAdminStatus() (fail-closed: forbidden / server
 * error / missing token all hide admin UI).
 *
 * Results are cached in memory per uid for the session (never persisted to
 * localStorage), so multiple components don't fire duplicate verification
 * requests. While verifying — or for any uid whose result is unknown — the
 * gate is 'not-admin', so admin links never flash before verification.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { gate: Exclude<AdminGate, 'checking'>; at: number }>();

export function useAdminStatus(): AdminGate {
  const { status, user } = useAuth();
  const uid = status === 'signed-in' ? (user?.id ?? null) : null;

  // Track which uid the current gate belongs to: if the signed-in user
  // changes (or is unknown), the gate fails closed instead of carrying the
  // previous account's verdict across the switch.
  const [state, setState] = useState<{ uid: string | null; gate: AdminGate }>(() => {
    if (!uid) return { uid: null, gate: 'not-admin' };
    const hit = cache.get(uid);
    return hit && Date.now() - hit.at < CACHE_TTL_MS ? { uid, gate: hit.gate } : { uid, gate: 'not-admin' };
  });

  const gate: AdminGate = state.uid === uid ? state.gate : 'not-admin';

  useEffect(() => {
    // Capture a definitely-non-null const so the async closure keeps a
    // string type (TS doesn't carry the guard narrowing into closures).
    if (uid === null) return;
    const uidKey: string = uid;
    const hit = cache.get(uidKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return; // verified this session — no refetch
    let cancelled = false;
    async function verify() {
      const token = await getAuthIdToken().catch(() => null);
      const result = await checkAdminAccess({ token });
      if (cancelled) return;
      const verdict = resolveAdminStatus(result);
      cache.set(uidKey, { gate: verdict, at: Date.now() });
      setState({ uid: uidKey, gate: verdict });
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return gate;
}
