import { Timestamp, type Firestore } from 'firebase-admin/firestore';

/**
 * Billing-free fallback for Firestore TTL. Each new diagnostic write removes a
 * small batch of already-expired documents. Keeping this bounded avoids a
 * monitoring request turning into an unbounded delete job.
 */
export async function pruneExpiredDiagnostics(
  db: Firestore,
  collectionName: string,
  now = Timestamp.now(),
  limit = 100,
): Promise<number> {
  const expired = await db
    .collection(collectionName)
    .where('expiresAt', '<=', now)
    .limit(limit)
    .get();
  if (expired.empty) return 0;

  const batch = db.batch();
  for (const doc of expired.docs) batch.delete(doc.ref);
  await batch.commit();
  return expired.size;
}
