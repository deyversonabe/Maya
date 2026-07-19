import { createDefaultMembers, createEmptyFinanceState } from "../data/defaults";
import type { Budget, FinanceState, Goal, HouseholdMember, HouseholdProfile, Transaction } from "../types";

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
  members: HouseholdMember[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  updatedAt: string;
}

export function migrateFinanceState(value: unknown): FinanceState {
  if (!isRecord(value)) {
    return createEmptyFinanceState();
  }

if (value.schemaVersion === 3) {
  return normalizeV3(value as unknown as PersistedFinanceStateV3);
}

if (value.schemaVersion === 2) {
  return normalizeV3(upgradeV2ToV3(value as unknown as PersistedFinanceStateV2));
}

if (value.schemaVersion === 1) {
  const state = value as unknown as PersistedFinanceStateV1;
  return {
    schemaVersion: 3,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    members: createDefaultMembers(),
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : []),
    budgets: [],
    updatedAt: new Date().toISOString()
  };
}

return createEmptyFinanceState();
}

function upgradeV2ToV3(state: PersistedFinanceStateV2): PersistedFinanceStateV3 {
  return {
    schemaVersion: 3,
    profile: state.profile,
    members: createDefaultMembers(),
    transactions: state.transactions,
    goals: state.goals,
    budgets: state.budgets,
    updatedAt: state.updatedAt
  };
}

function normalizeV3(state: PersistedFinanceStateV3): FinanceState {
  return {
    schemaVersion: 3,
    profile: isHouseholdProfile(state.profile) ? state.profile : createEmptyFinanceState().profile,
    members: normalizeMembers(state.members),
    transactions: stripLegacyDemoTransactions(Array.isArray(state.transactions) ? state.transactions : []),
    goals: stripLegacyDemoGoals(Array.isArray(state.goals) ? state.goals : []),
    budgets: stripLegacyDemoBudgets(normalizeBudgets(state.budgets)),
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString()
  };
}

function normalizeBudgets(budgets: Budget[] | undefined) {
  return Array.isArray(budgets) ? budgets.filter((budget) => budget.limitAmount > 0) : [];
}

function normalizeMembers(members: HouseholdMember[] | undefined): HouseholdMember[] {
  if (!Array.isArray(members) || members.length === 0) {
    return createDefaultMembers();
  }

const valid = members.filter(
  (member) => isRecord(member) && typeof member.id === "string" && typeof member.name === "string" && member.name.trim().length > 0
  );

return valid.length > 0 ? valid : createDefaultMembers();
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
