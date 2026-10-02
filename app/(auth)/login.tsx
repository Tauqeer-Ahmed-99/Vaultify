import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot Password state
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { signIn, signUp, forgotPassword } = useAuth();

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (isSigningUp && !name.trim()) return;
    setLoading(true);
    try {
      if (isSigningUp) {
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch {
      // handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    try {
      await forgotPassword(resetEmail.trim());
      setResetModalVisible(false);
      setResetEmail('');
    } catch {
      // handled in context
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─── Logo ─── */}
            <View style={styles.logoWrap}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoIcon}>₹</Text>
              </View>
              <Text style={styles.brandName}>Vaultify</Text>
              <Text style={styles.brandTag}>Smart Asset Tracker</Text>
            </View>

            {/* ─── Glass Card ─── */}
            <View style={styles.glass}>
              <Text style={styles.formTitle}>
                {isSigningUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.formSub}>
                {isSigningUp
                  ? 'Sign up to start managing your assets'
                  : 'Sign in to continue'}
              </Text>

              {isSigningUp && (
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              )}

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {!isSigningUp && (
                <TouchableOpacity 
                  style={styles.forgotBtn}
                  onPress={() => {
                    setResetEmail(email); // Pre-fill if they already typed it
                    setResetModalVisible(true);
                  }}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmit}
                disabled={loading}
                style={{ marginTop: isSigningUp ? 8 : 4 }}
              >
                <LinearGradient
                  colors={['#a78bfa', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>
                      {isSigningUp ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggle}
                onPress={() => setIsSigningUp((v) => !v)}
                disabled={loading}
              >
                <Text style={styles.toggleText}>
                  {isSigningUp
                    ? 'Already have an account? '
                    : "Don't have an account? "}
                  <Text style={styles.toggleHighlight}>
                    {isSigningUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* ─── Footer ─── */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>v1.0 — NMT Solutions (OPC) PVT LTD™</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ─── Forgot Password Modal ─── */}
        <Modal visible={resetModalVisible} transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setResetModalVisible(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrap}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSub}>
                Enter the email associated with your account and we'll send you a link to reset your password.
              </Text>

              <Text style={styles.modalLabel}>Email Address</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="you@example.com"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
                value={resetEmail}
                onChangeText={setResetEmail}
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setResetModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={handleResetPassword} disabled={resetLoading}>
                  <LinearGradient
                    colors={['#38bdf8', '#0284c7']}
                    style={styles.modalResetBtn}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalResetText}>Send Link</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  /* Logo */
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(167,139,250,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: { fontSize: 36, fontWeight: '700', color: '#a78bfa' },
  brandName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  brandTag: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
    marginTop: 4,
  },

  /* Glass card */
  glass: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 28,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 28,
  },

  /* Inputs */
  inputWrap: { marginBottom: 18 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  /* Forgot Password */
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Button */
  btn: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  /* Toggle */
  toggle: { marginTop: 22, alignItems: 'center' },
  toggleText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  toggleHighlight: { color: '#a78bfa', fontWeight: '600' },

  /* Footer */
  footer: { marginTop: 36, alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  /* Modal */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 28,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  modalSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24, lineHeight: 20 },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
  modalResetBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
  },
  modalResetText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
