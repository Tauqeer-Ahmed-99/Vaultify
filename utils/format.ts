import type { Account, Transaction } from '../types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
export const formatCurrency = (value: number) => currency.format(Math.abs(value));
export const balanceLabel = (value: number) => value > 0 ? 'To Receive' : value < 0 ? 'To Send' : 'Settled';
export const formatDate = (value?: string) => {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
};
export function relativeTime(value?: string) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : formatDate(value);
}
export function personalCounterparty(account: Account) {
  if (account.kind !== 'personal' || !account.linkedUserUid) return undefined;
  return account.isLinkedViewer ? account.ownerName || 'Ledger creator' : account.linkedUserName || 'Linked person';
}

export function transactionDirection(account: Account, txn: Transaction) {
  const person = personalCounterparty(account);
  if (person) return txn.payment === 'sent' ? `You sent to ${person}` : `${person} sent to you`;
  return txn.payment === 'sent' ? 'Sent' : 'Received';
}
