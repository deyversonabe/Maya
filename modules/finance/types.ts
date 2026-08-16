export type TransactionType = "income" | "expense" | "investment" | "transfer";

export type Person = "Deyverson" | "Tom" | "Casal";

export type GoalType = "reserve" | "travel" | "asset" | "retirement" | "dream";

export type GoalPriority = "low" | "medium" | "high";

export type TransactionSource = "manual" | "receipt" | "import" | "statement" | "salon_sale";

export type BudgetStatus = "safe" | "attention" | "exceeded";

export type FinancialDocumentKind = "expense" | "income" | "bill" | "statement";

export type PaymentMethod = "cash" | "boleto" | "pix" | "card" | "other";

export type FinanceAccountKind = "checking" | "cash" | "wallet" | "savings" | "other";

export type SalonMaterialUnit = "unit" | "ml";

export type SalonStockMovementType = "purchase" | "adjustment" | "usage" | "waste";

export interface SalonSaleMaterialSnapshot {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: SalonMaterialUnit;
  unitCost: number;
}

export type TaxDocumentKind =
  | "income_report"
  | "business_income"
  | "medical_receipt"
  | "education_receipt"
  | "bank_balance"
  | "investment"
  | "asset"
  | "property"
  | "vehicle"
  | "debt"
  | "dependent"
  | "other";

export type TaxDocumentStatus = "pending" | "reviewed" | "ready";

export type LaborBenefitType =
  | "fgts"
  | "inss"
  | "salary"
  | "thirteenth_salary"
  | "vacation"
  | "benefit"
  | "other";

export type PayrollRecordStatus = "pending_review" | "reviewed" | "attention";

export type FiscalDocumentType =
  | "danfe_nfe"
  | "danfe_nfce"
  | "cupom_fiscal"
  | "boleto"
  | "pix"
  | "recibo"
  | "extrato"
  | "unknown";

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
  paymentMethod?: PaymentMethod;
  paymentRecipient?: string;
  otherCategoryDescription?: string;
  receiptImageName?: string;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  documentItems?: FinancialDocumentItem[];
  fiscalDocument?: FiscalDocumentMetadata;
  notes?: string;
  accountId?: string;
  salonServiceRecipeId?: string;
  salonServiceName?: string;
  salonRecipeVersion?: number;
  salonMaterialCost?: number;
  salonRecipeItemsSnapshot?: SalonSaleMaterialSnapshot[];
  createdAt: string;
  updatedAt?: string;
}

