import React from 'react';
import { Stack } from 'expo-router';
import { colors as c, useMotionPreferences } from '../../../theme/AppTheme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function MainLayout() {
  const { reduceMotion } = useMotionPreferences();
  return <Stack screenOptions={{
    headerStyle: { backgroundColor: c.background }, headerTintColor: c.text,
    headerTitleStyle: { fontWeight: '600', fontSize: 17 }, headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: c.background },
    animation: reduceMotion ? 'none' : 'default',
  }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  </Stack>;
}
