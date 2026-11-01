import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-screens/experimental';
import DateTimePicker from '@react-native-community/datetimepicker';
import { backgroundGradient, colors as c, useMotionPreferences } from '../theme/AppTheme';
import { balanceLabel, formatCurrency, formatDate } from '../utils/format';

export const ui = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, gap: 20 },
  section: { gap: 14 },
  card: { backgroundColor: c.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: c.border, gap: 14 },
  title: { color: c.text, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  heading: { color: c.text, fontSize: 19, lineHeight: 25, fontWeight: '600' },
  body: { color: c.secondary, fontSize: 17, lineHeight: 24 },
  caption: { color: c.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 16, gap: 8 },
  toolbar: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 10, backgroundColor: c.background },
  amount: { color: c.text, fontSize: 36, lineHeight: 46, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'], flexShrink: 1 },
});

export function Screen({ children, tab = false }: { children: React.ReactNode; tab?: boolean }) {
  return <LinearGradient colors={backgroundGradient} style={ui.screen}>
    {Platform.OS === 'web'
      ? <SafeAreaView style={ui.screen} edges={tab ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}>{children}</SafeAreaView>
      : <NativeSafeAreaView style={ui.screen} edges={{ top: tab, bottom: true, left: true, right: true }}>{children}</NativeSafeAreaView>}
  </LinearGradient>;
}

export function Button({ label, onPress, disabled = false, busy = false, variant = 'primary', style }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive'; style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const foreground = variant === 'plain' ? c.accent : c.text;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} hitSlop={4}
    disabled={disabled || busy} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [s.button, variant === 'secondary' && s.secondaryButton,
      variant === 'plain' && s.plainButton, variant === 'destructive' && s.destructiveButton,
      focused && s.focus, (disabled || busy) && { opacity: 0.55 }, pressed && { opacity: 0.7 }, style]}>
    {busy && <ActivityIndicator size="small" color={foreground} />}
    <Text style={[s.buttonText, { color: foreground }]}>{label}</Text>
  </Pressable>;
}

export function Field({ label, error, hint, style, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={s.label}>{label}</Text>
    <TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} accessibilityHint={error || hint}
      placeholderTextColor={c.muted} selectionColor={c.accent} keyboardAppearance="dark"
      onFocus={event => { setFocused(true); props.onFocus?.(event); }}
      onBlur={event => { setFocused(false); props.onBlur?.(event); }}
      style={[s.input, focused && s.focus, !!error && { borderColor: c.negative }, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} />
    {(error || hint) && <Text accessibilityLiveRegion={error ? 'polite' : 'none'} style={[ui.caption, error && { color: c.negative }]}>{error || hint}</Text>}
  </View>;
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={s.search}>
    <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={c.muted} value={value}
      onChangeText={onChangeText} autoCorrect={false} keyboardAppearance="dark" returnKeyType="search" style={s.searchInput} />
    {!!value && <Button label="Clear" variant="plain" onPress={() => onChangeText('')} />}
  </View>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, disabled = false }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; disabled?: boolean;
}) {
  return <View style={s.segments} accessibilityRole="radiogroup">
    {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)}
      style={({ pressed }) => [s.segment, option.value === value && { backgroundColor: c.accentStrong }, pressed && { opacity: 0.7 }]}>
      <Text style={[s.buttonText, { color: option.value === value ? c.text : c.secondary }]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

export function DateField({ label, value, onChange, disabled = false }: { label: string; value: Date; onChange: (date: Date) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [webDate, setWebDate] = useState(value.toISOString().slice(0, 10));
  return <View style={{ gap: 8 }}>
    <Text style={s.label}>{label}</Text>
    {Platform.OS === 'web' ? <Field label="YYYY-MM-DD" value={webDate} editable={!disabled} onBlur={() => setWebDate(value.toISOString().slice(0, 10))}
      onChangeText={text => {
        setWebDate(text);
        if (/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text))) onChange(new Date(`${text}T12:00:00`));
      }} />
      : Platform.OS === 'ios' ? <DateTimePicker value={value} mode="date" display="default" themeVariant="dark" disabled={disabled}
        onValueChange={(_, date) => { if (date) onChange(date); }} />
        : <Button label={formatDate(value.toISOString())} variant="secondary" disabled={disabled} onPress={() => setOpen(true)} />}
    {Platform.OS === 'android' && open && <DateTimePicker value={value} mode="date" onDismiss={() => setOpen(false)}
      onValueChange={(_, date) => { setOpen(false); if (date) onChange(date); }} />}
  </View>;
}

export function FormSheet({ visible, title, onClose, busy = false, children }: {
  visible: boolean; title: string; onClose: () => void; busy?: boolean; children: React.ReactNode;
}) {
  const { reduceMotion } = useMotionPreferences();
  return <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    allowSwipeDismissal={!busy} onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={s.sheetHeader}>
        <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>{title}</Text>
        <Button label="Cancel" variant="plain" disabled={busy} onPress={onClose} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[ui.content, { paddingBottom: 32 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">{children}</ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

export function BalanceCard({ value, label = 'Balance', detail }: { value: number; label?: string; detail?: string }) {
  const color = value > 0 ? c.positive : value < 0 ? c.negative : c.text;
  return <View style={[ui.card, { borderTopWidth: 3, borderTopColor: c.accent }]}>
    <Text style={ui.caption}>{label}</Text>
    <Text selectable style={ui.amount}>{formatCurrency(value)}</Text>
    <View style={[ui.row, { justifyContent: 'space-between' }]}>
      <Text style={[ui.body, { color, fontWeight: '600' }]}>{balanceLabel(value)}</Text>
      {!!detail && <Text style={ui.caption}>{detail}</Text>}
    </View>
  </View>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <View style={s.empty}>
    <Text style={[ui.heading, { textAlign: 'center' }]}>{title}</Text>
    <Text style={[ui.body, { textAlign: 'center' }]}>{message}</Text>
    {action}
  </View>;
}

const s = StyleSheet.create({
  button: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.accentStrong, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'transparent' },
  secondaryButton: { backgroundColor: c.raised, borderColor: c.controlBorder },
  plainButton: { backgroundColor: 'transparent', paddingHorizontal: 10 },
  destructiveButton: { backgroundColor: '#9d3048' },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  focus: { borderColor: c.accent },
  input: { backgroundColor: c.input, color: c.text, borderWidth: 2, borderColor: c.controlBorder, minHeight: 52, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, lineHeight: 24 },
  label: { color: c.secondary, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.input, borderWidth: 1, borderColor: c.controlBorder, borderRadius: 12 },
  searchInput: { flex: 1, minHeight: 44, color: c.text, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, lineHeight: 22 },
  segments: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: c.input },
  segment: { flex: 1, minHeight: 40, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetHeader: { width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 12 },
});
