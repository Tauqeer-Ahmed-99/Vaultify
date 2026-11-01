import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../context/AuthContext';
import { Button, Field, FormSheet, SegmentedControl, ui } from '../../../components/ui';
import { errorMessage, Notice } from '../../../components/SharingUI';
import { backgroundGradient, colors as c } from '../../../theme/AppTheme';

const appIcon = require('../../../assets/vaultify-icon.jpg');

export default function Login() {
  const { signIn, signUp, forgotPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false, name: false });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPassword = mode === 'signin' ? !!password : password.length >= 6;
  const submit = async () => {
    if (busy) return;
    setTouched({ email: true, password: true, name: true });
    if (!validEmail || !validPassword || (mode === 'signup' && !name.trim())) return;
    setBusy(true); setFailure(null);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, name.trim());
    } catch (error) { setFailure(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (resetBusy || !resetEmail.trim()) return;
    setResetBusy(true); setResetError(null);
    try { await forgotPassword(resetEmail.trim()); setResetSent(true); }
    catch (error) { setResetError(errorMessage(error)); }
    finally { setResetBusy(false); }
  };
  return <LinearGradient colors={backgroundGradient} style={ui.screen}>
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={s.content}>
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Image source={appIcon} style={s.appIcon} resizeMode="contain" accessible={false} fadeDuration={0} />
            <Text style={s.brand}>Vaultify</Text>
          </View>
          <View style={ui.card}>
            <SegmentedControl value={mode} disabled={busy} options={[{ value: 'signin', label: 'Sign In' }, { value: 'signup', label: 'Sign Up' }]}
              onChange={value => { setMode(value); setFailure(null); setPassword(''); setTouched({ name: false, email: false, password: false }); }} />
            <Text accessibilityRole="header" style={ui.title}>{mode === 'signin' ? 'Welcome Back' : 'Create Your Login'}</Text>
            <Notice message={failure} error />
            {mode === 'signup' && <Field label="Full name" value={name} onChangeText={setName} textContentType="name" autoComplete="name" maxLength={100}
              onBlur={() => setTouched(previous => ({ ...previous, name: true }))} error={touched.name && !name.trim() ? 'Enter your name.' : undefined} editable={!busy} />}
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email"
              autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="you@example.com"
              onBlur={() => setTouched(previous => ({ ...previous, email: true }))} error={touched.email && !validEmail ? 'Enter a valid email address.' : undefined} />
            <Field key={mode} label="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              editable={!busy} returnKeyType="go" onSubmitEditing={() => { void submit(); }}
              onBlur={() => setTouched(previous => ({ ...previous, password: true }))}
              error={touched.password && !validPassword ? mode === 'signup' ? 'Use at least 6 characters.' : 'Enter your password.' : undefined} />
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Button label={showPassword ? 'Hide Password' : 'Show Password'} variant="plain" onPress={() => setShowPassword(previous => !previous)} />
              {mode === 'signin' && <Button label="Forgot Password?" variant="plain" disabled={busy} onPress={() => {
                setResetEmail(email); setResetError(null); setResetSent(false); setResetOpen(true);
              }} />}
            </View>
            <Button label={mode === 'signin' ? 'Sign In' : 'Create Login'} busy={busy} onPress={() => { void submit(); }} />
          </View>
          <Text style={[ui.caption, { textAlign: 'center' }]}>NMT Solutions (OPC) PVT LTD™</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    <FormSheet visible={resetOpen} title="Reset Password" onClose={() => setResetOpen(false)} busy={resetBusy}>
      <Image source={appIcon} style={s.appIcon} resizeMode="contain" accessible={false} fadeDuration={0} />
      {resetSent ? <>
        <Text style={ui.body}>Check your email for a password reset link.</Text>
        <Button label="Done" onPress={() => setResetOpen(false)} />
      </> : <>
        <Field label="Email" value={resetEmail} onChangeText={setResetEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!resetBusy} />
        <Notice message={resetError} error />
        <Button label="Send Reset Link" onPress={() => { void reset(); }} busy={resetBusy} disabled={!resetEmail.trim()} />
      </>}
    </FormSheet>
  </LinearGradient>;
}
const s = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, gap: 24 },
  appIcon: { width: 56, height: 56, borderRadius: 18 },
  brand: { color: c.text, fontSize: 34, lineHeight: 42, fontWeight: '700', letterSpacing: -1 },
});
