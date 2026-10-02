import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
  isDestructive?: boolean;
  isActionLoading?: boolean;
}

export default function CustomAlert({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'OK',
  isDestructive = false,
  isActionLoading = false,
}: CustomAlertProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.container}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.btnRow}>
            {onCancel && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.cancelBtn, isActionLoading && { opacity: 0.5 }]}
                onPress={onCancel}
                disabled={isActionLoading}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            {onConfirm && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.confirmBtnContainer, isActionLoading && { opacity: 0.5 }]}
                onPress={onConfirm}
                disabled={isActionLoading}
              >
                <LinearGradient
                  colors={isDestructive ? ['#ef4444', '#dc2626'] : ['#a78bfa', '#7c3aed']}
                  style={styles.confirmBtn}
                >
                  <Text style={styles.confirmText}>{isActionLoading ? 'Wait...' : confirmText}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    pointerEvents: 'box-none',
  },
  alertBox: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtnContainer: {
    flex: 1,
  },
  confirmBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
