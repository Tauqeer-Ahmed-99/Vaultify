import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../../../context/AuthContext';
import { useAccounts } from '../../../../context/AccountsContext';
import { Membership } from '../../../../types';
import { Button, EmptyState, Field, Screen, ui } from '../../../../components/ui';
import { errorMessage, Notice } from '../../../../components/SharingUI';
import { formatDate } from '../../../../utils/format';
import { NotificationSettings } from '../../../../components/NotificationSettings';
import { colors as c } from '../../../../theme/AppTheme';

export default function Sharing() {
  const { user, profile, identityError, setUsername, sendVerification, refreshIdentity, signOut } = useAuth();
  const { memberships, changeMembership, error, isLoading, fetchAccounts } = useAccounts();
  const [username, setUsernameInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const pending = memberships.filter(item => item.status === 'pending');
  const history = memberships.filter(item => item.status !== 'pending').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const usernameValid = /^[a-z0-9_]{3,24}$/.test(username.trim().replace(/^@/, '').toLowerCase());

  const perform = async (key: string, action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(key); setFailure(null); setMessage(null);
    try { await action(); setMessage(success); }
    catch (error) { setFailure(errorMessage(error)); }
    finally { setBusy(null); }
  };
  const respond = (invitation: Membership, accept: boolean) => {
    void perform(`${invitation.id}_${accept}`, () => changeMembership(invitation, accept ? 'accepted' : 'rejected'), accept ? 'Invitation accepted.' : 'Invitation rejected.');
  };

  return <Screen tab>
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text accessibilityRole="header" style={ui.title}>Sharing</Text>
        <Notice message={failure || identityError || error} error />
        {(identityError || error) && <Button label="Retry Connection" variant="secondary" disabled={!!busy} onPress={() => {
          void perform('retry', async () => { await refreshIdentity(); await fetchAccounts(); }, 'Profile refreshed.');
        }} />}
        <Notice message={message} />
        <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>Invitations{pending.length ? ` (${pending.length})` : ''}</Text>
          {!pending.length && <EmptyState title={isLoading ? 'Loading Invitations…' : 'You’re Up to Date'} message="New account invitations appear here." />}
          {!!pending.length && <Text style={ui.caption}>Join to view the ledger. You can edit only your own payments.</Text>}
          {pending.map(invitation => <View key={invitation.id} style={ui.divider}>
            <Text style={ui.heading}>{invitation.accountName}</Text>
            <Text style={ui.body}>{invitation.inviterName}</Text>
            <Text style={ui.caption}>{formatDate(invitation.createdAt)}</Text>
            <View style={ui.row}>
              <Button label="Accept" busy={busy === `${invitation.id}_true`} disabled={!!busy} onPress={() => respond(invitation, true)} />
              <Button label="Reject" variant="secondary" busy={busy === `${invitation.id}_false`} disabled={!!busy} onPress={() => respond(invitation, false)} />
            </View>
          </View>)}
        </View>
        <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>Your Profile</Text>
          {!!user?.displayName && <Text style={ui.body}>{user.displayName}</Text>}
          {profile?.username ? <Text selectable style={[ui.body, { color: c.accent }]}>@{profile.username}</Text> : <>
            <Field label="Username" value={username} onChangeText={setUsernameInput} placeholder="e.g. alex_24" autoCapitalize="none" autoCorrect={false}
              maxLength={24} editable={!busy} hint="3–24 letters, numbers, or underscores. Permanent once saved." />
            <Button label="Save Username" busy={busy === 'username'} disabled={!!busy || !usernameValid} onPress={() => {
              void perform('username', () => setUsername(username), 'Username saved.');
            }} />
          </>}
          <View style={ui.divider}>
            <Text selectable style={ui.body}>{user?.email}</Text>
            <Text style={ui.caption}>{user?.emailVerified ? 'Verified email' : 'Verify your email to receive invitations by email.'}</Text>
            {!user?.emailVerified && <>
              <Button label={verificationSent ? 'Verification Email Sent' : 'Verify Email'} variant="secondary"
                busy={busy === 'verify'} disabled={!!busy || verificationSent} onPress={() => {
                  void perform('verify', async () => { await sendVerification(); setVerificationSent(true); }, 'Follow the email link, then refresh below.');
                }} />
              <Button label="Refresh Verification" variant="plain" busy={busy === 'refresh'} disabled={!!busy} onPress={() => {
                void perform('refresh', refreshIdentity, 'Profile refreshed.');
              }} />
            </>}
          </View>
        </View>
        <NotificationSettings />
        {!!history.length && <View style={ui.card}>
          <Button label={`${showHistory ? 'Hide' : 'Show'} History (${history.length})`} variant="plain" onPress={() => setShowHistory(previous => !previous)} />
          {showHistory && history.slice(0, 20).map(item => <View key={item.id} style={ui.divider}>
            <Text style={ui.heading}>{item.accountName}</Text>
            <Text style={ui.caption}>{item.status === 'accepted' ? 'Joined' : item.status.charAt(0).toUpperCase() + item.status.slice(1)} · {formatDate(item.updatedAt)}</Text>
          </View>)}
          {showHistory && history.length > 20 && <Text style={ui.caption}>20 most recent invitations</Text>}
        </View>}
        <Button label="Sign Out" variant="secondary" busy={busy === 'signout'} disabled={!!busy} onPress={() => {
          void perform('signout', signOut, '');
        }} />
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}