export interface SalonMaterial {
  id: string;
  name: string;
  category: string;
  unit: SalonMaterialUnit;
  packageQuantity: number;
  packageCost: number;
  stockQuantity: number;
  minStockQuantity: number;
  lotNumber?: string;
  expirationDate?: string;
  supplier?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SalonRecipeItem {
  id: string;
  materialId: string;
  quantity: number;
}

export interface SalonServiceRecipe {
  id: string;
  name: string;
  category: string;
  price: number;
  version: number;
  items: SalonRecipeItem[];
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SalonStockMovement {
  id: string;
  materialId: string;
  type: SalonStockMovementType;
  quantity: number;
  unitCost: number;
  reason: string;
  date: string;
  serviceRecipeId?: string;
  transactionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SalonSaleInput {
  recipeId: string;
  clientName: string;
  amount: number;
  date: string;
  person: Person;
  paymentMethod: PaymentMethod;
  accountId?: string;
  notes?: string;
}

export interface FinanceAccount {
  id: string;
  name: string;
  kind: FinanceAccountKind;
  owner: Person;
  openingBalance: number;
  openingBalanceDate: string;
  color?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  contributions: GoalContribution[];
  dueDate: string;
  priority: GoalPriority;
  createdAt: string;
  updatedAt?: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  limitAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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
  paymentRecipient?: string;
  otherCategoryDescription?: string;
  recurrence: BillRecurrence;
  recurrenceGroupId?: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  status: BillStatus;
  source: BillSource;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  documentItems?: FinancialDocumentItem[];
  fiscalDocument?: FiscalDocumentMetadata;
  notes?: string;
  accountId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TaxDocument {
  id: string;
  year: number;
  person: Person;
  kind: TaxDocumentKind;
  title: string;
  institution?: string;
  amount?: number;
  documentDate?: string;
  description?: string;
  status: TaxDocumentStatus;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LaborBenefit {
  id: string;
  person: Person;
  type: LaborBenefitType;
  employer?: string;
  referenceMonth: string;
  amount: number;
  availableBalance?: number;
  blockedBalance?: number;
  documentDate?: string;
  notes?: string;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PayrollRecord {
  id: string;
  person: Person;
  referenceMonth: string;
  employer?: string;
  baseSalary: number;
  outsideBonus: number;
  payslipInss?: number;
  payslipIrrf?: number;
  payslipFgts?: number;
  taxesPaidByEmployer: boolean;
  status: PayrollRecordStatus;
  notes?: string;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkTimeEntry {
  id: string;
  person: Person;
  date: string;
  firstIn?: string;
  firstOut?: string;
  secondIn?: string;
  secondOut?: string;
  punches?: string[];
  startTime: string;
  endTime: string;
  lunchMinutes: number;
  expectedMinutes: number;
  notes?: string;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TimeClockDraft {
  date: string;
  firstIn?: string;
  firstOut?: string;
  secondIn?: string;
  secondOut?: string;
  startTime: string;
  endTime: string;
  lunchMinutes: number;
  expectedMinutes?: number;
  confidence: number;
  missingFields: string[];
  punches: string[];
  notes?: string;
}

export interface HouseholdProfile {
  name: string;
  slogan: string;
  monthlyIncomeTarget: number;
  emergencyReserveTarget: number;
}

export interface FinanceState {
  schemaVersion: 7;
  profile: HouseholdProfile;
  accounts: FinanceAccount[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  salonMaterials: SalonMaterial[];
  salonServiceRecipes: SalonServiceRecipe[];
  salonStockMovements: SalonStockMovement[];
  taxDocuments: TaxDocument[];
  laborBenefits: LaborBenefit[];
  payrollRecords: PayrollRecord[];
  workTimeEntries: WorkTimeEntry[];
  activityLogs: FinanceActivityLog[];
  deletedEntityIds: string[];
  updatedAt: string;
}

export type FinanceActivityEntity =
  | "transaction"
  | "bill"
  | "goal"
  | "budget"
  | "account"
  | "tax_document"
  | "labor_benefit"
  | "payroll_record"
  | "work_time_entry"
  | "salon_material"
  | "salon_recipe"
  | "salon_stock_movement"
  | "sync"
  | "system";

export interface FinanceActivityLog {
  id: string;
  actorEmail: string;
  action: string;
  entityType: FinanceActivityEntity;
  entityLabel: string;
  details?: string;
  createdAt: string;
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

export interface ExpenseDraft {
  description: string;
  amount: number;
  category: string;
  date: string;
  person: Person;
  confidence: number;
  source: TransactionSource;
  receiptImageName?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  paymentMethod?: PaymentMethod;
  paymentRecipient?: string;
  otherCategoryDescription?: string;
  items?: FinancialDocumentItem[];
  fiscalDocument?: FiscalDocumentMetadata;
}

export interface FinancialDocumentItem {
  name: string;
  amount?: number;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  code?: string;
  ean?: string;
  ncm?: string;
  date?: string;
  type?: TransactionType;
  category?: string;
  paymentMethod?: PaymentMethod;
  paymentRecipient?: string;
}

export interface FiscalDocumentMetadata {
  documentType?: FiscalDocumentType;
  accessKey?: string;
  qrCodeContent?: string;
  qrCodeUrl?: string;
  issuerName?: string;
  issuerCnpj?: string;
  documentNumber?: string;
  series?: string;
  issueTime?: string;
  protocolNumber?: string;
  totalItemsAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  paidAmount?: number;
}

export interface StatementTransactionDraft {
  type: Extract<TransactionType, "income" | "expense">;
  description: string;
  amount: number;
  category: string;
  person: Person;
  date: string;
  paymentMethod?: PaymentMethod;
  paymentRecipient?: string;
  otherCategoryDescription?: string;
  confidence: number;
  notes?: string;
}

export interface BankStatementDraft {
  title: string;
  periodStart?: string;
  periodEnd?: string;
  confidence: number;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  lines: StatementTransactionDraft[];
  missingFields: string[];
  notes?: string;
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
  paymentRecipient?: string;
  otherCategoryDescription?: string;
  confidence: number;
  source: TransactionSource | BillSource;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  missingFields: string[];
  items?: FinancialDocumentItem[];
  fiscalDocument?: FiscalDocumentMetadata;
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

export interface FinancialHealthAlert {
  id: string;
  title: string;
  message: string;
  priority: "info" | "warning" | "critical";
  createdAt: string;
}

export interface TransactionReviewInput {
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  person: Person;
  date: string;
}

export interface DuplicateTransactionResult {
  transaction: Transaction;
  confidence: "exact" | "similar";
}

export interface TransactionReviewIssue {
  level: "info" | "warning";
  code: "missing_description" | "invalid_amount" | "missing_person" | "possible_duplicate" | "possible_internal_transfer";
  message: string;
}

export interface TransactionReview {
  ok: boolean;
  issues: TransactionReviewIssue[];
  duplicate: DuplicateTransactionResult | null;
  suggestedType: TransactionType | null;
}
