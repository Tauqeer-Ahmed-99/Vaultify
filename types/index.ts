export interface Transaction {
  id: string;
  amount: number;
  payment: 'sent' | 'received';
  date: string;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  accountName: string;
  accountDescripton: string;
  accountStartingDate: string;
  transactions: Transaction[];
  createdAt?: string;
  updatedAt?: string;
  colorIndex?: number;
}
