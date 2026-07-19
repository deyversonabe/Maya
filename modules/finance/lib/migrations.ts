import { createEmptyFinanceState } from "../data/defaults";
import type { Budget, FinanceState, Goal, HouseholdProfile, PayableBill, Transaction } from "../types";

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

interface PersistedFinanceStateV3 extends FinanceState {
  schemaVersion: 3;
}

export function migrateFinanceState(value: unknown): FinanceState {
  if (!isRecord(value)) {
    return createEmptyFinanceState();
  }

  if (value.schemaVersion === 3) {
    return normalizeV3(value as unknown as PersistedFinanceStateV3);
  }

  if (value.schemaVersion === 2) {
    const state = value as unknown as PersistedFinanceStateV2;
    return {
      ...normalizeV2(state),
      schemaVersion: 3,
      bills: normalizeBills((value as { bills?: PayableBill[] }).bills),
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
    };
  }

  if (value.schemaVersion === 1) {
    const state = value as unknown as PersistedFinanceStateV1;
    return {
      schemaVersion: 3,
      profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
      transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
      goals: stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : []),
      budgets: [],
      bills: [],
      updatedAt: new Date().toISOString()
    };
  }

  return createEmptyFinanceState();
}

function normalizeV3(state: PersistedFinanceStateV3): FinanceState {
  return {
    schemaVersion: 3,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : []),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    bills: normalizeBills(state.bills),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeV2(state: PersistedFinanceStateV2) {
  return {
    schemaVersion: 2 as const,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : []),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeBudgets(budgets: Budget[] | undefined) {
  return Array.isArray(budgets) ? budgets.filter((budget) => budget.limitAmount > 0) : [];
}

function normalizeBills(bills: PayableBill[] | undefined): PayableBill[] {
  if (!Array.isArray(bills)) {
    return [];
  }

  return bills
    .filter((bill) => bill.amount > 0 && typeof bill.title === "string" && typeof bill.dueDate === "string")
    .map((bill): PayableBill => ({
      ...bill,
      status: bill.status === "paid" || bill.status === "overdue" ? bill.status : "pending",
      recurrence: bill.recurrence === "monthly" ? "monthly" : "none",
      paymentMethod:
        bill.paymentMethod === "boleto" || bill.paymentMethod === "pix" || bill.paymentMethod === "card"
          ? bill.paymentMethod
          : "other",
      source: bill.source === "attachment" || bill.source === "import" ? bill.source : "manual"
    }));
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
  return transactions.filter((transaction) => {
    const source = (transaction as { source?: unknown }).source;
    return source !== "seed" && !legacyDemoTransactionFingerprints.has(fingerprintLegacyText(transaction.description));
  });
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
