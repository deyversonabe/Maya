import { DEFAULT_FINANCE_ACCOUNT_ID, createDefaultFinanceAccount, createEmptyFinanceState } from "../data/defaults";
import type {
  Budget,
  FinanceActivityLog,
  FinanceAccount,
  FinanceState,
  Goal,
  GoalContribution,
  HouseholdProfile,
  LaborBenefit,
  LaborBenefitType,
  PayableBill,
  PaymentMethod,
  Person,
  PayrollRecord,
  PayrollRecordStatus,
  TaxDocument,
  TaxDocumentKind,
  TaxDocumentStatus,
  Transaction,
  WorkTimeEntry
} from "../types";

interface PersistedFinanceStateV1 {
  schemaVersion: 1;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  updatedAt: string;
}

interface PersistedFinanceStateV2 {
  schemaVersion: 2;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  updatedAt: string;
}

interface PersistedFinanceStateV3 {
  schemaVersion: 3;
  profile: HouseholdProfile;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  activityLogs?: FinanceActivityLog[];
  updatedAt: string;
}

interface PersistedFinanceStateV4 {
  schemaVersion: 4;
  profile: HouseholdProfile;
  accounts: FinanceAccount[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  activityLogs?: FinanceActivityLog[];
  updatedAt: string;
}

interface PersistedFinanceStateV5 {
  schemaVersion: 5;
  profile: HouseholdProfile;
  accounts: FinanceAccount[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  bills: PayableBill[];
  taxDocuments: TaxDocument[];
  laborBenefits: LaborBenefit[];
  activityLogs: FinanceActivityLog[];
  updatedAt: string;
}

interface PersistedFinanceStateV6 extends FinanceState {
  schemaVersion: 6;
}

export function migrateFinanceState(value: unknown): FinanceState {
  if (!isRecord(value)) {
    return createEmptyFinanceState();
  }

  if (value.schemaVersion === 6) {
    return normalizeV6(value as unknown as PersistedFinanceStateV6);
  }

  if (value.schemaVersion === 5) {
    return normalizeV5(value as unknown as PersistedFinanceStateV5);
  }

  if (value.schemaVersion === 4) {
    return normalizeV4(value as unknown as PersistedFinanceStateV4);
  }

  if (value.schemaVersion === 3) {
    const state = normalizeV3(value as unknown as PersistedFinanceStateV3);
    return {
      ...state,
      schemaVersion: 6,
      accounts: normalizeAccounts((value as { accounts?: FinanceAccount[] }).accounts),
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      deletedEntityIds: normalizeDeletedEntityIds((value as { deletedEntityIds?: unknown[] }).deletedEntityIds)
    };
  }

  if (value.schemaVersion === 2) {
    const state = value as unknown as PersistedFinanceStateV2;
    return {
      ...normalizeV2(state),
      schemaVersion: 6,
      accounts: normalizeAccounts((value as { accounts?: FinanceAccount[] }).accounts),
      bills: normalizeBills((value as { bills?: PayableBill[] }).bills),
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      deletedEntityIds: normalizeDeletedEntityIds((value as { deletedEntityIds?: unknown[] }).deletedEntityIds),
      activityLogs: normalizeActivityLogs((value as { activityLogs?: FinanceActivityLog[] }).activityLogs),
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
    };
  }

  if (value.schemaVersion === 1) {
    const state = value as unknown as PersistedFinanceStateV1;
    return {
      schemaVersion: 6,
      profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
      accounts: [createDefaultFinanceAccount()],
      transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
      goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
      budgets: [],
      bills: [],
      taxDocuments: [],
      laborBenefits: [],
      payrollRecords: [],
      workTimeEntries: [],
      deletedEntityIds: [],
      activityLogs: [],
      updatedAt: new Date().toISOString()
    };
  }

  return createEmptyFinanceState();
}

function normalizeV6(state: PersistedFinanceStateV6): FinanceState {
  return {
    schemaVersion: 6,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    accounts: normalizeAccounts(state.accounts),
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    bills: normalizeBills(state.bills),
    taxDocuments: normalizeTaxDocuments((state as { taxDocuments?: TaxDocument[] }).taxDocuments),
    laborBenefits: normalizeLaborBenefits((state as { laborBenefits?: LaborBenefit[] }).laborBenefits),
    payrollRecords: normalizePayrollRecords((state as { payrollRecords?: PayrollRecord[] }).payrollRecords),
    workTimeEntries: normalizeWorkTimeEntries((state as { workTimeEntries?: WorkTimeEntry[] }).workTimeEntries),
    activityLogs: normalizeActivityLogs((state as { activityLogs?: FinanceActivityLog[] }).activityLogs),
    deletedEntityIds: normalizeDeletedEntityIds((state as { deletedEntityIds?: unknown[] }).deletedEntityIds),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeV5(state: PersistedFinanceStateV5): FinanceState {
  return normalizeV6({
    ...state,
    schemaVersion: 6,
    payrollRecords: [],
    workTimeEntries: [],
    deletedEntityIds: []
  });
}

function normalizeV4(state: PersistedFinanceStateV4): FinanceState {
  return normalizeV6({
    ...state,
    schemaVersion: 6,
    taxDocuments: [],
    laborBenefits: [],
    payrollRecords: [],
    workTimeEntries: [],
    deletedEntityIds: [],
    activityLogs: state.activityLogs ?? []
  });
}

function normalizeV3(state: PersistedFinanceStateV3) {
  return {
    schemaVersion: 3 as const,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    bills: normalizeBills(state.bills),
    activityLogs: normalizeActivityLogs((state as { activityLogs?: FinanceActivityLog[] }).activityLogs),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeDeletedEntityIds(ids: unknown[] | undefined) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))).slice(-1000);
}

function normalizeTaxDocuments(documents: TaxDocument[] | undefined): TaxDocument[] {
  if (!Array.isArray(documents)) {
    return [];
  }

  const currentYear = new Date().getFullYear();

  return documents
    .filter((document) => typeof document.title === "string" && document.title.trim())
    .map((document): TaxDocument => ({
      ...document,
      id: typeof document.id === "string" && document.id ? document.id : `tax_${crypto.randomUUID()}`,
      year: Number.isInteger(document.year) && document.year >= 2000 ? document.year : currentYear,
      person: normalizePerson(document.person),
      kind: normalizeTaxDocumentKind(document.kind),
      title: document.title.trim(),
      institution: typeof document.institution === "string" ? document.institution.trim() || undefined : undefined,
      amount: Number.isFinite(document.amount) ? document.amount : undefined,
      documentDate:
        typeof document.documentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(document.documentDate)
          ? document.documentDate
          : undefined,
      description: typeof document.description === "string" ? document.description.trim() || undefined : undefined,
      status: normalizeTaxDocumentStatus(document.status),
      notes: typeof document.notes === "string" ? document.notes.trim() || undefined : undefined,
      createdAt: typeof document.createdAt === "string" ? document.createdAt : new Date().toISOString(),
      updatedAt: typeof document.updatedAt === "string" ? document.updatedAt : undefined
    }));
}

function normalizeLaborBenefits(benefits: LaborBenefit[] | undefined): LaborBenefit[] {
  if (!Array.isArray(benefits)) {
    return [];
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return benefits
    .filter((benefit) => Number.isFinite(benefit.amount) || Number.isFinite(benefit.blockedBalance))
    .map((benefit): LaborBenefit => ({
      ...benefit,
      id: typeof benefit.id === "string" && benefit.id ? benefit.id : `labor_${crypto.randomUUID()}`,
      person: normalizePerson(benefit.person),
      type: normalizeLaborBenefitType(benefit.type),
      employer: typeof benefit.employer === "string" ? benefit.employer.trim() || undefined : undefined,
      referenceMonth:
        typeof benefit.referenceMonth === "string" && /^\d{4}-\d{2}$/.test(benefit.referenceMonth)
          ? benefit.referenceMonth
          : currentMonth,
      amount: Number.isFinite(benefit.amount) ? benefit.amount : 0,
      availableBalance: Number.isFinite(benefit.availableBalance) ? benefit.availableBalance : undefined,
      blockedBalance: Number.isFinite(benefit.blockedBalance) ? benefit.blockedBalance : undefined,
      documentDate:
        typeof benefit.documentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(benefit.documentDate)
          ? benefit.documentDate
          : undefined,
      notes: typeof benefit.notes === "string" ? benefit.notes.trim() || undefined : undefined,
      createdAt: typeof benefit.createdAt === "string" ? benefit.createdAt : new Date().toISOString(),
      updatedAt: typeof benefit.updatedAt === "string" ? benefit.updatedAt : undefined
    }));
}

function normalizePayrollRecords(records: PayrollRecord[] | undefined): PayrollRecord[] {
  if (!Array.isArray(records)) {
    return [];
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return records
    .filter((record) => Number.isFinite(record.baseSalary) || Number.isFinite(record.outsideBonus))
    .map((record): PayrollRecord => ({
      ...record,
      id: typeof record.id === "string" && record.id ? record.id : `payroll_${crypto.randomUUID()}`,
      person: normalizePerson(record.person),
      referenceMonth:
        typeof record.referenceMonth === "string" && /^\d{4}-\d{2}$/.test(record.referenceMonth)
          ? record.referenceMonth
          : currentMonth,
      employer: typeof record.employer === "string" ? record.employer.trim() || undefined : undefined,
      baseSalary: Number.isFinite(record.baseSalary) ? Math.max(0, record.baseSalary) : 0,
      outsideBonus: Number.isFinite(record.outsideBonus) ? Math.max(0, record.outsideBonus) : 0,
      payslipInss: normalizeOptionalPositiveNumber(record.payslipInss),
      payslipIrrf: normalizeOptionalPositiveNumber(record.payslipIrrf),
      payslipFgts: normalizeOptionalPositiveNumber(record.payslipFgts),
      taxesPaidByEmployer: record.taxesPaidByEmployer === true,
      status: normalizePayrollRecordStatus(record.status),
      notes: typeof record.notes === "string" ? record.notes.trim() || undefined : undefined,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined
    }));
}

function normalizeWorkTimeEntries(entries: WorkTimeEntry[] | undefined): WorkTimeEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => typeof entry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .map((entry): WorkTimeEntry => ({
      ...entry,
      id: typeof entry.id === "string" && entry.id ? entry.id : `work_${crypto.randomUUID()}`,
      person: normalizePerson(entry.person),
      startTime: normalizeTime(entry.startTime, "08:00"),
      endTime: normalizeTime(entry.endTime, "18:00"),
      lunchMinutes: Number.isFinite(entry.lunchMinutes) ? Math.max(0, Math.min(240, Math.round(entry.lunchMinutes))) : 72,
      expectedMinutes:
        Number.isFinite(entry.expectedMinutes) && entry.expectedMinutes >= 0
          ? Math.round(entry.expectedMinutes)
          : getDefaultExpectedMinutesForDate(entry.date),
      notes: typeof entry.notes === "string" ? entry.notes.trim() || undefined : undefined,
      attachmentImageName: typeof entry.attachmentImageName === "string" ? entry.attachmentImageName : undefined,
      attachmentDataUrl: typeof entry.attachmentDataUrl === "string" ? entry.attachmentDataUrl : undefined,
      attachmentStoragePath: typeof entry.attachmentStoragePath === "string" ? entry.attachmentStoragePath : undefined,
      attachmentMimeType: typeof entry.attachmentMimeType === "string" ? entry.attachmentMimeType : undefined,
      attachmentSize:
        typeof entry.attachmentSize === "number" && Number.isFinite(entry.attachmentSize)
          ? Math.max(0, Math.round(entry.attachmentSize))
          : undefined,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : undefined
    }));
}

function normalizeV2(state: PersistedFinanceStateV2) {
  return {
    schemaVersion: 2 as const,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeBudgets(budgets: Budget[] | undefined) {
  return Array.isArray(budgets) ? budgets.filter((budget) => budget.limitAmount > 0) : [];
}

function normalizeAccounts(accounts: FinanceAccount[] | undefined): FinanceAccount[] {
  const normalized = Array.isArray(accounts)
    ? accounts
        .filter((account) => typeof account.name === "string" && account.name.trim())
        .map((account): FinanceAccount => ({
          ...account,
          id: typeof account.id === "string" && account.id ? account.id : `account_${crypto.randomUUID()}`,
          name: account.name.trim() === "Conta principal" ? "Carteira do casal" : account.name.trim(),
          kind:
            account.kind === "cash" ||
            account.kind === "wallet" ||
            account.kind === "savings" ||
            account.kind === "other"
              ? account.kind
              : "checking",
          owner: normalizePerson(account.owner),
          openingBalance: Number.isFinite(account.openingBalance) ? account.openingBalance : 0,
          openingBalanceDate:
            typeof account.openingBalanceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(account.openingBalanceDate)
              ? account.openingBalanceDate
              : new Date().toISOString().slice(0, 10),
          color: typeof account.color === "string" ? account.color : undefined,
          createdAt: typeof account.createdAt === "string" ? account.createdAt : new Date().toISOString()
        }))
    : [];

  if (!normalized.some((account) => account.id === DEFAULT_FINANCE_ACCOUNT_ID)) {
    return [createDefaultFinanceAccount(), ...normalized];
  }

  return normalized;
}

function normalizeGoals(goals: Goal[] | undefined): Goal[] {
  if (!Array.isArray(goals)) {
    return [];
  }

  return goals
    .filter((goal) => typeof goal.name === "string" && goal.targetAmount > 0)
    .map((goal) => {
      const contributions = normalizeGoalContributions((goal as { contributions?: GoalContribution[] }).contributions);
      const currentAmount = Number.isFinite(goal.currentAmount) && goal.currentAmount > 0 ? goal.currentAmount : 0;

      return {
        ...goal,
        currentAmount,
        contributions:
          contributions.length > 0
            ? contributions
            : currentAmount > 0
              ? [
                  {
                    id: `goal_entry_${goal.id || "legacy"}`,
                    amount: currentAmount,
                    date: typeof goal.createdAt === "string" ? goal.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
                    notes: "Saldo anterior importado.",
                    createdAt: typeof goal.createdAt === "string" ? goal.createdAt : new Date().toISOString()
                  }
                ]
              : []
      };
    });
}

function normalizeGoalContributions(contributions: GoalContribution[] | undefined): GoalContribution[] {
  if (!Array.isArray(contributions)) {
    return [];
  }

  return contributions
    .filter((contribution) => Number.isFinite(contribution.amount) && contribution.amount !== 0)
    .map((contribution) => ({
      ...contribution,
      id: typeof contribution.id === "string" ? contribution.id : `goal_entry_${crypto.randomUUID()}`,
      date:
        typeof contribution.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(contribution.date)
          ? contribution.date
          : new Date().toISOString().slice(0, 10),
      createdAt: typeof contribution.createdAt === "string" ? contribution.createdAt : new Date().toISOString()
    }));
}

function normalizeBills(bills: PayableBill[] | undefined): PayableBill[] {
  if (!Array.isArray(bills)) {
    return [];
  }

  return bills
    .filter((bill) => bill.amount > 0 && typeof bill.title === "string" && typeof bill.dueDate === "string")
    .map((bill): PayableBill => ({
      ...bill,
      person: normalizePerson(bill.person),
      status: bill.status === "paid" || bill.status === "overdue" ? bill.status : "pending",
      recurrence: bill.recurrence === "monthly" ? "monthly" : "none",
      paymentMethod: normalizePaymentMethod(bill.paymentMethod),
      source: bill.source === "attachment" || bill.source === "import" ? bill.source : "manual"
    }));
}

function normalizeActivityLogs(logs: FinanceActivityLog[] | undefined): FinanceActivityLog[] {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs
    .filter((log) => typeof log.action === "string" && typeof log.entityLabel === "string")
    .map((log) => ({
      id: typeof log.id === "string" ? log.id : `activity_${crypto.randomUUID()}`,
      actorEmail: typeof log.actorEmail === "string" && log.actorEmail ? log.actorEmail : "usuario autorizado",
      action: log.action,
      entityType:
        log.entityType === "transaction" ||
        log.entityType === "bill" ||
        log.entityType === "goal" ||
        log.entityType === "budget" ||
        log.entityType === "account" ||
        log.entityType === "tax_document" ||
        log.entityType === "labor_benefit" ||
        log.entityType === "payroll_record" ||
        log.entityType === "work_time_entry" ||
        log.entityType === "sync" ||
        log.entityType === "system"
          ? log.entityType
          : "system",
      entityLabel: log.entityLabel,
      details: typeof log.details === "string" ? log.details : undefined,
      createdAt: typeof log.createdAt === "string" ? log.createdAt : new Date().toISOString()
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 200);
}

// Fingerprints de dados demonstrativos pre-producao. Mantidos somente para limpeza de migracao local.
const legacyDemoTransactionFingerprints = new Set([
  3612114414,
  4057225229,
  1538124196,
  1244043720,
  4109015035,
  2536025139,
  3617946332
]);

const legacyDemoGoalFingerprints = new Set([1670746555, 1374139306, 223302076]);

const legacyDemoBudgetFingerprints = new Set([3156547588, 341645336, 3781375277]);

function stripLegacyDemoTransactions(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => {
      const source = (transaction as { source?: unknown }).source;
      return source !== "seed" && !legacyDemoTransactionFingerprints.has(fingerprintLegacyText(transaction.description));
    })
    .map((transaction): Transaction => ({
      ...transaction,
      person: normalizePerson(transaction.person),
      paymentMethod: transaction.paymentMethod ? normalizePaymentMethod(transaction.paymentMethod) : undefined
    }));
}

function stripLegacyDemoGoals(goals: Goal[]) {
  return goals.filter((goal) => !legacyDemoGoalFingerprints.has(fingerprintLegacyText(goal.name)));
}

function stripLegacyDemoBudgets(budgets: Budget[]) {
  return budgets.filter((budget) => !legacyDemoBudgetFingerprints.has(fingerprintLegacyText(budget.notes ?? "")));
}

function fingerprintLegacyText(value: string) {
  let hash = 2166136261;

  for (const character of value.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHouseholdProfile(value: unknown): value is HouseholdProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.slogan === "string" &&
    typeof value.monthlyIncomeTarget === "number" &&
    typeof value.emergencyReserveTarget === "number"
  );
}

function normalizePerson(person: unknown): Person {
  if (person === "Deyveron" || person === "Tom" || person === "Casal") {
    return person;
  }

  if (person === "Pessoa 1") {
    return "Deyveron";
  }

  if (person === "Pessoa 2") {
    return "Tom";
  }

  return "Casal";
}

function normalizePaymentMethod(method: unknown): PaymentMethod {
  if (method === "cash" || method === "boleto" || method === "pix" || method === "card" || method === "other") {
    return method;
  }

  return "other";
}

function normalizeTaxDocumentKind(kind: unknown): TaxDocumentKind {
  const allowed: TaxDocumentKind[] = [
    "income_report",
    "business_income",
    "medical_receipt",
    "education_receipt",
    "bank_balance",
    "investment",
    "asset",
    "property",
    "vehicle",
    "debt",
    "dependent",
    "other"
  ];

  return allowed.includes(kind as TaxDocumentKind) ? (kind as TaxDocumentKind) : "other";
}

function normalizeTaxDocumentStatus(status: unknown): TaxDocumentStatus {
  if (status === "reviewed" || status === "ready") {
    return status;
  }

  return "pending";
}

function normalizeLaborBenefitType(type: unknown): LaborBenefitType {
  const allowed: LaborBenefitType[] = [
    "fgts",
    "inss",
    "salary",
    "thirteenth_salary",
    "vacation",
    "benefit",
    "other"
  ];

  return allowed.includes(type as LaborBenefitType) ? (type as LaborBenefitType) : "other";
}

function normalizePayrollRecordStatus(status: unknown): PayrollRecordStatus {
  if (status === "reviewed" || status === "attention") {
    return status;
  }

  return "pending_review";
}

function normalizeOptionalPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : undefined;
}

function normalizeTime(value: unknown, fallback: string) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function getDefaultExpectedMinutesForDate(date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return weekday >= 1 && weekday <= 5 ? 528 : 0;
}
