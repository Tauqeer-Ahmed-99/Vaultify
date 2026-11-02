import { createHash } from 'node:crypto';
import { adminAuth, db, HttpError } from './admin';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid payload.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max: number, min = 1): string {
  if (typeof value !== 'string' || value.length > max || value.trim().length < min) throw new HttpError(400, 'Invalid text field.');
  return value.trim();
}
export function key(value: unknown): string {
  const id = text(value, 128);
  if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'Invalid identifier.');
  return id;
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'JSON required.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Body required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new HttpError(413, 'Payload too large.'); }
    chunks.push(value);
  }
  try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid JSON.'); }
}
export async function actor(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token || token.length > 8192) throw new HttpError(401, 'Sign in to continue.');
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token, true)).uid; }
  catch { throw new HttpError(401, 'Your session expired. Sign in again.'); }
  // Persistent per-user fixed window; Vercel Firewall should also bound unauthenticated traffic.
  const now = Date.now();
  const target = db().ref(`pushRateLimits/${uid}`);
  const result = await target.transaction(current => {
    if (!current || current.until < now) return { count: 1, until: now + 60_000 };
    if (current.count >= 60) return;
    return { count: current.count + 1, until: current.until };
  });
  if (!result.committed) throw new HttpError(429, 'Too many requests. Retry in a minute.');
  return uid;
}
export function cors(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = (process.env.ALLOWED_WEB_ORIGINS || '').split(',').filter(Boolean);
  if (origin && !allowed.includes(origin)) throw new HttpError(403, 'Origin not allowed.');
  return { 'Cache-Control': 'no-store', Vary: 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) };
}
export async function endpoint(request: Request, action: () => Promise<unknown>) {
  try { const headers = cors(request); return Response.json(await action(), { headers }); }
  catch (error) {
    const known = error instanceof HttpError;
    if (!known) console.error(JSON.stringify({ code: 'server_error' }));
    return Response.json({ error: known ? error.message : 'Service unavailable. Retry with the same operation ID.' },
      { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store', ...(request.headers.get('origin') && (process.env.ALLOWED_WEB_ORIGINS || '').split(',').includes(request.headers.get('origin')!) ? { 'Access-Control-Allow-Origin': request.headers.get('origin')! } : {}) } });
  }
}
export function preflight(request: Request) {
  return endpoint(request, async () => ({})).then(response => {
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return response;
  });
}
