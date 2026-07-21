import { createEmptyFinanceState } from "../data/defaults";
import type {
  Budget,
  FinanceActivityLog,
  FinanceState,
  Goal,
  GoalContribution,
  HouseholdProfile,
  PayableBill,
  Transaction
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
      activityLogs: normalizeActivityLogs((value as { activityLogs?: FinanceActivityLog[] }).activityLogs),
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
    };
  }

  if (value.schemaVersion === 1) {
    const state = value as unknown as PersistedFinanceStateV1;
    return {
      schemaVersion: 3,
      profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
      transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
      goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
      budgets: [],
      bills: [],
      activityLogs: [],
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
    goals: normalizeGoals(stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : [])),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    bills: normalizeBills(state.bills),
    activityLogs: normalizeActivityLogs((state as { activityLogs?: FinanceActivityLog[] }).activityLogs),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
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
      status: bill.status === "paid" || bill.status === "overdue" ? bill.status : "pending",
      recurrence: bill.recurrence === "monthly" ? "monthly" : "none",
      paymentMethod:
        bill.paymentMethod === "boleto" || bill.paymentMethod === "pix" || bill.paymentMethod === "card"
          ? bill.paymentMethod
          : "other",
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
