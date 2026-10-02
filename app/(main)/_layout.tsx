import React from 'react';
import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f0c29' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0f0c29' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Vaultify' }} />
      <Stack.Screen name="account/[id]" options={{ title: 'Ledger' }} />
    </Stack>
  );
}
