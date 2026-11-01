import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors as c, useMotionPreferences } from '../theme/AppTheme';
import { Button, ui } from './ui';

export interface CustomAlertProps {
  visible: boolean; title: string; message: string; onCancel?: () => void; onConfirm?: () => void;
  cancelText?: string; confirmText?: string; isDestructive?: boolean; isActionLoading?: boolean;
}

export default function CustomAlert({ visible, title, message, onCancel, onConfirm,
  cancelText = 'Cancel', confirmText = 'Continue', isDestructive = false, isActionLoading = false,
}: CustomAlertProps) {
  const { reduceMotion } = useMotionPreferences();
  const close = () => { if (!isActionLoading) (onCancel || onConfirm)?.(); };
  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={close}>
    <View style={s.wrapper}>
      <Pressable accessible={false} style={s.backdrop} onPress={onCancel ? close : undefined} />
      <View style={s.dialog} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={{ gap: 16 }}>
          <Text accessibilityRole="header" style={ui.heading}>{title}</Text>
          <Text style={ui.body}>{message}</Text>
          <View style={{ gap: 10 }}>
            {onConfirm && <Button label={confirmText} onPress={onConfirm} busy={isActionLoading} variant={isDestructive ? 'destructive' : 'primary'} />}
            {onCancel && <Button label={cancelText} onPress={onCancel} disabled={isActionLoading} variant="secondary" />}
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '85%', padding: 24, backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: c.border },
});
