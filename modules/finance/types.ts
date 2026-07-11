export type TransactionType = "income" | "expense" | "investment" | "transfer";

export type Person = "Pessoa 1" | "Pessoa 2" | "Casal";

export type GoalType = "reserve" | "travel" | "asset" | "retirement" | "dream";

export type GoalPriority = "low" | "medium" | "high";

export type TransactionSource = "manual" | "receipt" | "import";

export type BudgetStatus = "safe" | "attention" | "exceeded";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  person: Person;
  date: string;
  recurring: boolean;
  recurrenceGroupId?: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  source?: TransactionSource;
  receiptImageName?: string;
  notes?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  dueDate: string;
  priority: GoalPriority;
  createdAt: string;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  limitAmount: number;
  notes?: string;
  createdAt: string;
}

export interface HouseholdProfile {
  name: string;
  slogan: string;
  monthlyIncomeTarget: number;
  emergencyReserveTarget: number;
}

export interface FinanceState {
  schemaVersion: 2;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  updatedAt: string;
}

export interface FinanceSummary {
  currentMonth: string;
  income: number;
  expenses: number;
  investments: number;
  availableBalance: number;
  savingsRate: number;
  goalsTotal: number;
  goalsProgress: number;
  biggestExpenseCategory: string;
  biggestExpenseAmount: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
  investments: number;
  availableBalance: number;
  savingsRate: number;
}

export interface BudgetUsage {
  budget: Budget;
  spent: number;
  remaining: number;
  usedPercent: number;
  status: BudgetStatus;
}

export interface MayaAnalysis {
  assistantName: "MAYA";
  message: string;
  healthScore: number;
  trend: "growth" | "drop" | "stable";
  highlights: string[];
  nextActions: string[];
}

export interface DataQualityReport {
  score: number;
  level: "insufficient" | "partial" | "consistent";
  label: string;
  summary: string;
  completed: string[];
  missing: string[];
}

export interface ExpenseDraft {
  description: string;
  amount: number;
  category: string;
  date: string;
  person: Person;
  confidence: number;
  source: TransactionSource;
  receiptImageName?: string;
  items?: Array<{
    name: string;
    amount?: number;
  }>;
}
