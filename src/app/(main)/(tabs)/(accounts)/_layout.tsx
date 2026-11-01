import React from 'react';
import { Stack } from 'expo-router';
import { colors as c, useMotionPreferences } from '../../../../../theme/AppTheme';

export const unstable_settings = { initialRouteName: 'index' };

export default function AccountsLayout() {
  const { reduceMotion } = useMotionPreferences();
  return <Stack screenOptions={{
    headerStyle: { backgroundColor: c.background }, headerTintColor: c.text,
    headerTitleStyle: { fontWeight: '600', fontSize: 17 }, headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: c.background },
    animation: reduceMotion ? 'none' : 'default',
  }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="account/[id]" options={{ title: 'Ledger' }} />
    <Stack.Screen name="account/[id]/members" options={{ title: 'Members' }} />
  </Stack>;
}
