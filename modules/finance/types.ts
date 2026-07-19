export type TransactionType = "income" | "expense" | "investment" | "transfer";

export type Person = "Pessoa 1" | "Pessoa 2" | "Casal";

export type GoalType = "reserve" | "travel" | "asset" | "retirement" | "dream";

export type GoalPriority = "low" | "medium" | "high";

export type TransactionSource = "manual" | "receipt" | "import";

export type BudgetStatus = "safe" | "attention" | "exceeded";

export type FinancialDocumentKind = "expense" | "income" | "bill";

export type PaymentMethod = "boleto" | "pix" | "card" | "other";

export type BillRecurrence = "none" | "monthly";

export type BillStatus = "pending" | "paid" | "overdue";

export type BillSource = "manual" | "attachment" | "import";

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
  attachmentImageName?: string;
  attachmentDataUrl?: string;
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

export interface PayableBill {
  id: string;
  title: string;
  description?: string;
  amount: number;
  category: string;
  person: Person;
  dueDate: string;
  paymentMethod: PaymentMethod;
  paymentCode?: string;
  recurrence: BillRecurrence;
  recurrenceGroupId?: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  status: BillStatus;
  source: BillSource;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
}

export interface HouseholdProfile {
  name: string;
  slogan: string;
  monthlyIncomeTarget: number;
  emergencyReserveTarget: number;
}

export interface FinanceState {
  schemaVersion: 3;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
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
  items?: FinancialDocumentItem[];
}

export interface FinancialDocumentItem {
  name: string;
  amount?: number;
  date?: string;
  type?: TransactionType;
  category?: string;
}

export interface FinancialDocumentDraft {
  kind: FinancialDocumentKind;
  title: string;
  description: string;
  amount: number;
  category: string;
  documentDate?: string;
  dueDate?: string;
  entryDate?: string;
  person: Person;
  paymentMethod?: PaymentMethod;
  paymentCode?: string;
  confidence: number;
  source: TransactionSource | BillSource;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  missingFields: string[];
  items?: FinancialDocumentItem[];
  notes?: string;
}

export interface BillAlert {
  id: string;
  bill: PayableBill;
  type: "due_soon" | "due_today_noon" | "overdue";
  title: string;
  message: string;
  priority: "info" | "warning" | "critical";
  triggerAt: string;
}
