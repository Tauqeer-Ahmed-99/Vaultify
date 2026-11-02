import React, { createContext, useContext, useEffect, useState } from 'react';
import { equalTo, get, onValue, orderByChild, query, ref, runTransaction, update } from 'firebase/database';
import { database } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import { Account, AccountInput, Membership, MembershipStatus, PersonalLedgerContact, PersonalLedgerReference, Transaction, TransactionInput } from '../types';
import { notificationMutation } from '../services/notificationApi';

interface AccountsContextType {
  accounts: Account[];
  memberships: Membership[];
  isLoading: boolean;
  error: string | null;
  fetchAccounts: () => Promise<void>;
  addAccount: (account: AccountInput, kind?: Account['kind'], contact?: PersonalLedgerContact | null) => Promise<string>;
  editAccount: (accountId: string, data: AccountInput, contact?: PersonalLedgerContact | null) => Promise<void>;
  setAccountIncludedInTotalAssets: (accountId: string, included: boolean) => Promise<void>;
  deleteAccounts: (ids: string[]) => Promise<void>;
  addTransaction: (accountId: string, txn: TransactionInput) => Promise<void>;
  editTransaction: (accountId: string, txnId: string, data: TransactionInput) => Promise<void>;
  deleteTransactions: (accountId: string, txnIds: string[]) => Promise<void>;
  inviteMember: (accountId: string, identifier: string) => Promise<void>;
  changeMembership: (membership: Membership, status: MembershipStatus) => Promise<void>;
  canEditTransaction: (account: Account, txn: Transaction) => boolean;
  getTotalAssets: () => number;
  getAccountBalance: (account: Account) => number;
}

const AccountsContext = createContext<AccountsContextType | null>(null);
export const useAccounts = () => {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccounts must be used within AccountsProvider');
  return context;
};

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Auth changes discard all cached account data and listeners.
  return <AccountsSession key={user?.uid || 'signed-out'}>{children}</AccountsSession>;
}

function decodeAccount(id: string, raw: any, kind: Account['kind'], personalOwner: string, viewerUid = personalOwner): Account {
  const isLinkedViewer = kind === 'personal' && viewerUid !== personalOwner;
  const transactions: Transaction[] = Object.entries(raw.transactions || {}).map(([txnId, txn]: [string, any]) => ({
    ...txn, id: txnId, amount: Number(txn.amount) || 0,
    payment: isLinkedViewer ? txn.payment === 'sent' ? 'received' : 'sent' : txn.payment,
    reason: txn.reason || '', date: txn.date || '',
    ownerUid: txn.ownerUid || (kind === 'personal' ? personalOwner : undefined),
  }));
  return {
    id: isLinkedViewer ? `linked_${personalOwner}_${id}` : id, kind,
    includeInTotalAssets: kind === 'personal' || raw.includeInTotalAssets !== false,
    ownerUid: kind === 'personal' ? personalOwner : raw.ownerUid,
    ownerName: raw.ownerName,
    sourceAccountId: id,
    isLinkedViewer,
    linkedUserUid: raw.linkedUserUid,
    linkedUserName: raw.linkedUserName,
    linkedIdentifier: raw.linkedIdentifier,
    accountName: raw.accountName || 'Untitled',
    accountDescripton: raw.accountDescripton || '',
    accountStartingDate: raw.accountStartingDate || '',
    colorIndex: raw.colorIndex,
    createdAt: raw.createdAt,
    updatedAt: transactions.reduce((latest, txn) => txn.updatedAt && txn.updatedAt > latest ? txn.updatedAt : latest, raw.updatedAt || ''),
    transactions,
  };
}

function validateAccount(data: AccountInput): AccountInput {
  const name = data.accountName.trim();
  if (!name || name.length > 80) throw new Error('Use an account name between 1 and 80 characters.');
  if (data.accountDescripton.length > 500) throw new Error('Keep the description under 500 characters.');
  if (!Number.isFinite(Date.parse(data.accountStartingDate))) throw new Error('Choose a valid starting date.');
  return { ...data, accountName: name, accountDescripton: data.accountDescripton.trim() };
}

