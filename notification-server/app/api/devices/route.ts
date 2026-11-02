import { actor, body, endpoint, preflight } from '../../../lib/http';
import { device } from '../../../lib/devices';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return endpoint(request, async () => device(await actor(request), await body(request)));
}
export const OPTIONS = preflight;
