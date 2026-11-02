import React from 'react';
import { Switch, Text, View } from 'react-native';
import { useNotificationSettings } from '../context/NotificationsContext';
import { Button, ui } from './ui';
import { Notice } from './SharingUI';

export function NotificationSettings() {
  const notifications = useNotificationSettings();
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.heading}>Notifications</Text>
    <Text style={ui.caption}>Ledger updates and invitations. Device permission is requested when you enable notifications below.</Text>
    <View style={ui.between}>
      <Text style={[ui.body, { flex: 1 }]}>Push notifications</Text>
      <Switch accessibilityLabel="Push notifications" disabled={notifications.busy || !notifications.ready} value={notifications.enabled}
        onValueChange={enabled => { void notifications.save({ enabled, hideDetails: notifications.hideDetails }); }} />
    </View>
    <View style={ui.between}>
      <Text style={[ui.body, { flex: 1 }]}>Hide transaction details in previews</Text>
      <Switch accessibilityLabel="Hide transaction details in push previews" value={notifications.hideDetails} disabled={notifications.busy || !notifications.ready}
        onValueChange={hideDetails => { void notifications.save({ enabled: notifications.enabled, hideDetails }); }} />
    </View>
    {notifications.supported ? <>
      <Button label="Enable / Retry on This Device" variant="secondary" busy={notifications.busy} disabled={notifications.ready && !notifications.enabled}
        onPress={() => { void notifications.enable(); }} />
      <Button label="System Notification Settings" variant="plain" onPress={() => { void notifications.settings().catch(() => undefined); }} />
    </> : <Text style={ui.caption}>Push delivery is available in the Android and iOS app. Account preferences also apply to those devices.</Text>}
    <Notice message={notifications.status} />
  </View>;
}
