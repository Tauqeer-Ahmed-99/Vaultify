export interface Ledger {
  ownerUid: string; ownerName: string; accountName: string; accountDescripton: string;
  accountStartingDate: string; createdAt: string; updatedAt: string; colorIndex: number;
  includeInTotalAssets?: boolean; linkedUserUid?: string; linkedUserName?: string;
  linkedIdentifier?: string; linkVersion?: string; transactions?: Record<string, Transaction>;
}
export interface Transaction {
  amount: number; payment: 'sent' | 'received'; date: string; reason: string;
  ownerUid: string; ownerName: string; createdAt: string; updatedAt: string;
}
export interface Member {
  accountId: string; accountName: string; recipientUid: string; recipientName: string;
  invitedBy: string; inviterName: string; status: string; createdAt: string; updatedAt: string;
}
export interface Recipient { uid: string; epoch: string }
export type NotificationStatus = 'none' | 'accepted' | 'suppressed' | 'failed' | 'partial' | 'unknown';
export interface NotificationSummary {
  status: NotificationStatus; attemptedDevices: number; acceptedDevices: number;
  failedDevices: number; unknownDevices: number; skippedRecipients: number; suppressedRecipients: number;
}
export interface NotificationEvent {
  id: string; type: 'transaction' | 'link' | 'invitation'; kind: 'personal' | 'group';
  accountId: string; ownerUid: string; actorUid: string; actorName: string;
  transactionId?: string; invitationVersion?: string; recipients: Recipient[];
}
export interface Operation {
  hash: string; accountId: string; expiresAt: number;
  notification?: NotificationStatus; notificationSummary?: NotificationSummary;
  eventId?: string; // legacy operation metadata; never resumes old outbox work
}
export interface Device {
  uid: string; token: string; generation: string; secretHash: string; expiresAt: number; updatedAt: number;
  timeZone?: string;
}
export interface Root {
  accounts?: Record<string, Record<string, Ledger>>; groupAccounts?: Record<string, Ledger>;
  memberships?: Record<string, Member>;
  personalLinks?: Record<string, Record<string, { ownerUid: string; accountId: string }>>;
  profiles?: Record<string, { displayName: string; username?: string; emailVerified?: boolean }>;
  usernames?: Record<string, string>; emailDirectory?: Record<string, { email: string }>;
  pushOperations?: Record<string, Operation>;
  pushDevices?: Record<string, Record<string, Device>>;
  pushInstallations?: Record<string, Device>;
  pushTokenOwners?: Record<string, { uid: string; deviceId: string }>;
  pushPreferences?: Record<string, { enabled: boolean; hideDetails: boolean }>;
}
