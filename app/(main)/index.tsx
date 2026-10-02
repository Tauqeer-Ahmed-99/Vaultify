import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useAccounts } from '../../context/AccountsContext';
import { useRouter, Stack } from 'expo-router';
import { Account } from '../../types';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert from '../../components/CustomAlert';
import CustomMenu from '../../components/CustomMenu';

function formatRelativeTime(dateString?: string) {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Home() {
  const { user, signOut } = useAuth();
  const { accounts, isLoading, getTotalAssets, addAccount, editAccount, deleteAccounts, getAccountBalance } = useAccounts();
  const router = useRouter();

  const [menuVisible, setMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fabHovered, setFabHovered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm?: () => void;
    showCancel?: boolean;
    isActionLoading?: boolean;
  }>({ visible: false, title: '', message: '' });

  const openModal = (acc?: Account) => {
    if (acc) {
      setEditingId(acc.id);
      setNewName(acc.accountName);
      setNewDesc(acc.accountDescripton);
      setNewDate(acc.accountStartingDate ? new Date(acc.accountStartingDate) : new Date());
    } else {
      setEditingId(null);
      setNewName('');
      setNewDesc('');
      setNewDate(new Date());
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!newName.trim()) {
      setAlertState({
        visible: true,
        title: 'Invalid Input',
        message: 'Account Name is required.',
        showCancel: false,
        onConfirm: () => setAlertState(prev => ({ ...prev, visible: false })),
      });
      return;
    }
    setIsSaving(true);
    if (editingId) {
      await editAccount(editingId, {
        accountName: newName.trim(),
        accountDescripton: newDesc.trim(),
        accountStartingDate: newDate.toISOString(),
      });
    } else {
      await addAccount({
        accountName: newName.trim(),
        accountDescripton: newDesc.trim(),
        accountStartingDate: newDate.toISOString(),
      });
    }
    setIsSaving(false);
    setModalVisible(false);
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const confirmDelete = () => {
    setAlertState({
      visible: true,
      title: 'Delete Accounts',
      message: `Remove ${selected.size} account(s)?`,
      isDestructive: true,
      showCancel: true,
      onConfirm: async () => {
        setAlertState(prev => ({ ...prev, isActionLoading: true }));
        await deleteAccounts(Array.from(selected));
        setSelected(new Set());
        setAlertState(prev => ({ ...prev, visible: false, isActionLoading: false }));
      },
    });
  };

  const confirmLogout = () => {
    setAlertState({
      visible: true,
      title: 'Logout',
      message: 'Are you sure you want to log out?',
      isDestructive: true,
      showCancel: true,
      onConfirm: () => {
        setAlertState(prev => ({ ...prev, isActionLoading: true }));
        signOut();
      },
    });
  };

  const handleEditSelected = () => {
    const id = Array.from(selected)[0];
    const acc = accounts.find(a => a.id === id);
    if (acc) openModal(acc);
  };

  const total = getTotalAssets();
  const netStatusText = total >= 0 ? 'To Receive' : 'To Send';
  const netStatusColor = total >= 0 ? '#34d399' : '#f87171';

  const filteredAndSortedAccounts = useMemo(() => {
    let result = [...accounts];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.accountName.toLowerCase().includes(query) ||
          a.accountDescripton.toLowerCase().includes(query)
      );
    }
    // Sort by updatedAt latest first
    result.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
    return result;
  }, [accounts, searchQuery]);

  const getCardColors = (item: Account) => {
    const cardColors = [
      ['#a78bfa', '#7c3aed'],
      ['#38bdf8', '#0284c7'],
      ['#34d399', '#059669'],
      ['#fb923c', '#ea580c'],
      ['#f472b6', '#db2777'],
      ['#facc15', '#ca8a04'],
      ['#4ade80', '#16a34a'],
      ['#60a5fa', '#2563eb'],
    ];
    if (item.colorIndex !== undefined && item.colorIndex >= 0 && item.colorIndex < cardColors.length) {
      return cardColors[item.colorIndex];
    }
    // fallback
    let hash = 0;
    for (let i = 0; i < item.id.length; i++) {
      hash = item.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % cardColors.length;
    return cardColors[index];
  };

  const renderCard = ({ item }: { item: Account }) => {
    const bal = getAccountBalance(item);
    const isSelected = selected.has(item.id);
    const colors = getCardColors(item);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (selected.size > 0) toggle(item.id);
          else router.push(`/(main)/account/${item.id}` as any);
        }}
        onLongPress={() => toggle(item.id)}
      >
        <LinearGradient
          colors={isSelected ? ['#ef4444', '#dc2626'] : colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, isSelected && styles.cardSelected]}
        >
          <View style={styles.cardTop}>
            <View style={styles.cardIconCircle}>
              <Text style={styles.cardIconText}>
                {item.accountName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.cardBal}>
              {bal >= 0 ? formatCurrency(bal) : `-${formatCurrency(Math.abs(bal))}`}
            </Text>
          </View>

          <Text style={styles.cardName} numberOfLines={1}>
            {item.accountName}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardDesc} numberOfLines={1}>
              {item.accountDescripton || 'No description'}
            </Text>
            {item.updatedAt && (
              <Text style={styles.cardTime}>
                Updated {formatRelativeTime(item.updatedAt)}
              </Text>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ paddingHorizontal: 10 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>⋮</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <CustomMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          {
            icon: '🚪',
            label: 'Logout',
            isDestructive: true,
            onPress: confirmLogout,
          },
        ]}
      />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>
            Hello, {user?.displayName || 'User'} 👋
          </Text>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Assets</Text>
          <Text style={[styles.totalAmount, { color: total >= 0 ? '#34d399' : '#f87171' }]}>
            {formatCurrency(Math.abs(total))}
          </Text>
          <Text style={styles.totalAccounts}>{accounts.length} account(s)</Text>
          <Text style={[styles.netStatusText, { color: netStatusColor }]}>{netStatusText}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search accounts..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIconWrap}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selected.size > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selected.size} selected</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.selectionBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            {selected.size === 1 && (
              <TouchableOpacity onPress={handleEditSelected} style={styles.editBtn}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color="#a78bfa" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredAndSortedAccounts}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'No matches found' : 'No Accounts Yet'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'Try a different search term.'
                  : 'Tap the button below to add your first account.'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openModal()}
        onPressIn={() => setFabHovered(true)}
        onPressOut={() => setFabHovered(false)}
        style={styles.fabContainer}
      >
        {fabHovered && (
          <View style={styles.fabTooltip}>
            <Text style={styles.fabTooltipText}>New Account</Text>
          </View>
        )}
        <LinearGradient
          colors={['#a78bfa', '#7c3aed']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Text style={styles.fabPlus}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingId ? 'Edit Account' : 'New Account'}</Text>

            <Text style={styles.modalLabel}>Account Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Savings, Business"
              placeholderTextColor="#888"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Optional note"
              placeholderTextColor="#888"
              value={newDesc}
              onChangeText={setNewDesc}
            />

            <Text style={styles.modalLabel}>Opening Date</Text>
            {Platform.OS === 'ios' ? (
              <View style={styles.datePickerContainerIOS}>
                <DateTimePicker
                  value={newDate}
                  mode="date"
                  display="default"
                  onValueChange={(e, date) => date && setNewDate(date)}
                  themeVariant="dark"
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.modalInput} onPress={() => setShowPicker(true)}>
                <Text style={{ color: '#fff', fontSize: 16 }}>
                  {newDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}

            {Platform.OS === 'android' && showPicker && (
              <DateTimePicker
                value={newDate}
                mode="date"
                display="default"
                onDismiss={() => setShowPicker(false)}
                onValueChange={(e, date) => {
                  setShowPicker(false);
                  if (date) setNewDate(date);
                }}
              />
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity 
                style={[styles.modalCancelBtn, isSaving && { opacity: 0.5 }]} 
                onPress={() => !isSaving && setModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                activeOpacity={0.85} 
                onPress={handleSave} 
                style={[styles.modalSaveBtnContainer, isSaving && { opacity: 0.5 }]}
                disabled={isSaving}
              >
                <LinearGradient colors={['#a78bfa', '#7c3aed']} style={styles.modalSaveBtn}>
                  <Text style={styles.modalSaveText}>
                    {isSaving ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Account')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        isDestructive={alertState.isDestructive}
        isActionLoading={alertState.isActionLoading}
        onCancel={alertState.showCancel ? () => setAlertState(prev => ({ ...prev, visible: false })) : undefined}
        onConfirm={alertState.onConfirm}
        confirmText={alertState.showCancel ? (alertState.title === 'Logout' ? 'Logout' : 'Delete') : "OK"}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#fff' },
  totalCard: { position: 'relative', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 22, alignItems: 'center' },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 1 },
  totalAmount: { fontSize: 36, fontWeight: '800', marginVertical: 6 },
  totalAccounts: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  netStatusText: { position: 'absolute', bottom: 16, right: 16, fontSize: 12, fontWeight: '700', opacity: 0.9 },
  searchWrap: { paddingHorizontal: 20, marginVertical: 14 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  searchInput: { flex: 1, height: 46, color: '#fff', fontSize: 15, paddingHorizontal: 16 },
  clearIconWrap: { padding: 10, marginRight: 4 },
  clearIcon: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 'bold' },
  selectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(239,68,68,0.15)' },
  selectionText: { color: '#f87171', fontWeight: '700', fontSize: 15 },
  selectionActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  selectionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  cancelText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  editBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  editText: { color: '#fff', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  deleteText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
  card: { borderRadius: 22, padding: 22, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  cardSelected: { borderWidth: 2, borderColor: '#fff' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  cardIconText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  cardBal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cardName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1, marginRight: 8 },
  cardTime: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  fabContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 36 : 24, right: 20, flexDirection: 'row', alignItems: 'center' },
  fabTooltip: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 12 },
  fabTooltipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  fab: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 },
  fabPlus: { fontSize: 32, fontWeight: '500', color: '#fff', marginTop: -2 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalSheet: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: Platform.OS === 'ios' ? 48 : 28 },
  modalHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 8, marginLeft: 4 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, fontSize: 16, color: '#fff', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center' },
  datePickerContainerIOS: { marginBottom: 16, alignItems: 'flex-start' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  modalCancelBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 50, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
  modalSaveBtnContainer: { flex: 2 },
  modalSaveBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 50, borderRadius: 14 },
  modalSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
