import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database';
import { database } from '../../../../../../../firebaseConfig';
import { useAuth } from '../../../../../../../context/AuthContext';
import { useAccounts } from '../../../../../../../context/AccountsContext';
import { Membership, MembershipStatus } from '../../../../../../../types';
import { Button, EmptyState, Field, Screen, ui } from '../../../../../../../components/ui';
import { errorMessage, Notice } from '../../../../../../../components/SharingUI';
import CustomAlert from '../../../../../../../components/CustomAlert';
import { colors as c } from '../../../../../../../theme/AppTheme';
import { accountsRoute } from '../../../../../../../navigation/routes';

export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { accounts, memberships, isLoading, inviteMember, changeMembership } = useAccounts();
  const account = accounts.find(item => item.id === id && item.kind === 'group');
  const [version, setVersion] = useState(0);
  const [memberData, setMemberData] = useState<{ accountId: string; version: number; rows: Membership[] } | null>(null);
  const members = memberData?.accountId === id ? memberData.rows : [];
  const loading = memberData?.accountId !== id || memberData?.version !== version;
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmation, setConfirmation] = useState<{ member: Membership; status: MembershipStatus } | null>(null);
  const canAccess = !!account;
  const owner = account?.ownerUid === user?.uid;
  const ownMembership = memberships.find(item => item.accountId === id && item.status === 'accepted');

  useEffect(() => {
    if (!canAccess) return;
    return onValue(query(ref(database, 'memberships'), orderByChild('accountId'), equalTo(id)), snapshot => {
      setMemberData({ accountId: id, version, rows: Object.entries(snapshot.val() || {}).map(([key, raw]) => ({ ...(raw as Omit<Membership, 'id'>), id: key })) });
      setLoadError(null);
    }, () => { setMemberData({ accountId: id, version, rows: [] }); setLoadError('Could not load members. Try again.'); });
  }, [id, canAccess, version]);

  const perform = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true); setFailure(null); setMessage(null);
    try { await action(); setMessage(success); }
    catch (error) { setFailure(errorMessage(error)); }
    finally { setBusy(false); setConfirmation(null); }
  };

  if (!account) return <Screen><View style={ui.content}>
    {isLoading ? <ActivityIndicator color={c.accent} accessibilityLabel="Loading members" /> : <EmptyState title="Account Unavailable"
      message="The account was deleted or your access changed." action={<Button label="Back to Accounts" onPress={() => router.replace(accountsRoute)} />} />}
  </View></Screen>;

  const active = members.filter(item => item.status === 'accepted');
  const pending = members.filter(item => item.status === 'pending');
  const past = members.filter(item => item.status !== 'accepted' && item.status !== 'pending').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <Screen>
    <Stack.Screen options={{ title: 'Members' }} />
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text accessibilityRole="header" style={ui.title}>{account.accountName}</Text>
        <Notice message={failure || loadError} error /><Notice message={message} />
        {loadError && <Button label="Retry" variant="secondary" onPress={() => setVersion(previous => previous + 1)} />}
        {owner && <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>Invite a Member</Text>
          <Field label="Email or username" placeholder="you@example.com or @username" autoCapitalize="none" autoCorrect={false}
            value={identifier} onChangeText={setIdentifier} editable={!busy} maxLength={254} />
          <Button label="Send Invitation" busy={busy && !confirmation} disabled={!identifier.trim() || busy} onPress={() => {
            void perform(async () => { await inviteMember(account.id, identifier); setIdentifier(''); }, 'Invitation sent.');
          }} />
        </View>}
        <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>Members{loading ? '' : ` (${active.length + 1})`}</Text>
          <Text style={ui.heading}>{account.ownerName || 'Account creator'}{owner ? ' · You' : ''}</Text>
          <Text style={ui.caption}>Creator</Text>
          {loading && <ActivityIndicator color={c.accent} accessibilityLabel="Loading members" />}
          {active.map(member => <View key={member.id} style={ui.divider}>
            <Text style={ui.heading}>{member.recipientName}{member.recipientUid === user?.uid ? ' · You' : ''}</Text>
            <Text style={ui.caption}>Member</Text>
            {owner && <Button label="Remove Member" variant="plain" disabled={busy} onPress={() => setConfirmation({ member, status: 'removed' })} />}
          </View>)}
        </View>
        {owner && !!pending.length && <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>Pending Invitations</Text>
          {pending.map(member => <View key={member.id} style={ui.divider}>
            <Text style={ui.heading}>{member.recipientName}</Text>
            <Button label="Cancel Invitation" variant="plain" disabled={busy} onPress={() => {
              void perform(() => changeMembership(member, 'cancelled'), 'Invitation cancelled.');
            }} />
          </View>)}
        </View>}
        {owner && !!past.length && <View style={ui.card}>
          <Button label={`${showHistory ? 'Hide' : 'Show'} Past Invitations (${past.length})`} variant="plain" onPress={() => setShowHistory(previous => !previous)} />
          {showHistory && past.slice(0, 20).map(member => <View key={member.id} style={ui.divider}>
            <Text style={ui.heading}>{member.recipientName}</Text>
            <Text style={ui.caption}>{member.status.charAt(0).toUpperCase() + member.status.slice(1)}</Text>
          </View>)}
        </View>}
        {!owner && ownMembership && <Button label="Leave Account" variant="destructive" disabled={busy} onPress={() => setConfirmation({ member: ownMembership, status: 'left' })} />}
      </ScrollView>
    </KeyboardAvoidingView>
    <CustomAlert visible={!!confirmation} title={confirmation?.status === 'left' ? 'Leave Account?' : `Remove ${confirmation?.member.recipientName || 'Member'}?`}
      message={confirmation?.status === 'left' ? 'Your transactions stay in the ledger. You’ll need an invitation to rejoin.' : 'This member will lose access. Their transactions stay in the ledger.'}
      isDestructive isActionLoading={busy} confirmText={confirmation?.status === 'left' ? 'Leave' : 'Remove'}
      onCancel={() => { if (!busy) setConfirmation(null); }} onConfirm={() => {
        if (confirmation) void perform(() => changeMembership(confirmation.member, confirmation.status), 'Membership updated.');
      }} />
  </Screen>;
}
