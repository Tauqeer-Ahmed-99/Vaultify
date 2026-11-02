import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import type { Root } from './model';

function app() {
  return getApps()[0] || initializeApp({
    credential: cert(JSON.parse(required('FIREBASE_ADMIN_SERVICE_ACCOUNT'))),
    databaseURL: required('FIREBASE_DATABASE_URL'),
  });
}
export function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing server configuration: ${key}`);
  return value;
}
export const db = () => getDatabase(app());
export const adminAuth = () => getAuth(app());
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
// Existing data lives in separate top-level trees. A root CAS is necessary to
// serialize permission checks, link indexes, mutation and idempotency.
// Fail closed at a conservative size; see deployment guide's scaling boundary.
export async function atomic(change: (root: Root) => void) {
  const target = db().ref();
  await target.get(); // transaction callbacks can initially see a cold null cache
  const result = await target.transaction((value: Root | null) => {
    const root = value || {};
    if (Buffer.byteLength(JSON.stringify(root)) > 16 * 1024 * 1024) {
      throw new HttpError(503, 'Database capacity requires operator attention.');
    }
    change(root);
    if (Buffer.byteLength(JSON.stringify(root)) > 16 * 1024 * 1024) {
      throw new HttpError(503, 'Database capacity requires operator attention.');
    }
    return root;
  }, undefined, false);
  if (!result.committed) throw new HttpError(409, 'Data changed. Retry the same operation.');
}