function validateTransaction(txn: TransactionInput): TransactionInput {
  if (!Number.isFinite(txn.amount) || txn.amount <= 0 || txn.amount > 1e12) throw new Error('Enter a valid amount up to 1 trillion.');
  if (!['sent', 'received'].includes(txn.payment)) throw new Error('Choose a payment direction.');
  if (!Number.isFinite(Date.parse(txn.date))) throw new Error('Choose a valid transaction date.');
  if (txn.reason.length > 500) throw new Error('Keep the transaction note under 500 characters.');
  return { amount: txn.amount, payment: txn.payment, date: txn.date, reason: txn.reason.trim() };
}

function AccountsSession({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(!!uid);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    let personal: Account[] = [];
    let owned: Account[] = [];
    let invitations: Membership[] = [];
    const shared = new Map<string, Account>();
    const linked = new Map<string, Account>();
    const stops = new Map<string, () => void>();
    const linkedStops = new Map<string, () => void>();
    const waiting = new Set<string>();
    const ready = new Set<string>();
    const publish = () => {
      if (!active) return;
      const all = new Map([...personal, ...owned, ...shared.values(), ...linked.values()].map(account => [account.id, account]));
      setAccounts([...all.values()]);
      setMemberships(invitations);
      setIsLoading(ready.size < 4 || waiting.size > 0);
    };
    const failed = (source: string) => {
      if (!active) return;
      ready.add(source);
      setError('Some accounts could not be loaded. Check your connection and retry.');
      publish();
    };
    const stopPersonal = onValue(ref(database, `accounts/${uid}`), snapshot => {
      personal = Object.entries(snapshot.val() || {}).map(([id, raw]) => decodeAccount(id, raw, 'personal', uid));
      ready.add('personal'); publish();
    }, () => { personal = []; failed('personal'); });
    const stopOwned = onValue(query(ref(database, 'groupAccounts'), orderByChild('ownerUid'), equalTo(uid)), snapshot => {
      owned = Object.entries(snapshot.val() || {}).map(([id, raw]) => decodeAccount(id, raw, 'group', uid));
      ready.add('owned'); publish();
    }, () => { owned = []; failed('owned'); });
    const stopInvites = onValue(query(ref(database, 'memberships'), orderByChild('recipientUid'), equalTo(uid)), snapshot => {
      invitations = Object.entries(snapshot.val() || {}).map(([id, raw]) => ({ ...(raw as Omit<Membership, 'id'>), id }));
      const joined = new Set(invitations.filter(item => item.status === 'accepted').map(item => item.accountId));
      for (const [id, stop] of stops) {
        if (!joined.has(id)) { stop(); stops.delete(id); shared.delete(id); waiting.delete(id); }
      }
      for (const id of joined) {
        if (stops.has(id)) continue;
        waiting.add(id);
        const stop = onValue(ref(database, `groupAccounts/${id}`), accountSnapshot => {
          if (accountSnapshot.exists()) shared.set(id, decodeAccount(id, accountSnapshot.val(), 'group', uid));
          else shared.delete(id);
          waiting.delete(id); publish();
        }, () => {
          shared.delete(id); waiting.delete(id);
          if (active) publish();
        });
        stops.set(id, stop);
      }
      ready.add('invitations'); publish();
    }, () => {
      invitations = [];
      stops.forEach(stop => stop()); stops.clear(); shared.clear(); waiting.clear();
      failed('invitations');
    });
    const stopLinks = onValue(ref(database, `personalLinks/${uid}`), snapshot => {
      const references = new Map<string, PersonalLedgerReference>(Object.entries(snapshot.val() || {}));
      for (const [key, stop] of linkedStops) {
        if (!references.has(key)) {
          stop(); linkedStops.delete(key); linked.delete(key); waiting.delete(`personal:${key}`);
        }
      }
      for (const [key, reference] of references) {
        if (linkedStops.has(key) || reference.ownerUid === uid) continue;
        waiting.add(`personal:${key}`);
        const stop = onValue(ref(database, `accounts/${reference.ownerUid}/${reference.accountId}`), accountSnapshot => {
          const raw = accountSnapshot.val();
          if (raw && raw.linkedUserUid === uid) linked.set(key, decodeAccount(reference.accountId, raw, 'personal', reference.ownerUid, uid));
          else linked.delete(key);
          waiting.delete(`personal:${key}`); publish();
        }, () => {
          linked.delete(key); waiting.delete(`personal:${key}`); publish();
        });
        linkedStops.set(key, stop);
      }
      ready.add('links'); publish();
    }, () => {
      linkedStops.forEach(stop => stop()); linkedStops.clear(); linked.clear();
      for (const key of waiting) { if (key.startsWith('personal:')) waiting.delete(key); }
      failed('links');
    });
    return () => {
      active = false;
      stopPersonal(); stopOwned(); stopInvites(); stopLinks();
      stops.forEach(stop => stop()); linkedStops.forEach(stop => stop());
    };
  }, [uid, subscriptionVersion]);

  const requireUser = () => {
    if (!user) throw new Error('Sign in to continue.');
    return user;
  };
  const requireAccount = (id: string, ownerOnly = false) => {
    const current = requireUser();
    const account = accounts.find(item => item.id === id);
    if (!account) throw new Error('This account is no longer available.');
    if (ownerOnly && account.ownerUid !== current.uid) throw new Error('Only the account creator can manage this account.');
    return account;
  };
  const accountPath = (account: Account) => account.kind === 'group' ? `groupAccounts/${account.id}` : `accounts/${account.ownerUid}/${account.sourceAccountId || account.id}`;
  const canEditTransaction = (account: Account, txn: Transaction) => !!uid && (account.kind === 'personal' ? account.ownerUid === uid : txn.ownerUid === uid);

  const linkPath = (recipientUid: string, ownerUid: string, accountId: string) => `personalLinks/${recipientUid}/${ownerUid}_${accountId}`;

  const addAccount = async (input: AccountInput, kind: Account['kind'] = 'personal', contact?: PersonalLedgerContact | null) => {
    requireUser();
    const result = await notificationMutation({ action: 'createLedger', kind, data: validateAccount(input),
      contact: kind === 'personal' && contact ? { uid: contact.uid, identifier: contact.identifier } : null,
      colorIndex: accounts.length % 8 });
    return result.accountId;
  };
  const editAccount = async (id: string, input: AccountInput, contact?: PersonalLedgerContact | null) => {
    const account = requireAccount(id, true);
    if (account.kind === 'group') {
      await update(ref(database, accountPath(account)), { ...validateAccount(input), updatedAt: new Date().toISOString() });
      return;
    }
    const target = contact === undefined && account.linkedUserUid ? {
      uid: account.linkedUserUid, identifier: account.linkedIdentifier,
    } : contact ? { uid: contact.uid, identifier: contact.identifier } : null;
    await notificationMutation({ action: 'editPersonalLedger', kind: 'personal', accountId: account.sourceAccountId || id,
      ownerUid: account.ownerUid, data: validateAccount(input), contact: target });
  };
  const setAccountIncludedInTotalAssets = async (id: string, included: boolean) => {
    const account = requireAccount(id, true);
    if (account.kind !== 'group') throw new Error('Only group ledgers can be excluded from Total Assets.');
    if (typeof included !== 'boolean') throw new Error('Choose whether to include this ledger in Total Assets.');
    await update(ref(database, accountPath(account)), {
      includeInTotalAssets: included,
      updatedAt: new Date().toISOString(),
    });
  };
  const deleteAccounts = async (ids: string[]) => {
    const targets = ids.map(id => requireAccount(id, true));
    const changes: Record<string, null> = {};
    for (const account of targets) {
      changes[accountPath(account)] = null;
      if (account.kind === 'personal' && account.linkedUserUid) changes[linkPath(account.linkedUserUid, account.ownerUid, account.sourceAccountId || account.id)] = null;
      if (account.kind === 'group') {
        const members = await get(query(ref(database, 'memberships'), orderByChild('accountId'), equalTo(account.id)));
        members.forEach(member => { changes[`memberships/${member.key}`] = null; });
      }
    }
    if (targets.length) await update(ref(database), changes);
  };
  const addTransaction = async (id: string, input: TransactionInput) => {
    requireUser();
    const account = requireAccount(id);
    if (account.kind === 'personal' && account.ownerUid !== uid) throw new Error('Only the creator can add transactions to this personal ledger.');
    await notificationMutation({ action: 'createTransaction', kind: account.kind, ownerUid: account.ownerUid,
      accountId: account.sourceAccountId || id, data: validateTransaction(input) });
  };
  const requireOwnedTransactions = (account: Account, ids: string[]) => {
    for (const id of ids) {
      const txn = account.transactions.find(item => item.id === id);
      if (!txn) throw new Error('A selected transaction was already removed.');
      if (!canEditTransaction(account, txn)) throw new Error('You can only change your own transactions.');
    }
  };
  const editTransaction = async (id: string, txnId: string, input: TransactionInput) => {
    const account = requireAccount(id);
    requireOwnedTransactions(account, [txnId]);
    const validated = validateTransaction(input);
    const now = new Date().toISOString();
    // Do not recreate a transaction another device deleted during this edit.
    const target = ref(database, `${accountPath(account)}/transactions/${txnId}`);
    await get(target);
    const result = await runTransaction(target, current => {
      if (!current) return;
      return { ...current, ...validated, updatedAt: now };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('This transaction was removed. Refresh the account.');
  };
  const deleteTransactions = async (id: string, txnIds: string[]) => {
    const account = requireAccount(id);
    requireOwnedTransactions(account, txnIds);
    const changes: Record<string, string | null> = { updatedAt: new Date().toISOString() };
    txnIds.forEach(txnId => { changes[`transactions/${txnId}`] = null; });
    if (txnIds.length) await update(ref(database, accountPath(account)), changes);
  };
  const inviteMember = async (id: string, identifier: string) => {
    const account = requireAccount(id, true);
    if (account.kind !== 'group') throw new Error('Invitations are available for group accounts.');
    await notificationMutation({ action: 'invite', kind: 'group', accountId: id, identifier: identifier.trim().toLowerCase() });
  };
  const changeMembership = async (membership: Membership, status: MembershipStatus) => {
    requireUser();
    const transitions: Partial<Record<MembershipStatus, MembershipStatus[]>> = {
      pending: membership.recipientUid === uid ? ['accepted', 'rejected'] : ['cancelled'],
      accepted: membership.recipientUid === uid ? ['left'] : ['removed'],
    };
    if (!transitions[membership.status]?.includes(status)) throw new Error('This invitation or membership has already changed.');
    const target = ref(database, `memberships/${membership.id}`);
    await get(target);
    const result = await runTransaction(target, current => {
      if (!current || current.status !== membership.status || current.createdAt !== membership.createdAt) return;
      return { ...current, status, updatedAt: new Date().toISOString() };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('This invitation or membership has already changed.');
  };
  const getAccountBalance = (account: Account) => account.transactions.reduce((total, txn) => total + (txn.payment === 'sent' ? txn.amount : -txn.amount), 0);

  return <AccountsContext.Provider value={{ accounts, memberships, isLoading, error,
    fetchAccounts: async () => { setIsLoading(true); setError(null); setSubscriptionVersion(value => value + 1); },
    addAccount, editAccount, setAccountIncludedInTotalAssets, deleteAccounts, addTransaction, editTransaction, deleteTransactions,
    inviteMember, changeMembership, canEditTransaction, getAccountBalance,
    getTotalAssets: () => accounts.reduce((total, account) => total + (account.includeInTotalAssets ? getAccountBalance(account) : 0), 0),
  }}>{children}</AccountsContext.Provider>;
}
