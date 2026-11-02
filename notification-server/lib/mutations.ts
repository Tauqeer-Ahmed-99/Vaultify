import { adminAuth, atomic, db, HttpError } from './admin';
import { hash, key, object, text } from './http';
import { sendOnce } from './push';
import { cleanupMetadata } from './maintenance';
import type { Ledger, NotificationEvent, NotificationStatus, Operation, Recipient, Root, Transaction } from './model';

const DAY = 86_400_000;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function date(value: unknown) {
  const result = text(value, 40, 10);
  if (!Number.isFinite(Date.parse(result))) throw new HttpError(400, 'Choose a valid date.');
  return result;
}
function accountInput(value: unknown) {
  const data = object(value);
  return { accountName: text(data.accountName, 80), accountDescripton: text(data.accountDescripton, 500, 0), accountStartingDate: date(data.accountStartingDate) };
}
function transactionInput(value: unknown): Pick<Transaction, 'amount' | 'payment' | 'date' | 'reason'> {
  const data = object(value);
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 1e12) throw new HttpError(400, 'Enter a valid amount up to 1 trillion.');
  if (data.payment !== 'sent' && data.payment !== 'received') throw new HttpError(400, 'Choose a payment direction.');
  return { amount: data.amount, payment: data.payment, date: date(data.date), reason: text(data.reason, 500, 0) };
}
const name = (root: Root, uid: string) => (root.profiles?.[uid]?.username ? `@${root.profiles[uid].username}` : root.profiles?.[uid]?.displayName || 'Vaultify member').slice(0, 100);
function resolve(root: Root, identifier: string, actorUid: string, verified: boolean, expectedUid?: string) {
  const email = !identifier.startsWith('@') && identifier.includes('@');
  const username = identifier.replace(/^@/, '');
  if (email ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) : !/^[a-z0-9_]{3,24}$/.test(username)) throw new HttpError(400, 'Enter a valid email or username.');
  const matches = email ? Object.entries(root.emailDirectory || {}).filter(([, entry]) => entry.email === identifier).map(([uid]) => uid) : [root.usernames?.[username]].filter((uid): uid is string => !!uid);
  if (matches.length !== 1) throw new HttpError(409, 'Contact not found or ambiguous. Verify their username.');
  const uid = matches[0];
  if (uid === actorUid) throw new HttpError(400, 'Choose another person.');
  if (expectedUid && expectedUid !== uid) throw new HttpError(409, 'This contact changed. Verify it again.');
  const profile = root.profiles?.[uid];
  if (!profile || (verified && !profile.emailVerified)) throw new HttpError(400, 'This user needs a verified sharing profile.');
  return { uid, name: name(root, uid), identifier: email ? identifier : `@${username}` };
}

export async function mutate(uid: string, payload: Record<string, unknown>) {
  try { return await performMutation(uid, payload); }
  catch (error) {
    // A concurrent identical request may have committed while this request was
    // resolving a contact that subsequently changed. Confirm before reporting failure.
    if (typeof payload.operationId === 'string' && typeof payload.action === 'string') {
      const operationKey = hash(`${uid}:${payload.action}:${payload.operationId}`);
      const existing = await db().ref(`pushOperations/${operationKey}`).get().catch(() => null);
      const committed = existing?.val() as Operation | null;
      if (committed?.hash === hash(canonical(payload))) return committedResult(payload.action, committed.accountId, operationKey);
    }
    throw error;
  }
}

