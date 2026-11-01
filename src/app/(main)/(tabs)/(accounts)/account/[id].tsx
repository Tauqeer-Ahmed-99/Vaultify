import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../../../context/AuthContext';
import { useAccounts } from '../../../../../../context/AccountsContext';
import { Transaction } from '../../../../../../types';
import { TransactionEditor } from '../../../../../../components/LedgerEditors';
import CustomAlert from '../../../../../../components/CustomAlert';
import { errorMessage, Notice } from '../../../../../../components/SharingUI';
import { BalanceCard, Button, EmptyState, Screen, SearchField, ui } from '../../../../../../components/ui';
import { colors as c } from '../../../../../../theme/AppTheme';
import { formatCurrency, formatDate, personalCounterparty, transactionDirection } from '../../../../../../utils/format';
import { accountsRoute } from '../../../../../../navigation/routes';

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { accounts, isLoading, error, fetchAccounts, getAccountBalance, canEditTransaction, deleteTransactions, setAccountIncludedInTotalAssets } = useAccounts();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 520 || fontScale > 1.3;
  const account = accounts.find(item => item.id === id);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<{ transaction?: Transaction; direction: Transaction['payment'] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (account?.transactions || []).filter(txn => !query || `${txn.reason} ${txn.ownerName || ''}`.toLowerCase().includes(query))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [account, search]);

  if (!account) return <Screen><View style={ui.content}>
    {isLoading ? <ActivityIndicator color={c.accent} accessibilityLabel="Loading ledger" /> : <EmptyState title="Account Unavailable"
      message={error || 'This account was deleted or your access changed.'} action={<Button label="Back to Accounts" onPress={() => router.replace(accountsRoute)} />} />}
  </View></Screen>;

  const owner = account.ownerUid === user?.uid;
  const counterparty = personalCounterparty(account);
  const canAddPayments = account.kind === 'group' || owner;
  const selection = account.transactions.filter(txn => selected.has(txn.id) && canEditTransaction(account, txn));
  const toggle = (txn: Transaction) => {
    if (!canEditTransaction(account, txn)) return;
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(txn.id)) next.delete(txn.id); else next.add(txn.id);
      return next;
    });
  };
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
  const remove = async () => {
    if (deleting || !selection.length) return;
    setDeleting(true); setFailure(null);
    try { await deleteTransactions(account.id, selection.map(txn => txn.id)); stopSelecting(); }
    catch (error) { setFailure(errorMessage(error)); }
    finally { setDeleting(false); setConfirmDelete(false); }
  };
  const changeSummary = async (included: boolean) => {
    if (!owner || savingSummary) return;
    setSavingSummary(true); setFailure(null);
    try { await setAccountIncludedInTotalAssets(account.id, included); }
    catch (error) { setFailure(errorMessage(error)); }
    finally { setSavingSummary(false); }
  };

  return <Screen>
    <Stack.Screen options={{ title: account.accountName,
      headerRight: account.kind === 'group' ? () => <Button label="Members" variant="plain" onPress={() => router.push(`/account/${id}/members`)} /> : undefined,
    }} />
    <FlatList data={filtered} keyExtractor={txn => txn.id} contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListHeaderComponent={<View style={{ gap: 18 }}>
        <Notice message={failure || error} error />
        {error && <Button label="Retry" variant="secondary" onPress={() => { void fetchAccounts(); }} />}
        {!!counterparty && <Text style={ui.caption}>{account.isLinkedViewer ? `Read-only · Recorded by ${counterparty}` : `Linked to ${counterparty}`}</Text>}
        <BalanceCard value={getAccountBalance(account)} label="Current Balance" detail={`${account.transactions.length} transaction${account.transactions.length === 1 ? '' : 's'}`} />
        {account.kind === 'group' && <View style={[ui.card, ui.between, { paddingVertical: 12 }]}>
          <Text style={[ui.body, { flex: 1, color: c.text }]}>{owner ? 'Include in Total Assets' : account.includeInTotalAssets ? 'Included in Total Assets' : 'Excluded from Total Assets'}</Text>
          {owner && <Switch accessibilityLabel="Include group ledger in Total Assets" accessibilityState={{ busy: savingSummary }}
            value={account.includeInTotalAssets} disabled={savingSummary} onValueChange={value => { void changeSummary(value); }}
            trackColor={{ false: c.border, true: c.accentStrong }} ios_backgroundColor={c.border} />}
        </View>}
        <SearchField value={search} onChangeText={setSearch} placeholder="Search transactions" />
        <View style={ui.between}>
          <Text accessibilityRole="header" style={ui.heading}>{selecting ? `${selection.length} selected` : 'Transactions'}</Text>
          {(selecting || account.transactions.some(txn => canEditTransaction(account, txn))) && <Button label={selecting ? 'Done' : 'Select'} variant="plain"
            disabled={deleting} onPress={() => selecting ? stopSelecting() : setSelecting(true)} />}
        </View>
        {selecting && <View style={[ui.row, { marginBottom: 8 }]}>
          <Button label="Edit" variant="secondary" disabled={selection.length !== 1 || deleting} onPress={() => setEditor({ transaction: selection[0], direction: selection[0].payment })} />
          <Button label="Delete" variant="destructive" disabled={!selection.length || deleting} onPress={() => setConfirmDelete(true)} />
        </View>}
      </View>}
      renderItem={({ item }) => {
        const editable = canEditTransaction(account, item);
        const checked = selecting && selected.has(item.id);
        return <Pressable accessibilityRole={selecting ? 'checkbox' : 'button'} disabled={!editable || deleting}
          accessibilityLabel={`${item.reason || 'Payment'}, ${formatCurrency(item.amount)}, ${transactionDirection(account, item)}${account.kind === 'group' ? `, ${item.ownerName || 'Member'}` : ''}`}
          accessibilityState={selecting ? { checked, disabled: !editable } : { disabled: !editable }}
          accessibilityHint={editable ? selecting ? 'Select transaction' : 'Edit transaction' : account.isLinkedViewer ? 'Only the ledger creator can edit' : 'Only the transaction owner can edit'}
          onPress={() => selecting ? toggle(item) : setEditor({ transaction: item, direction: item.payment })}
          onLongPress={editable ? () => { setSelecting(true); toggle(item); } : undefined}
          style={({ pressed }) => [s.transaction, checked && { borderColor: c.accent, backgroundColor: c.accentSoft }, pressed && { opacity: 0.7 }]}>
          <View style={[s.transactionRow, stacked && { flexDirection: 'column' }]}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={ui.heading}>{selecting && editable ? `${checked ? '✓ ' : '○ '}` : ''}{item.reason || 'Payment'}</Text>
              <Text style={ui.caption}>{formatDate(item.date)}</Text>
              {!!counterparty && <Text style={ui.caption}>{transactionDirection(account, item)}</Text>}
              {account.kind === 'group' && <Text style={ui.caption}>{item.ownerName || 'Member'}{editable ? ' · You' : ' · Read only'}</Text>}
            </View>
            <View style={{ gap: 4, alignItems: stacked ? 'flex-start' : 'flex-end', flexShrink: 1 }}>
              <Text style={s.transactionAmount}>{formatCurrency(item.amount)}</Text>
              <Text style={[ui.caption, { color: item.payment === 'sent' ? c.outgoing : c.positive }]}>{item.payment === 'sent' ? '↑ Sent' : '↓ Received'}</Text>
            </View>
          </View>
        </Pressable>;
      }}
      ListEmptyComponent={<EmptyState title={search ? 'No Matches' : 'No Transactions'} message={search ? 'Try another note or member name.' : canAddPayments ? 'Record a payment using the buttons below.' : 'No payments recorded yet.'} />}
    />
    {canAddPayments && <View style={ui.toolbar}><View style={ui.row}>
      <Button label="↓ Receive" variant="secondary" style={{ flex: 1 }} onPress={() => setEditor({ direction: 'received' })} />
      <Button label="↑ Send" style={{ flex: 1 }} onPress={() => setEditor({ direction: 'sent' })} />
    </View></View>}
    {editor && <TransactionEditor key={editor.transaction?.id || editor.direction} accountId={account.id} transaction={editor.transaction} direction={editor.direction}
      onClose={() => setEditor(null)} onSaved={() => { setEditor(null); stopSelecting(); }} />}
    <CustomAlert visible={confirmDelete} title="Delete Transactions?" message={`${selection.length} payment${selection.length === 1 ? '' : 's'} will be permanently deleted.`}
      isDestructive confirmText="Delete" isActionLoading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={() => { void remove(); }} />
  </Screen>;
}
const s = StyleSheet.create({
  transaction: { padding: 18, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  transactionRow: { flexDirection: 'row', gap: 16 },
  transactionAmount: { color: c.text, fontSize: 20, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
