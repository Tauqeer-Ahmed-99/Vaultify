import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ui } from './ui';
import { colors as c } from '../theme/AppTheme';

export function Notice({ message, error = false }: { message: string | null; error?: boolean }) {
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={[s.notice, error && { backgroundColor: c.negativeSoft }]}>
    <Text style={[ui.body, { color: c.text }]}>{message}</Text>
  </View>;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code).toLowerCase();
    if (code.includes('permission')) return 'Access changed. Refresh and try again.';
    if (code.includes('network') || code.includes('disconnected')) return 'Check your connection and try again.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Wait a few minutes and try again.';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Check your email and password.';
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    if (code.includes('email-already-in-use')) return 'This email already has an account. Sign in instead.';
    if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
    if (code.includes('user-disabled')) return 'This login is disabled. Contact support.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

const s = StyleSheet.create({ notice: { backgroundColor: c.accentSoft, padding: 14, borderRadius: 12 } });
