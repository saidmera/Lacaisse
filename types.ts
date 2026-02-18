
export enum EntryType {
  EXPENSE = 'EXPENSE',
  ALIMENTATION = 'ALIMENTATION'
}

export interface ExpenseRecord {
  id: string;
  date: string;
  productName: string;
  price: number;
  photo?: string; // base64 string
}

export interface AlimentationRecord {
  id: string;
  date: string;
  amount: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  totalExpenses: number;
  totalAlimentation: number;
  balance: number;
  carryOver: number;
}

export type ViewState = 'AUTH' | 'DASHBOARD' | 'EXPENSE_FORM' | 'ALIMENTATION_FORM' | 'DETAILS' | 'EXPORT';
