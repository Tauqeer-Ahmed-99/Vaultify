import { actor, body, endpoint, preflight } from '../../../lib/http';
import { mutate } from '../../../lib/mutations';
export const runtime = 'nodejs';
export const maxDuration = 60;
export function POST(request: Request) {
  return endpoint(request, async () => mutate(await actor(request), await body(request)));
}
export const OPTIONS = preflight;
