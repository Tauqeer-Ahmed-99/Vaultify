import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { auth } from '../firebaseConfig';
import type { User } from 'firebase/auth';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function notificationApi<T>(path: string, data?: unknown, user: User | null = auth.currentUser): Promise<T> {
  if (!user) throw new Error('Sign in to continue.');
  const base = process.env.EXPO_PUBLIC_NOTIFICATION_API_URL?.replace(/\/$/, '');
  if (!base || !/^https:\/\//.test(base)) throw new Error('This app needs the notification API configured. Please update or contact support.');
  const response = await fetch(`${base}/api/${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error || 'Could not save. Retry shortly.', response.status);
  return result as T;
}

export interface MutationResult { committed: true; accountId: string; transactionId?: string; notification: 'none' | 'accepted' | 'suppressed' | 'failed' | 'partial' | 'unknown'; notificationPending: false }
let mutationTail: Promise<unknown> = Promise.resolve();
const inFlightMutations = new Map<string, Promise<MutationResult>>();
export function notificationMutation(payload: Record<string, unknown>): Promise<MutationResult> {
  const user = auth.currentUser;
  if (!user) return Promise.reject(new Error('Sign in to continue.'));
  const flightKey = `${user.uid}:${JSON.stringify(payload)}`;
  const existing = inFlightMutations.get(flightKey);
  if (existing) return existing;
  const run = async () => {
    if (auth.currentUser?.uid !== user.uid) throw new Error('Your account changed. Please reopen this form.');
    const serialized = JSON.stringify(payload);
    const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, serialized);
    const storageKey = `vaultify:mutation:${user.uid}:${fingerprint}`;
    // Retain the same operation through ambiguous timeouts, remounts and restarts.
    // A successful response clears it, allowing a later intentional identical entry.
    let operationId = await AsyncStorage.getItem(storageKey);
    if (!operationId) {
      operationId = `${Date.now()}_${Crypto.randomUUID()}`;
      await AsyncStorage.setItem(storageKey, operationId);
    }
    try {
      const result = await notificationApi<MutationResult>('mutations', { ...payload, operationId }, user);
      // A local cache cleanup error cannot turn a committed save into a failure.
      await AsyncStorage.removeItem(storageKey).catch(() => undefined);
      return result;
    } catch (error) {
      if (error instanceof ApiError && [400, 403, 404, 409, 413, 415].includes(error.status)) await AsyncStorage.removeItem(storageKey).catch(() => undefined);
      throw error instanceof ApiError ? error : new Error('Save confirmation was interrupted. Retry the same values to confirm this operation safely.');
    }
  };
  const result = mutationTail.then(run, run).finally(() => { inFlightMutations.delete(flightKey); });
  inFlightMutations.set(flightKey, result);
  mutationTail = result.catch(() => undefined);
  return result;
}
