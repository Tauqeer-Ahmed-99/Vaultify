export interface Transaction {
  id: string;
  amount: number;
  payment: 'sent' | 'received';
  date: string;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
  ownerUid?: string;
  ownerName?: string;
}

export interface Account {
  id: string;
  accountName: string;
  accountDescripton: string;
  accountStartingDate: string;
  transactions: Transaction[];
  createdAt?: string;
  updatedAt?: string;
  colorIndex?: number;
  kind: 'personal' | 'group';
  includeInTotalAssets: boolean;
  ownerUid: string;
  ownerName?: string;
  linkedUserUid?: string;
  linkedUserName?: string;
  linkedIdentifier?: string;
  sourceAccountId?: string;
  isLinkedViewer?: boolean;
}

export type AccountInput = Pick<Account, 'accountName' | 'accountDescripton' | 'accountStartingDate'>;
export type TransactionInput = Pick<Transaction, 'amount' | 'payment' | 'date' | 'reason'>;
export type MembershipStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'removed' | 'left';

export interface Membership {
  id: string;
  accountId: string;
  accountName: string;
  recipientUid: string;
  recipientName: string;
  invitedBy: string;
  inviterName: string;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  displayName: string;
  username?: string;
  emailVerified?: boolean;
}

export interface PersonalLedgerContact {
  uid: string;
  name: string;
  identifier: string;
}

export interface PersonalLedgerReference {
  ownerUid: string;
  accountId: string;
}
