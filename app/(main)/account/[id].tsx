import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccounts } from '../../../context/AccountsContext';
import { Transaction } from '../../../types';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert from '../../../components/CustomAlert';

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

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, isLoading, addTransaction, editTransaction, deleteTransactions, getAccountBalance } = useAccounts();
  
  const account = accounts.find((a) => a.id === id);

  const [searchQuery, setSearchQuery] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'sent' | 'received'>('received');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [txnDate, setTxnDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(val);
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

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 15 && Math.abs(gestureState.dx) < 20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          setModalVisible(false);
        }
      },
    })
  ).current;

  if (!account) {
    return (
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.container}>
        <View style={styles.emptyWrap}>
          <ActivityIndicator color="#a78bfa" size="large" />
        </View>
      </LinearGradient>
    );
  }

  const balance = getAccountBalance(account);
  const netStatusText = balance >= 0 ? 'To Receive' : 'To Send';
  const netStatusColor = balance >= 0 ? '#34d399' : '#f87171';

  const openModal = (type: 'sent' | 'received', txn?: Transaction) => {
    if (txn) {
      setEditingTxnId(txn.id);
      setPaymentType(txn.payment);
      setAmount(txn.amount.toString());
      setReason(txn.reason);
      setTxnDate(txn.date ? new Date(txn.date) : new Date());
    } else {
      setEditingTxnId(null);
      setPaymentType(type);
      setAmount('');
      setReason('');
      setTxnDate(new Date());
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setAlertState({
        visible: true,
        title: 'Invalid Input',
        message: 'Enter a valid amount.',
        showCancel: false,
        onConfirm: () => setAlertState(prev => ({ ...prev, visible: false })),
      });
      return;
    }
    
    setIsSaving(true);
    if (editingTxnId) {
      await editTransaction(account.id, editingTxnId, {
        amount: val,
        payment: paymentType,
        reason: reason.trim(),
        date: txnDate.toISOString(),
      });
    } else {
      await addTransaction(account.id, {
        amount: val,
        payment: paymentType,
        reason: reason.trim(),
        date: txnDate.toISOString(),
      });
    }
    setIsSaving(false);
    
    setModalVisible(false);
    setSelected(new Set());
  };

  const toggle = (txnId: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(txnId)) s.delete(txnId);
      else s.add(txnId);
      return s;
    });
  };

  const confirmDelete = () => {
    setAlertState({
      visible: true,
      title: 'Delete Transactions',
      message: `Remove ${selected.size} transaction(s)?`,
      isDestructive: true,
      showCancel: true,
      onConfirm: async () => {
        setAlertState(prev => ({ ...prev, isActionLoading: true }));
        await deleteTransactions(account.id, Array.from(selected));
        setSelected(new Set());
        setAlertState(prev => ({ ...prev, visible: false, isActionLoading: false }));
      },
    });
  };

  const handleEditSelected = () => {
    const txnId = Array.from(selected)[0];
    const txn = account.transactions.find(t => t.id === txnId);
    if (txn) openModal(txn.payment, txn);
  };

  const filteredAndSortedTxns = useMemo(() => {
    let result = [...account.transactions];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((t) => t.reason.toLowerCase().includes(query));
    }
    // Sort by actual transaction date (latest on top)
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [account.transactions, searchQuery]);

  const renderTxn = ({ item }: { item: Transaction }) => {
    const isSent = item.payment === 'sent';
    const isSelected = selected.has(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (selected.size > 0) toggle(item.id);
        }}
        onLongPress={() => toggle(item.id)}
      >
        <View style={[styles.txnCard, isSelected && styles.txnSelected]}>
          <View
            style={[
              styles.txnCircle,
              { backgroundColor: isSent ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)' },
            ]}
          >
            <Text style={[styles.txnIcon, { color: '#fff' }]}>{isSent ? '↑' : '↓'}</Text>
          </View>

          <View style={styles.txnInfo}>
            <Text style={styles.txnReason} numberOfLines={1}>
              {item.reason || 'No note'}
            </Text>
            <View style={styles.txnMetaRow}>
              <Text style={styles.txnDate}>
                {new Date(item.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              {item.updatedAt && (
                <>
                  <Text style={styles.metaDot}> • </Text>
                  <Text style={styles.txnEdited}>
                    Edited {formatRelativeTime(item.updatedAt)}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.txnAmountWrap}>
            <Text style={[styles.txnAmount, { color: isSent ? '#f87171' : '#34d399' }]}>
              {formatCurrency(item.amount)}
            </Text>
            <Text style={[styles.txnLegend, { color: isSent ? '#f87171' : '#34d399' }]}>
              {isSent ? 'SENT' : 'RECEIVED'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.container}>
      <Stack.Screen
        options={{
          title: account.accountName,
        }}
      />

      <View style={styles.balanceWrap}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={[styles.balanceValue, { color: balance >= 0 ? '#34d399' : '#f87171' }]}>
            {formatCurrency(Math.abs(balance))}
          </Text>
          <Text style={styles.balanceSub}>
            {account.transactions.length} transaction(s)
          </Text>
          <Text style={[styles.netStatusText, { color: netStatusColor }]}>{netStatusText}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
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
            <TouchableOpacity onPress={() => setSelected(new Set())}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            {selected.size === 1 && (
              <TouchableOpacity onPress={handleEditSelected} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={confirmDelete} style={styles.delBtn}>
              <Text style={styles.delBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color="#a78bfa" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredAndSortedTxns}
          keyExtractor={(item) => item.id}
          renderItem={renderTxn}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            filteredAndSortedTxns.length > 0 && !searchQuery.trim() ? (
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'No matches found' : 'No Transactions'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'Try a different search term.'
                  : 'Use the buttons below to record payments.'}
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.bottomBtnWrap}
          onPress={() => openModal('received')}
        >
          <LinearGradient colors={['#34d399', '#059669']} style={styles.bottomBtn}>
            <Text style={styles.bottomBtnIcon}>↓</Text>
            <Text style={styles.bottomBtnText}>Receive</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.bottomBtnWrap}
          onPress={() => openModal('sent')}
        >
          <LinearGradient colors={['#fb923c', '#ea580c']} style={styles.bottomBtn}>
            <Text style={styles.bottomBtnIcon}>↑</Text>
            <Text style={styles.bottomBtnText}>Send</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={styles.modalWrap}
        >
          <View style={styles.modalSheet} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingTxnId ? 'Edit Transaction' : (paymentType === 'received' ? 'Record Incoming' : 'Record Outgoing')}
            </Text>

            <Text style={styles.modalLabel}>Amount</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.modalLabel}>Note / Reason</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What's this for?"
              placeholderTextColor="#666"
              value={reason}
              onChangeText={setReason}
            />

            <Text style={styles.modalLabel}>Date</Text>
            {Platform.OS === 'ios' ? (
              <View style={styles.datePickerContainerIOS}>
                <DateTimePicker
                  value={txnDate}
                  mode="date"
                  display="default"
                  onValueChange={(e, date) => date && setTxnDate(date)}
                  themeVariant="dark"
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.modalInput} onPress={() => setShowPicker(true)}>
                <Text style={{ color: '#fff', fontSize: 16 }}>
                  {txnDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}

            {Platform.OS === 'android' && showPicker && (
              <DateTimePicker
                value={txnDate}
                mode="date"
                display="default"
                onDismiss={() => setShowPicker(false)}
                onValueChange={(e, date) => {
                  setShowPicker(false);
                  if (date) setTxnDate(date);
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
                <LinearGradient
                  colors={
                    paymentType === 'received' ? ['#34d399', '#059669'] : ['#fb923c', '#ea580c']
                  }
                  style={styles.modalSaveBtn}
                >
                  <Text style={styles.modalSaveText}>
                    {isSaving ? 'Saving...' : (editingTxnId ? 'Save Changes' : 'Save')}
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
        confirmText={alertState.showCancel ? "Delete" : "OK"}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  balanceWrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0 },
  balanceCard: { position: 'relative', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 28, alignItems: 'center' },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 1 },
  balanceValue: { fontSize: 40, fontWeight: '800', marginVertical: 6 },
  balanceSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  netStatusText: { position: 'absolute', bottom: 16, right: 16, fontSize: 12, fontWeight: '700', opacity: 0.9 },
  searchWrap: { paddingHorizontal: 20, marginVertical: 14 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  searchInput: { flex: 1, height: 46, color: '#fff', fontSize: 15, paddingHorizontal: 16 },
  clearIconWrap: { padding: 10, marginRight: 4 },
  clearIcon: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 'bold' },
  selectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(239,68,68,0.12)' },
  selectionText: { color: '#f87171', fontWeight: '700', fontSize: 15 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  editBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  editBtnText: { color: '#fff', fontWeight: '700' },
  delBtn: { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  delBtnText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 14 },
  txnCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  txnSelected: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)' },
  txnCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  txnIcon: { fontSize: 20, fontWeight: '900' },
  txnInfo: { flex: 1, marginRight: 8 },
  txnReason: { color: '#fff', fontSize: 15, fontWeight: '600' },
  txnMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  txnDate: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  metaDot: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  txnEdited: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontStyle: 'italic' },
  txnAmountWrap: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 17, fontWeight: '800' },
  txnLegend: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  emptyWrap: { alignItems: 'center', marginTop: 50 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16, backgroundColor: 'rgba(15,12,41,0.92)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 12 },
  bottomBtnWrap: { flex: 1 },
  bottomBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 52, borderRadius: 16 },
  bottomBtnIcon: { fontSize: 18, color: '#fff', marginRight: 6, fontWeight: '700' },
  bottomBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
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
