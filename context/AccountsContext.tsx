import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { database } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';
import { useAuth } from './AuthContext';
import { Account, Transaction } from '../types';
import { Alert } from 'react-native';

interface AccountsContextType {
  accounts: Account[];
  isLoading: boolean;
  fetchAccounts: () => Promise<void>;
  addAccount: (account: Omit<Account, 'id' | 'transactions'>) => Promise<void>;
  editAccount: (accountId: string, data: Partial<Omit<Account, 'id' | 'transactions'>>) => Promise<void>;
  deleteAccounts: (ids: string[]) => Promise<void>;
  addTransaction: (accountId: string, txn: Omit<Transaction, 'id'>) => Promise<void>;
  editTransaction: (accountId: string, txnId: string, data: Partial<Omit<Transaction, 'id'>>) => Promise<void>;
  deleteTransactions: (accountId: string, txnIds: string[]) => Promise<void>;
  getTotalAssets: () => number;
  getAccountBalance: (account: Account) => number;
}

const AccountsContext = createContext<AccountsContextType>({
  accounts: [],
  isLoading: false,
  fetchAccounts: async () => {},
  addAccount: async () => {},
  editAccount: async () => {},
  deleteAccounts: async () => {},
  addTransaction: async () => {},
  editTransaction: async () => {},
  deleteTransactions: async () => {},
  getTotalAssets: () => 0,
  getAccountBalance: () => 0,
});

export const useAccounts = () => useContext(AccountsContext);

export const AccountsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      return;
    }
    setIsLoading(true);
    try {
      const dbRef = ref(database, `accounts/${user.uid}`);
      const snapshot = await get(dbRef);
      const data = snapshot.val();

      if (data) {
        const loaded: Account[] = Object.keys(data).map((key, index) => {
          const raw = data[key];
          let transactions: Transaction[] = [];
          if (raw.transactions && typeof raw.transactions === 'object') {
            transactions = Object.keys(raw.transactions).map((txnKey) => ({
              id: txnKey,
              amount: Number(raw.transactions[txnKey].amount) || 0,
              payment: raw.transactions[txnKey].payment || 'received',
              date: raw.transactions[txnKey].date || '',
              reason: raw.transactions[txnKey].reason || '',
              createdAt: raw.transactions[txnKey].createdAt || '',
              updatedAt: raw.transactions[txnKey].updatedAt || '',
            }));
          }
          
          let cIndex = raw.colorIndex;
          if (cIndex === undefined) {
             cIndex = index % 8;
             // Save it back to DB asynchronously so it's permanently locked
             update(ref(database, `accounts/${user.uid}/${key}`), { colorIndex: cIndex }).catch(() => {});
          }

          return {
            id: key,
            accountName: raw.accountName || 'Untitled',
            accountDescripton: raw.accountDescripton || '',
            accountStartingDate: raw.accountStartingDate || '',
            transactions,
            createdAt: raw.createdAt || '',
            updatedAt: raw.updatedAt || '',
            colorIndex: cIndex,
          };
        });
        setAccounts(loaded);
      } else {
        setAccounts([]);
      }
    } catch (error: any) {
      console.error('fetchAccounts error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    } else {
      setAccounts([]);
    }
  }, [user, fetchAccounts]);

  const addAccount = async (accountData: Omit<Account, 'id' | 'transactions'>) => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      // Get the next sequential color index (0-4) based on current accounts array length
      // If accounts length is not yet fetched properly, fallback to 0.
      let nextIndex = 0;
      setAccounts((prev) => {
        nextIndex = prev.length % 5;
        return prev;
      });
      
      await push(ref(database, `accounts/${user.uid}`), {
        ...accountData,
        createdAt: now,
        updatedAt: now,
        colorIndex: nextIndex,
      });
      await fetchAccounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to add account.');
    }
  };

  const editAccount = async (accountId: string, data: Partial<Omit<Account, 'id' | 'transactions'>>) => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      await update(ref(database, `accounts/${user.uid}/${accountId}`), {
        ...data,
        updatedAt: now,
      });
      await fetchAccounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to update account.');
    }
  };

  const deleteAccounts = async (ids: string[]) => {
    if (!user) return;
    try {
      const updates: Record<string, null> = {};
      ids.forEach((id) => { updates[id] = null; });
      await update(ref(database, `accounts/${user.uid}`), updates);
      await fetchAccounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account(s).');
    }
  };

  const addTransaction = async (accountId: string, txn: Omit<Transaction, 'id'>) => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      await push(ref(database, `accounts/${user.uid}/${accountId}/transactions`), {
        ...txn,
        createdAt: now,
        updatedAt: now,
      });
      // also update account updatedAt
      await update(ref(database, `accounts/${user.uid}/${accountId}`), {
        updatedAt: now,
      });
      await fetchAccounts();
    } catch (error) {
      Alert.alert('Error', 'Transaction failed.');
    }
  };

  const editTransaction = async (accountId: string, txnId: string, data: Partial<Omit<Transaction, 'id'>>) => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      await update(ref(database, `accounts/${user.uid}/${accountId}/transactions/${txnId}`), {
        ...data,
        updatedAt: now,
      });
      await update(ref(database, `accounts/${user.uid}/${accountId}`), {
        updatedAt: now,
      });
      await fetchAccounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to update transaction.');
    }
  };

  const deleteTransactions = async (accountId: string, txnIds: string[]) => {
    if (!user) return;
    try {
      const updates: Record<string, null> = {};
      txnIds.forEach((id) => { updates[id] = null; });
      const now = new Date().toISOString();
      await update(ref(database, `accounts/${user.uid}/${accountId}/transactions`), updates);
      await update(ref(database, `accounts/${user.uid}/${accountId}`), {
        updatedAt: now,
      });
      await fetchAccounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete transaction(s).');
    }
  };

  const getAccountBalance = (account: Account): number => {
    let bal = 0;
    account.transactions.forEach((txn) => {
      if (txn.payment === 'sent') bal += txn.amount;
      else bal -= txn.amount;
    });
    return bal;
  };

  const getTotalAssets = (): number => {
    let total = 0;
    accounts.forEach((acc) => { total += getAccountBalance(acc); });
    return total;
  };

  return (
    <AccountsContext.Provider
      value={{
        accounts,
        isLoading,
        fetchAccounts,
        addAccount,
        editAccount,
        deleteAccounts,
        addTransaction,
        editTransaction,
        deleteTransactions,
        getTotalAssets,
        getAccountBalance,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
};