async function performMutation(uid: string, payload: Record<string, unknown>) {
  const operationId = text(payload.operationId, 80);
  if (!/^\d{13}_[a-f0-9-]{36}$/.test(operationId)) throw new HttpError(400, 'A stable operation ID is required.');
  const issuedAt = Number(operationId.slice(0, 13));
  const now = Date.now();
  if (issuedAt > now + 300_000 || issuedAt < now - 30 * DAY) throw new HttpError(409, 'Operation expired. Refresh before creating a new operation.');
  const action = text(payload.action, 32);
  if (!['createLedger', 'editPersonalLedger', 'createTransaction', 'invite'].includes(action)) throw new HttpError(400, 'Unknown mutation.');
  const kind = payload.kind;
  if (kind !== 'personal' && kind !== 'group') throw new HttpError(400, 'Invalid ledger kind.');
  if ((action === 'editPersonalLedger' && kind !== 'personal') || (action === 'invite' && kind !== 'group')) throw new HttpError(400, 'Invalid ledger operation.');
  const opKey = hash(`${uid}:${action}:${operationId}`);
  const payloadHash = hash(canonical(payload));
  const replay = (await db().ref(`pushOperations/${opKey}`).get()).val() as Operation | null;
  if (replay) {
    if (replay.hash !== payloadHash) throw new HttpError(409, 'Operation ID was reused with different data.');
    return committedResult(action, replay.accountId, opKey);
  }
  const accountId = action === 'createLedger' ? opKey : key(payload.accountId);
  const ownerUid = kind === 'group' || action === 'createLedger' ? uid : key(payload.ownerUid);
  const input = action === 'createLedger' || action === 'editPersonalLedger' ? accountInput(payload.data) : null;
  const txn = action === 'createTransaction' ? transactionInput(payload.data) : null;
  const contact = payload.contact === null || payload.contact === undefined ? null : object(payload.contact);
  const identifier = action === 'invite' ? text(payload.identifier, 254).toLowerCase() : contact ? text(contact.identifier, 254).toLowerCase() : null;
  const expectedUid = contact ? key(contact.uid) : undefined;
  // Admin Auth proof supplements rule-protected profile/directory identity. Check
  // again against the transactional directory below; never trust a submitted UID.
  let verifiedAuthUid: string | undefined;
  if (identifier) {
    const lookup: Root = {};
    if (!identifier.startsWith('@') && identifier.includes('@')) {
      lookup.emailDirectory = (await db().ref('emailDirectory').orderByChild('email').equalTo(identifier).limitToFirst(2).get()).val() || {};
      for (const recipient of Object.keys(lookup.emailDirectory!)) {
        (lookup.profiles ??= {})[recipient] = (await db().ref(`profiles/${recipient}`).get()).val();
      }
    } else {
      const username = identifier.replace(/^@/, '');
      if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new HttpError(400, 'Enter a valid username.');
      const recipient = (await db().ref(`usernames/${username}`).get()).val() as string | null;
      if (recipient) {
        lookup.usernames = { [username]: recipient };
        lookup.profiles = { [recipient]: (await db().ref(`profiles/${recipient}`).get()).val() };
      }
    }
    const resolved = resolve(lookup, identifier, uid, kind === 'personal', expectedUid);
    const record = await adminAuth().getUser(resolved.uid);
    if (record.disabled || (kind === 'personal' && !record.emailVerified) ||
      (!identifier.startsWith('@') && identifier.includes('@') && (!record.emailVerified || record.email?.toLowerCase() !== identifier))) throw new HttpError(409, 'Contact verification changed.');
    verifiedAuthUid = record.uid;
  }
  let event: NotificationEvent | undefined;
  await atomic(root => {
    event = undefined;
    const oldOperation = root.pushOperations?.[opKey];
    if (oldOperation) {
      if (oldOperation.hash !== payloadHash) throw new HttpError(409, 'Operation ID was reused with different data.');
      return;
    }
    if (issuedAt < now - DAY) throw new HttpError(409, 'Uncommitted operation is too old. Refresh before retrying.');
    const actorName = name(root, uid);
    const timestamp = new Date(now).toISOString();
    const resolved = identifier ? resolve(root, identifier, uid, kind === 'personal', expectedUid) : null;
    if (resolved && resolved.uid !== verifiedAuthUid) throw new HttpError(409, 'Contact changed. Verify it again.');
    let ledger: Ledger | undefined = kind === 'group' ? root.groupAccounts?.[accountId] : root.accounts?.[ownerUid]?.[accountId];
    let recipients: Recipient[] = [];
    let eventType: NotificationEvent['type'] | undefined;
    if (action === 'createLedger') {
      if (ledger) throw new HttpError(409, 'Ledger already exists.');
      if (kind === 'group' && contact) throw new HttpError(400, 'Invite members after creating the group.');
      const colorIndex = payload.colorIndex;
      if (typeof colorIndex !== 'number' || !Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex > 7) throw new HttpError(400, 'Invalid ledger color.');
      ledger = { ...input!, ownerUid: uid, ownerName: actorName, createdAt: timestamp, updatedAt: timestamp, colorIndex,
        ...(kind === 'group' ? { includeInTotalAssets: true } : {}) };
      if (kind === 'group') (root.groupAccounts ??= {})[accountId] = ledger;
      else ((root.accounts ??= {})[uid] ??= {})[accountId] = ledger;
    } else {
      if (!ledger) throw new HttpError(404, 'This account is no longer available.');
      if (kind === 'personal') ledger.ownerUid = ownerUid; // historical personal records derive ownership from their path
      const membership = root.memberships?.[`${accountId}_${uid}`];
      const accepted = kind === 'group' && membership?.status === 'accepted' && membership.invitedBy === ledger.ownerUid;
      if (ledger.ownerUid !== uid && !(action === 'createTransaction' && accepted)) throw new HttpError(403, 'You no longer have permission to do this.');
    }
    if (action === 'editPersonalLedger') Object.assign(ledger, input, { updatedAt: timestamp });
    if ((action === 'createLedger' || action === 'editPersonalLedger') && kind === 'personal') {
      const previous = ledger.linkedUserUid;
      if (previous !== resolved?.uid) {
        if (previous) delete root.personalLinks?.[previous]?.[`${uid}_${accountId}`];
        delete ledger.linkedUserUid; delete ledger.linkedUserName; delete ledger.linkedIdentifier; delete ledger.linkVersion;
        if (resolved) {
          Object.assign(ledger, { linkedUserUid: resolved.uid, linkedUserName: resolved.name, linkedIdentifier: resolved.identifier, linkVersion: opKey });
          (((root.personalLinks ??= {})[resolved.uid]) ??= {})[`${uid}_${accountId}`] = { ownerUid: uid, accountId };
          recipients = [{ uid: resolved.uid, epoch: opKey }]; eventType = 'link';
        }
      } else if (resolved) Object.assign(ledger, { linkedUserName: resolved.name, linkedIdentifier: resolved.identifier });
    }
    if (action === 'createTransaction') {
      if (ledger.transactions?.[opKey]) throw new HttpError(409, 'Transaction already exists.');
      (ledger.transactions ??= {})[opKey] = { ...txn!, ownerUid: uid, ownerName: actorName, createdAt: timestamp, updatedAt: timestamp };
      ledger.updatedAt = timestamp;
      if (kind === 'personal' && ledger.linkedUserUid) recipients = [{ uid: ledger.linkedUserUid, epoch: ledger.linkVersion || 'legacy' }];
      if (kind === 'group') {
        recipients = [{ uid: ledger.ownerUid, epoch: 'creator' }];
        for (const member of Object.values(root.memberships || {})) {
          if (member.accountId === accountId && member.status === 'accepted' && member.invitedBy === ledger.ownerUid && member.recipientUid !== ledger.ownerUid) recipients.push({ uid: member.recipientUid, epoch: `${member.createdAt}:${member.updatedAt}` });
        }
      }
      recipients = recipients.filter(recipient => recipient.uid !== uid);
      if (recipients.length > 200) throw new HttpError(409, 'This group exceeds the notification recipient limit (200).');
      eventType = 'transaction';
    }
    if (action === 'invite') {
      const memberId = `${accountId}_${resolved!.uid}`;
      const current = root.memberships?.[memberId];
      if (current?.status === 'pending' || current?.status === 'accepted') throw new HttpError(409, 'This person is already a member or has a pending invitation.');
      (root.memberships ??= {})[memberId] = { accountId, accountName: ledger.accountName, recipientUid: resolved!.uid, recipientName: resolved!.name,
        invitedBy: uid, inviterName: actorName, status: 'pending', createdAt: timestamp, updatedAt: timestamp };
      recipients = [{ uid: resolved!.uid, epoch: timestamp }]; eventType = 'invitation';
    }
    if (eventType && recipients.length) {
      event = { id: opKey, type: eventType, kind, accountId, ownerUid: ledger.ownerUid, actorUid: uid, actorName,
        ...(txn ? { transactionId: opKey } : {}), ...(action === 'invite' ? { invitationVersion: timestamp } : {}), recipients };
    }
    // Committing this record reserves the one allowed attempt for this request.
    // A concurrent request or an ambiguous-save retry must never send again.
    (root.pushOperations ??= {})[opKey] = { hash: payloadHash, accountId, notification: event ? 'unknown' : 'none', expiresAt: issuedAt + 31 * DAY };
  });
  if (!event) {
    await cleanupMetadata().catch(() => console.warn(JSON.stringify({ code: 'metadata_cleanup_deferred' })));
    return committedResult(action, accountId, opKey);
  }
  let notification: NotificationStatus = 'unknown';
  try {
    const summary = await sendOnce(event);
    notification = summary.status;
    await db().ref(`pushOperations/${opKey}`).update({ notification, notificationSummary: summary });
  } catch { console.warn(JSON.stringify({ code: 'push_attempt_not_retried', eventId: opKey })); }
  // Maintenance is opportunistic and never sends notifications or changes a save result.
  await cleanupMetadata().catch(() => console.warn(JSON.stringify({ code: 'metadata_cleanup_deferred' })));
  return response(action, accountId, opKey, notification);
}

async function committedResult(action: string, accountId: string, operationKey: string) {
  // Replays confirm the committed mutation only. They never initiate a push.
  const operation = (await db().ref(`pushOperations/${operationKey}`).get().catch(() => null))?.val() as Operation | null;
  return response(action, accountId, operationKey, operation?.notification || (operation?.eventId ? 'unknown' : 'none'));
}
function response(action: string, accountId: string, operationKey: string, notification: NotificationStatus) {
  return { committed: true, accountId, ...(action === 'createTransaction' ? { transactionId: operationKey } : {}),
    notification, notificationPending: false };
}
