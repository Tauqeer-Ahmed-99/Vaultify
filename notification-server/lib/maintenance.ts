import { db } from './admin';
import { cleanupDevices } from './devices';

// Bounded retention on normal mutations, with no scheduler or background work.
// This never delivers or retries a push. Idle databases need operator cleanup.
export async function cleanupMetadata() {
  const now = Date.now();
  const deadline = now + 2000;
  for (const [path, index, cutoff] of [
    ['pushOperations', 'expiresAt', now], ['pushRateLimits', 'until', now - 86400_000],
  ] as const) {
    if (Date.now() >= deadline) return;
    const stale = await db().ref(path).orderByChild(index).startAt(1).endAt(cutoff).limitToFirst(5).get();
    for (const id of Object.keys(stale.val() || {})) {
      if (Date.now() >= deadline) return;
      const target = db().ref(`${path}/${id}`);
      await target.get();
      await target.transaction(current => current && current[index] <= cutoff ? null : undefined);
    }
  }
  if (Date.now() < deadline) await cleanupDevices(now);
}
