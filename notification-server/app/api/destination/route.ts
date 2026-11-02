import { db } from '../../../lib/admin';
import { actor, body, endpoint, key, preflight } from '../../../lib/http';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return endpoint(request, async () => {
    const uid = await actor(request);
    const data = await body(request);
    const accountId = key(data.accountId);
    const ownerUid = key(data.ownerUid);
    const base = data.kind === 'group' ? `groupAccounts/${accountId}` : `accounts/${ownerUid}/${accountId}`;
    const currentOwner = (await db().ref(`${base}/ownerUid`).get()).val();
    let available = false;
    if (data.kind === 'personal') {
      // Historical personal ownership is also established by its path.
      const exists = (await db().ref(`${base}/accountName`).get()).exists();
      const linkedUid = (await db().ref(`${base}/linkedUserUid`).get()).val();
      available = exists && (uid === ownerUid || linkedUid === uid);
    } else if (data.kind === 'group' && currentOwner) {
      const member = (await db().ref(`memberships/${accountId}_${uid}`).get()).val();
      available = currentOwner === uid || (member?.status === 'accepted' && member.invitedBy === currentOwner);
    }
    const transactionAvailable = available && (data.transactionId === undefined || (await db().ref(`${base}/transactions/${key(data.transactionId)}`).get()).exists());
    return { ledgerAvailable: available, transactionAvailable };
  });
}
export const OPTIONS = preflight;
