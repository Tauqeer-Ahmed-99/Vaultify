import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';

export interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
}

export interface CustomMenuProps {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
}

export default function CustomMenu({ visible, onClose, items }: CustomMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.menuBox}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  item.isDestructive && styles.destructiveItem,
                  index < items.length - 1 && styles.borderBottom,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuText, item.isDestructive && styles.destructiveText]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)', // Slight dark tint to catch taps
  },
  menuContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    zIndex: 1000,
  },
  menuBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 8,
    minWidth: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  destructiveItem: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderRadius: 0,
    marginBottom: 4,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveText: {
    color: '#f87171',
  },
});
