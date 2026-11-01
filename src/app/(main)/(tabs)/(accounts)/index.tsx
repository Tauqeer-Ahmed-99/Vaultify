import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../../../context/AuthContext';
import { useAccounts } from '../../../../../context/AccountsContext';
import { Account } from '../../../../../types';
import { AccountEditor } from '../../../../../components/LedgerEditors';
import CustomAlert from '../../../../../components/CustomAlert';
import { errorMessage, Notice } from '../../../../../components/SharingUI';
import { BalanceCard, Button, EmptyState, Screen, SearchField, ui } from '../../../../../components/ui';
import { colors as c, ledgerColors } from '../../../../../theme/AppTheme';
import { balanceLabel, formatCurrency, personalCounterparty, relativeTime } from '../../../../../utils/format';
import { sharingRoute } from '../../../../../navigation/routes';

export default function Home() {
  const { user } = useAuth();
  const { accounts, memberships, isLoading, error, fetchAccounts, getTotalAssets, getAccountBalance, deleteAccounts } = useAccounts();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<Account | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const selection = accounts.filter(item => selected.has(item.id) && item.ownerUid === user?.uid);
  const pending = memberships.filter(item => item.status === 'pending').length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter(item => !query || `${item.accountName} ${item.accountDescripton}`.toLowerCase().includes(query))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [accounts, search]);

  const toggle = (id: string) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
  const remove = async () => {
    if (deleting || !selection.length) return;
    setDeleting(true); setFailure(null);
    try { await deleteAccounts(selection.map(item => item.id)); stopSelecting(); }
    catch (error) { setFailure(errorMessage(error)); }
    finally { setDeleting(false); setConfirmDelete(false); }
  };

  return <Screen tab>
    <FlatList data={filtered} keyExtractor={item => item.id} contentContainerStyle={[ui.content, s.list]}
      ItemSeparatorComponent={() => <View style={s.cardSeparator} />}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      refreshing={isLoading} onRefresh={() => { void fetchAccounts(); }}
      ListHeaderComponent={<View style={s.header}>
        <View style={[ui.between, { flexWrap: 'wrap' }]}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            {!!user?.displayName && <Text style={ui.caption}>{user.displayName}</Text>}
            <Text accessibilityRole="header" style={ui.title}>Accounts</Text>
          </View>
          <Button label="New Account" onPress={() => setEditor('new')} />
        </View>
        <Notice message={failure || error} error />
        {error && <Button label="Retry" variant="secondary" onPress={() => { void fetchAccounts(); }} />}
        {isLoading ? <View style={ui.card}><ActivityIndicator color={c.accent} accessibilityLabel="Loading total assets" /></View>
          : <BalanceCard value={getTotalAssets()} label="Total Assets" detail={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`} />}
        {!!pending && <Button label={`${pending} invitation${pending === 1 ? '' : 's'} to review`} variant="secondary" onPress={() => router.navigate(sharingRoute)} />}
        <View style={s.ledgerControls}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search accounts" />
          <View style={[ui.between, s.ledgerHeading]}>
            <Text accessibilityRole="header" style={ui.heading}>{selecting ? `${selection.length} selected` : 'Your Ledgers'}</Text>
            {(selecting || accounts.some(item => item.ownerUid === user?.uid)) && <Button label={selecting ? 'Done' : 'Select'} variant="plain"
              disabled={deleting} onPress={() => selecting ? stopSelecting() : setSelecting(true)} />}
          </View>
          {selecting && <View style={[ui.row, { paddingBottom: 4 }]}>
            <Button label="Edit" variant="secondary" disabled={selection.length !== 1 || deleting} onPress={() => setEditor(selection[0])} />
            <Button label="Delete" variant="destructive" disabled={!selection.length || deleting} onPress={() => setConfirmDelete(true)} />
          </View>}
        </View>
      </View>}
      renderItem={({ item }) => {
        const owner = item.ownerUid === user?.uid;
        const balance = getAccountBalance(item);
        const selectedRow = selecting && selected.has(item.id);
        const color = ledgerColors[(item.colorIndex ?? 0) % ledgerColors.length];
        const counterparty = personalCounterparty(item);
        return <Pressable accessibilityRole={selecting ? 'checkbox' : 'button'} accessibilityLabel={`${item.accountName}${counterparty ? `, with ${counterparty}` : ''}, ${formatCurrency(balance)}, ${balanceLabel(balance)}`}
          accessibilityState={selecting ? { checked: selectedRow, disabled: !owner } : undefined}
          accessibilityHint={selecting ? owner ? 'Select this account' : 'Only the creator can manage this account' : 'Open ledger'}
          disabled={selecting && (!owner || deleting)}
          onPress={() => selecting ? toggle(item.id) : router.push(`/account/${item.id}`)}
          onLongPress={owner ? () => { setSelecting(true); toggle(item.id); } : undefined}
          style={({ pressed }) => [s.account, { borderLeftColor: color }, selectedRow && s.selected, pressed && { opacity: 0.75 }]}>
          <View style={[s.accountRow, largeText && s.expandedRow]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.accountName} numberOfLines={largeText ? undefined : 2}>
                {selecting && owner ? `${selectedRow ? '✓ ' : '○ '}` : ''}{item.accountName}
              </Text>
              {!!counterparty && <Text style={s.accountMeta} numberOfLines={largeText ? undefined : 1}>With {counterparty}</Text>}
            </View>
            <View style={[s.accountIdentity, largeText && s.expandedIdentity]}>
              <Text style={s.accountMeta}>{item.kind === 'group' ? 'Group' : 'Personal'}</Text>
              {item.kind === 'group' && <Text style={s.accountMeta}>{owner ? 'Creator' : 'Member'}</Text>}
              {!!counterparty && <Text style={s.accountMeta}>{owner ? 'Creator' : 'Linked'}</Text>}
            </View>
          </View>
          {!!item.accountDescripton && <Text style={s.accountDescription} numberOfLines={largeText ? undefined : 2}>{item.accountDescripton}</Text>}
          <View style={[s.accountRow, s.accountFooter, largeText && s.expandedRow]}>
            <View style={s.accountBalance}>
              <Text style={s.accountAmount}>{formatCurrency(balance)}</Text>
              <Text style={[s.accountMeta, { color: balance > 0 ? c.positive : balance < 0 ? c.negative : c.secondary }]}>{balanceLabel(balance)}</Text>
            </View>
            {!!item.updatedAt && <View style={[s.accountUpdated, largeText && s.expandedIdentity]}>
              <Text style={s.accountMeta}>Updated</Text>
              <Text style={s.accountMeta}>{relativeTime(item.updatedAt)}</Text>
            </View>}
          </View>
        </Pressable>;
      }}
      ListEmptyComponent={!isLoading ? <EmptyState title={search ? 'No Matches' : 'Your First Ledger'}
        message={search ? 'Try another name or description.' : 'Create an account to start recording payments.'}
        action={!search ? <Button label="Create Account" onPress={() => setEditor('new')} /> : undefined} /> : null}
    />
    {editor && <AccountEditor key={editor === 'new' ? 'new' : editor.id} account={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)}
      onSaved={(id, kind) => {
        const created = editor === 'new'; setEditor(null); stopSelecting();
        if (created && kind === 'group') router.push(`/account/${id}/members`);
      }} />}
    <CustomAlert visible={confirmDelete} title={`Delete ${selection.length === 1 ? 'Account' : 'Accounts'}?`}
      message="All transactions will be permanently deleted. Group members will lose access."
      confirmText="Delete" isDestructive isActionLoading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={() => { void remove(); }} />
  </Screen>;
}
const s = StyleSheet.create({
  list: { gap: 0, paddingTop: 16, paddingBottom: 24 },
  header: { gap: 12, paddingBottom: 8 },
  ledgerControls: { gap: 2 },
  ledgerHeading: { minHeight: 40 },
  cardSeparator: { height: 10 },
  account: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, padding: 14, gap: 8 },
  accountRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  accountName: { color: c.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  accountIdentity: { alignItems: 'flex-end', flexShrink: 0 },
  accountMeta: { color: c.muted, fontSize: 13, lineHeight: 18 },
  accountDescription: { color: c.secondary, fontSize: 14, lineHeight: 20 },
  accountFooter: { alignItems: 'flex-end', paddingTop: 2 },
  accountBalance: { flex: 1, gap: 2 },
  accountAmount: { color: c.text, fontSize: 21, lineHeight: 27, fontWeight: '600', fontVariant: ['tabular-nums'] },
  accountUpdated: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '40%' },
  expandedRow: { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  expandedIdentity: { alignItems: 'flex-start', maxWidth: '100%' },
  selected: { backgroundColor: c.accentSoft, borderColor: c.accent },
});
