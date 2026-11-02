import { actor, body, endpoint, preflight } from '../../../lib/http';
import { preferences } from '../../../lib/devices';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return endpoint(request, async () => preferences(await actor(request)));
}
export function POST(request: Request) {
  return endpoint(request, async () => preferences(await actor(request), await body(request)));
}
export const OPTIONS = preflight;
