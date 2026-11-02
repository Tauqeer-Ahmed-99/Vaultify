import { randomUUID } from 'node:crypto';
import { atomic, db, HttpError, required } from './admin';
import { hash, key, text } from './http';
import type { Root } from './model';

function removeDevice(root: Root, deviceId: string) {
  const old = root.pushInstallations?.[deviceId];
  if (!old) return;
  delete root.pushDevices?.[old.uid]?.[deviceId];
  const tokenKey = hash(old.token);
  if (root.pushTokenOwners?.[tokenKey]?.deviceId === deviceId) delete root.pushTokenOwners[tokenKey];
}
export async function device(uid: string, payload: Record<string, unknown>) {
  const deviceId = key(payload.deviceId);
  const secret = text(payload.secret, 100, 64);
  const secretHash = hash(secret);
  const unregister = payload.unregister === true;
  const token = unregister ? '' : text(payload.token, 300);
  const timeZone = unregister ? 'UTC' : text(payload.timeZone || 'UTC', 100);
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); }
  catch { throw new HttpError(400, 'Invalid device time zone.'); }
  if (!unregister && (!/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token) || payload.projectId !== required('EXPO_PROJECT_ID'))) throw new HttpError(400, 'Invalid project-scoped push token.');
  await atomic(root => {
    const previous = root.pushInstallations?.[deviceId];
    if (previous && previous.secretHash !== secretHash) throw new HttpError(403, 'Invalid installation proof.');
    if (unregister) {
      if (previous?.uid === uid) {
        removeDevice(root, deviceId);
        delete root.pushInstallations?.[deviceId];
      }
      return;
    }
    // Free expired slots during registration; no scheduled cleanup is required.
    for (const [id, entry] of Object.entries(root.pushDevices?.[uid] || {})) {
      if (entry.expiresAt <= Date.now()) { removeDevice(root, id); delete root.pushInstallations?.[id]; }
    }
    const existingDevices = Object.keys(root.pushDevices?.[uid] || {}).filter(id => id !== deviceId);
    if (existingDevices.length >= 10) throw new HttpError(409, 'At most 10 devices can receive notifications per account.');
    removeDevice(root, deviceId);
    // Expo may issue the same token after reinstall. Transfer it, never keep it
    // subscribed to two users, and invalidate deliveries with the old generation.
    const duplicate = root.pushTokenOwners?.[hash(token)];
    if (duplicate && duplicate.deviceId !== deviceId) removeDevice(root, duplicate.deviceId);
    const registration = { uid, token, secretHash, timeZone, generation: previous?.uid === uid && previous.token === token ? previous.generation : randomUUID(), updatedAt: Date.now(), expiresAt: Date.now() + 7 * 86400_000 };
    ((root.pushDevices ??= {})[uid] ??= {})[deviceId] = registration;
    (root.pushInstallations ??= {})[deviceId] = registration;
    (root.pushTokenOwners ??= {})[hash(token)] = { uid, deviceId };
  });
  return { registered: !unregister };
}
export async function preferences(uid: string, payload?: Record<string, unknown>) {
  const target = db().ref(`pushPreferences/${uid}`);
  if (payload) {
    if (typeof payload.enabled !== 'boolean' || typeof payload.hideDetails !== 'boolean') throw new HttpError(400, 'Invalid notification preferences.');
    await target.set({ enabled: payload.enabled, hideDetails: payload.hideDetails });
  }
  return (await target.get()).val() || { enabled: true, hideDetails: false };
}

export async function cleanupDevices(now: number) {
  const stale = await db().ref('pushInstallations').orderByChild('expiresAt').endAt(now).limitToFirst(5).get();
  const ids = Object.keys(stale.val() || {});
  if (ids.length) await atomic(root => {
    for (const id of ids) {
      if (root.pushInstallations?.[id] && root.pushInstallations[id].expiresAt <= now) {
        removeDevice(root, id); delete root.pushInstallations[id];
      }
    }
  });
  return ids.length;
}
