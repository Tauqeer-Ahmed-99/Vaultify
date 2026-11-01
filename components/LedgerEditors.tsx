import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAccounts } from '../context/AccountsContext';
import { Account, PersonalLedgerContact, Transaction } from '../types';
import { Button, DateField, Field, FormSheet, SegmentedControl, ui } from './ui';
import { errorMessage, Notice } from './SharingUI';
import { findVerifiedLedgerContact } from '../services/identity';

function initialDate(value?: string) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date : new Date();
}

export function AccountEditor({ account, onClose, onSaved }: {
  account?: Account; onClose: () => void; onSaved: (id: string, kind: Account['kind']) => void;
}) {
  const { addAccount, editAccount } = useAccounts();
  const [name, setName] = useState(account?.accountName || '');
  const [description, setDescription] = useState(account?.accountDescripton || '');
  const [date, setDate] = useState(initialDate(account?.accountStartingDate));
  const [kind, setKind] = useState<Account['kind']>(account?.kind || 'personal');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [linkIdentifier, setLinkIdentifier] = useState(account?.linkedIdentifier || '');
  const [verifiedContact, setVerifiedContact] = useState<PersonalLedgerContact | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const lookupVersion = useRef(0);
  const needsVerification = kind === 'personal' && !!linkIdentifier.trim() && !verifiedContact;
  const changeIdentifier = (value: string) => {
    lookupVersion.current += 1;
    setLinkIdentifier(value); setVerifiedContact(null); setLinkError(null); setVerifying(false);
  };
  const verifyContact = async () => {
    if (verifying || busy || !linkIdentifier.trim()) return;
    const version = ++lookupVersion.current;
    setVerifying(true); setLinkError(null); setVerifiedContact(null);
    try {
      const contact = await findVerifiedLedgerContact(linkIdentifier);
      if (version === lookupVersion.current) setVerifiedContact(contact);
    } catch (error) {
      if (version === lookupVersion.current) setLinkError(errorMessage(error));
    } finally {
      if (version === lookupVersion.current) setVerifying(false);
    }
  };
  const save = async () => {
    if (busy || verifying || needsVerification) return;
    setNameTouched(true);
    if (!name.trim()) return;
    setBusy(true); setFailure(null);
    try {
      const data = { accountName: name.trim(), accountDescripton: description.trim(), accountStartingDate: date.toISOString() };
      const contact = kind === 'personal' ? verifiedContact : undefined;
      const id = account ? (await editAccount(account.id, data, contact), account.id) : await addAccount(data, kind, contact);
      onSaved(id, kind);
    } catch (error) {
      setFailure(errorMessage(error));
      if (kind === 'personal' && linkIdentifier.trim()) setVerifiedContact(null);
    }
    finally { setBusy(false); }
  };
  return <FormSheet visible title={account ? 'Edit Account' : 'New Account'} busy={busy} onClose={onClose}>
    {!account && <SegmentedControl value={kind} onChange={setKind} disabled={busy}
      options={[{ value: 'personal', label: 'Personal' }, { value: 'group', label: 'Group' }]} />}
    <Field label="Account name" value={name} onChangeText={setName} onBlur={() => setNameTouched(true)} placeholder="e.g. Household"
      maxLength={80} editable={!busy} autoFocus error={nameTouched && !name.trim() ? 'Enter an account name.' : undefined} />
    {kind === 'personal' && <View style={{ gap: 8 }}>
      <Field label="Link email or username (optional)" value={linkIdentifier} onChangeText={changeIdentifier}
        placeholder="you@example.com or @username" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy}
        hint={linkIdentifier.trim() ? 'Shares this ledger and its payment history with this person.' : undefined} />
      {!!linkIdentifier.trim() && <Button label={verifiedContact ? 'Verified' : 'Verify Contact'} variant="secondary"
        busy={verifying} disabled={busy || !!verifiedContact} onPress={() => { void verifyContact(); }} />}
      {verifiedContact && <Text style={ui.caption}>Verified · {verifiedContact.name}</Text>}
      <Notice message={linkError} error />
    </View>}
    <Field label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Add a note" maxLength={500} editable={!busy} multiline />
    <DateField label="Opening date" value={date} onChange={setDate} disabled={busy} />
    <Notice message={failure} error />
    <Button label={account ? 'Save Changes' : 'Create Account'} onPress={() => { void save(); }} busy={busy} disabled={!name.trim() || verifying || needsVerification} />
  </FormSheet>;
}

export function TransactionEditor({ accountId, transaction, direction, onClose, onSaved }: {
  accountId: string; transaction?: Transaction; direction: Transaction['payment']; onClose: () => void; onSaved: () => void;
}) {
  const { addTransaction, editTransaction } = useAccounts();
  const [payment, setPayment] = useState(transaction?.payment || direction);
  const [amount, setAmount] = useState(transaction?.amount.toString() || '');
  const [reason, setReason] = useState(transaction?.reason || '');
  const [date, setDate] = useState(initialDate(transaction?.date));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const validAmount = /^\d*(?:\.\d{0,2})?$/.test(amount.trim()) && Number(amount) > 0 && Number(amount) <= 1e12;
  const save = async () => {
    if (busy || !validAmount) return;
    setBusy(true); setFailure(null);
    try {
      const data = { amount: Number(amount), payment, reason: reason.trim(), date: date.toISOString() };
      if (transaction) await editTransaction(accountId, transaction.id, data);
      else await addTransaction(accountId, data);
      onSaved();
    } catch (error) { setFailure(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <FormSheet visible title={transaction ? 'Edit Transaction' : 'New Transaction'} busy={busy} onClose={onClose}>
    <SegmentedControl value={payment} onChange={setPayment} disabled={busy}
      options={[{ value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }]} />
    <Field label="Amount (₹)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" maxLength={18}
      onBlur={() => setAmountTouched(true)} autoFocus editable={!busy}
      error={amountTouched && !validAmount ? 'Enter a positive amount with up to 2 decimal places.' : undefined} />
    <Field label="Note (optional)" value={reason} onChangeText={setReason} placeholder="What was this for?" maxLength={500} editable={!busy} multiline />
    <DateField label="Transaction date" value={date} onChange={setDate} disabled={busy} />
    <Notice message={failure} error />
    <Button label={transaction ? 'Save Changes' : 'Record Payment'} busy={busy} disabled={!validAmount} onPress={() => { void save(); }} />
  </FormSheet>;
}
