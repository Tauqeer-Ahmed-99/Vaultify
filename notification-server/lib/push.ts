import { db, required } from './admin';
import type { Device, Ledger, Member, NotificationEvent, NotificationSummary, Recipient, Transaction } from './model';

interface DeviceTarget { uid: string; deviceId: string; token: string; generation: string }

export async function sendOnce(event: NotificationEvent): Promise<NotificationSummary> {
  const deadline = Date.now() + 12_000;
  const summary: NotificationSummary = { status: 'suppressed', attemptedDevices: 0, acceptedDevices: 0,
    failedDevices: 0, unknownDevices: 0, skippedRecipients: 0, suppressedRecipients: 0 };
  const seenTokens = new Set<string>();
  let cursor = 0;
  // At most six concurrent Expo connections. Each device appears in one request
  // only; failures, 429s and ambiguous timeouts are deliberately never retried.
  await Promise.all(Array.from({ length: Math.min(6, event.recipients.length) }, async () => {
    while (cursor < event.recipients.length) {
      const recipient = event.recipients[cursor++];
      if (Date.now() + 1500 >= deadline) { summary.skippedRecipients += 1; continue; }
      const targets: DeviceTarget[] = [];
      let attempted = false;
      try {
        const devices = (await db().ref(`pushDevices/${recipient.uid}`).orderByKey().limitToFirst(10).get()).val() as Record<string, Device> || {};
        const active = Object.entries(devices).filter(([, device]) => device.uid === recipient.uid && device.expiresAt > Date.now() && !seenTokens.has(device.token));
        if (!active.length) { summary.suppressedRecipients += 1; continue; }
        const allowed = await context(event, recipient);
        if (!allowed) { summary.suppressedRecipients += 1; continue; }
        if (Date.now() + 1000 >= deadline) { summary.skippedRecipients += 1; continue; }
        const messages = [];
        for (const [deviceId, device] of active) {
          if (seenTokens.has(device.token)) continue;
          seenTokens.add(device.token);
          targets.push({ uid: recipient.uid, deviceId, token: device.token, generation: device.generation });
          messages.push(message(event, recipient, device, allowed));
        }
        if (!messages.length) { summary.suppressedRecipients += 1; continue; }
        attempted = true;
        summary.attemptedDevices += messages.length;
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('EXPO_ACCESS_TOKEN')}` },
          body: JSON.stringify(messages), signal: AbortSignal.timeout(Math.max(1, Math.min(6000, deadline - Date.now()))),
        });
        if (!response.ok) {
          summary.failedDevices += targets.length;
          console.warn(JSON.stringify({ code: 'push_rejected', eventId: event.id, status: response.status }));
          continue;
        }
        const payload = await response.json() as { data?: { status?: string; details?: { error?: string } }[] };
        const tickets = Array.isArray(payload.data) ? payload.data : [];
        for (let index = 0; index < targets.length; index += 1) {
          const ticket = tickets[index];
          if (ticket?.status === 'ok') summary.acceptedDevices += 1;
          else if (ticket?.status === 'error') {
            summary.failedDevices += 1;
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await invalidate(targets[index]).catch(() => {
                console.warn(JSON.stringify({ code: 'device_cleanup_failed', eventId: event.id }));
              });
            }
          } else summary.unknownDevices += 1;
        }
      } catch {
        if (attempted) summary.unknownDevices += targets.length;
        else summary.skippedRecipients += 1;
        console.warn(JSON.stringify({ code: 'push_attempt_failed', eventId: event.id }));
      }
    }
  }));
  const lost = summary.failedDevices + summary.unknownDevices + summary.skippedRecipients;
  summary.status = summary.acceptedDevices ? lost ? 'partial' : 'accepted'
    : summary.unknownDevices || summary.skippedRecipients ? 'unknown'
    : summary.failedDevices ? 'failed' : 'suppressed';
  return summary;
}

function message(event: NotificationEvent, recipient: Recipient, device: Device,
  { ledger, transaction, hideDetails }: NonNullable<Awaited<ReturnType<typeof context>>>) {
  let body = event.type === 'invitation' ? `${event.actorName} invited you to ${ledger.accountName}.` : `${event.actorName} shared ${ledger.accountName} with you.`;
  if (transaction) {
    const direction = event.kind === 'personal' ? transaction.payment === 'sent' ? 'received' : 'sent' : transaction.payment;
    const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(transaction.amount);
    const note = transaction.reason.replace(/[\r\n\t]+/g, ' ').slice(0, 90);
    const transactionDate = Number.isFinite(Date.parse(transaction.date)) ? new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: device.timeZone || 'UTC',
    }).format(new Date(transaction.date)) : 'Date unavailable';
    body = hideDetails ? 'A new transaction was recorded. Open Vaultify to view it.' : event.kind === 'group'
      ? `${event.actorName} recorded ${amount} as ${direction} in this group ledger · ${transactionDate}${note ? ` · ${note}` : ''}`
      : `${event.actorName} recorded ${amount} ${direction} from your perspective · ${transactionDate}${note ? ` · ${note}` : ''}`;
  }
  return { to: device.token, title: transaction && hideDetails ? 'Vaultify' : ledger.accountName, body,
    sound: 'default', channelId: 'ledger-updates', ttl: 3600,
    data: { v: 1, eventId: event.id, recipientUid: recipient.uid, type: event.type, kind: event.kind,
      ownerUid: event.ownerUid, accountId: event.accountId, ...(event.transactionId ? { transactionId: event.transactionId } : {}) } };
}
async function context(event: NotificationEvent, recipient: Recipient) {
  const base = event.kind === 'group' ? `groupAccounts/${event.accountId}` : `accounts/${event.ownerUid}/${event.accountId}`;
  // Exact fields, never a scan of transaction history or the database root.
  const fields = ['ownerUid', 'accountName', 'linkedUserUid', 'linkVersion'] as const;
  const snapshots = await Promise.all(fields.map(field => db().ref(`${base}/${field}`).get()));
  const ledger = Object.fromEntries(fields.map((field, index) => [field, snapshots[index].val()])) as Ledger;
  if (!ledger.ownerUid || ledger.ownerUid !== event.ownerUid) return null;
  const preferences = (await db().ref(`pushPreferences/${recipient.uid}`).get()).val();
  if (preferences?.enabled === false) return null;
  let transaction: Transaction | null = null;
  if (event.type === 'invitation') {
    const member = (await db().ref(`memberships/${event.accountId}_${recipient.uid}`).get()).val() as Member | null;
    if (!member || member.status !== 'pending' || member.invitedBy !== ledger.ownerUid || member.createdAt !== event.invitationVersion) return null;
  } else if (event.kind === 'personal') {
    if (ledger.linkedUserUid !== recipient.uid || (ledger.linkVersion || 'legacy') !== recipient.epoch) return null;
    const reference = (await db().ref(`personalLinks/${recipient.uid}/${event.ownerUid}_${event.accountId}`).get()).val();
    if (reference?.ownerUid !== event.ownerUid || reference.accountId !== event.accountId) return null;
  } else if (recipient.epoch === 'creator') {
    if (recipient.uid !== ledger.ownerUid) return null;
  } else {
    const member = (await db().ref(`memberships/${event.accountId}_${recipient.uid}`).get()).val() as Member | null;
    if (!member || member.status !== 'accepted' || member.invitedBy !== ledger.ownerUid || `${member.createdAt}:${member.updatedAt}` !== recipient.epoch) return null;
  }
  if (event.type === 'transaction') {
    transaction = (await db().ref(`${base}/transactions/${event.transactionId}`).get()).val();
    if (!transaction) return null;
  }
  return { ledger, transaction, hideDetails: preferences?.hideDetails === true };
}

async function invalidate(delivery: DeviceTarget) {
  const target = db().ref(`pushDevices/${delivery.uid}/${delivery.deviceId}`);
  await target.get();
  await target.transaction((device: Device | null) => device?.generation === delivery.generation && device.token === delivery.token ? null : undefined);
  // The installation proof remains so a later refresh can safely re-register.
}
