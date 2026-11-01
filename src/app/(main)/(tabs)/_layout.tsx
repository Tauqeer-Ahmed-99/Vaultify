import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAccounts } from '../../../../context/AccountsContext';
import { colors as c } from '../../../../theme/AppTheme';

export default function TabsLayout() {
  const { memberships } = useAccounts();
  const pending = memberships.filter(item => item.status === 'pending').length;
  return <NativeTabs tintColor={c.accent} backgroundColor={c.background}
    labelStyle={{ default: { color: c.muted }, selected: { color: c.accent } }}
    iconColor={{ default: c.muted, selected: c.accent }}>
    <NativeTabs.Trigger name="(accounts)" disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon sf="book.closed.fill" md="account_balance_wallet" />
      <NativeTabs.Trigger.Label>Accounts</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="sharing" disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
      <NativeTabs.Trigger.Label>Sharing</NativeTabs.Trigger.Label>
      {!!pending && <NativeTabs.Trigger.Badge>{String(pending)}</NativeTabs.Trigger.Badge>}
    </NativeTabs.Trigger>
  </NativeTabs>;
}
