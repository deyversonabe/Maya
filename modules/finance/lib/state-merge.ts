import { DEFAULT_FINANCE_ACCOUNT_ID, createEmptyFinanceState } from "../data/defaults";
import type { FinanceAccount, FinanceState } from "../types";

export const MAX_DELETED_ENTITY_IDS = 1000;
export const MAX_ACTIVITY_LOGS = 200;

export type MergeableFinanceItem = {
  id: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentImageName?: string;
  receiptImageName?: string;
  documentItems?: unknown[];
  fiscalDocument?: unknown;
  createdAt?: string;
};

export function prepareFinanceStateForCloud(state: FinanceState): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map(stripUploadedAttachmentDataUrl),
    bills: state.bills.map(stripUploadedAttachmentDataUrl),
    taxDocuments: state.taxDocuments.map(stripUploadedAttachmentDataUrl),
    laborBenefits: state.laborBenefits.map(stripUploadedAttachmentDataUrl),
    payrollRecords: state.payrollRecords.map(stripUploadedAttachmentDataUrl),
    workTimeEntries: state.workTimeEntries.map(stripUploadedAttachmentDataUrl)
  };
}

export function hasFinanceContent(state: FinanceState) {
  return (
    state.transactions.length > 0 ||
    state.goals.length > 0 ||
    state.budgets.length > 0 ||
    state.bills.length > 0 ||
    state.salonMaterials.length > 0 ||
    state.salonServiceRecipes.length > 0 ||
    state.salonStockMovements.length > 0 ||
    state.taxDocuments.length > 0 ||
    state.laborBenefits.length > 0 ||
    state.payrollRecords.length > 0 ||
    state.workTimeEntries.length > 0 ||
    state.accounts.some((account) => account.id !== DEFAULT_FINANCE_ACCOUNT_ID || account.openingBalance !== 0)
  );
}

export function hasDifferentCloudPayload(left: FinanceState, right: FinanceState) {
  return JSON.stringify(withoutVolatileFields(prepareFinanceStateForCloud(left))) !==
    JSON.stringify(withoutVolatileFields(prepareFinanceStateForCloud(right)));
}

export function mergeFinanceStates(cloudState: FinanceState, localState: FinanceState, now = Date.now()): FinanceState {
  const cloudTime = getTime(cloudState.updatedAt);
  const localTime = getTime(localState.updatedAt);
  const deletedEntityIds = addDeletedEntityIds(cloudState.deletedEntityIds, ...localState.deletedEntityIds);
  const deletedEntityIdSet = new Set(deletedEntityIds);

  return {
    schemaVersion: 7,
    profile: localTime >= cloudTime ? localState.profile : cloudState.profile,
    accounts: ensureDefaultAccount(filterDeletedItems(mergeById(cloudState.accounts, localState.accounts), deletedEntityIdSet)).sort(sortByCreatedAtDesc),
    transactions: filterDeletedItems(mergeById(cloudState.transactions, localState.transactions), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    goals: filterDeletedItems(mergeById(cloudState.goals, localState.goals), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    budgets: filterDeletedItems(mergeById(cloudState.budgets, localState.budgets), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    bills: filterDeletedItems(mergeById(cloudState.bills, localState.bills), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    salonMaterials: filterDeletedItems(mergeById(cloudState.salonMaterials, localState.salonMaterials), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    salonServiceRecipes: filterDeletedItems(mergeById(cloudState.salonServiceRecipes, localState.salonServiceRecipes), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    salonStockMovements: filterDeletedItems(mergeById(cloudState.salonStockMovements, localState.salonStockMovements), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    taxDocuments: filterDeletedItems(mergeById(cloudState.taxDocuments, localState.taxDocuments), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    laborBenefits: filterDeletedItems(mergeById(cloudState.laborBenefits, localState.laborBenefits), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    payrollRecords: filterDeletedItems(mergeById(cloudState.payrollRecords, localState.payrollRecords), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    workTimeEntries: filterDeletedItems(mergeById(cloudState.workTimeEntries, localState.workTimeEntries), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    activityLogs: filterDeletedItems(mergeById(cloudState.activityLogs, localState.activityLogs), deletedEntityIdSet)
      .sort(sortByCreatedAtDesc)
      .slice(0, MAX_ACTIVITY_LOGS),
    deletedEntityIds,
    updatedAt: new Date(Math.max(cloudTime, localTime, now)).toISOString()
  };
}

export function addDeletedEntityIds(current: string[], ...ids: string[]) {
  const safeIds = ids.filter((id) => id && id !== DEFAULT_FINANCE_ACCOUNT_ID);
  return Array.from(new Set([...current, ...safeIds])).slice(-MAX_DELETED_ENTITY_IDS);
}

export function collectStateEntityIds(state: FinanceState) {
  return [
    ...state.accounts.filter((account) => account.id !== DEFAULT_FINANCE_ACCOUNT_ID).map((account) => account.id),
    ...state.transactions.map((transaction) => transaction.id),
    ...state.goals.map((goal) => goal.id),
    ...state.budgets.map((budget) => budget.id),
    ...state.bills.map((bill) => bill.id),
    ...state.salonMaterials.map((material) => material.id),
    ...state.salonServiceRecipes.map((recipe) => recipe.id),
    ...state.salonStockMovements.map((movement) => movement.id),
    ...state.taxDocuments.map((document) => document.id),
    ...state.laborBenefits.map((benefit) => benefit.id),
    ...state.payrollRecords.map((record) => record.id),
    ...state.workTimeEntries.map((entry) => entry.id)
  ];
}

export function mergeById<T extends MergeableFinanceItem>(base: T[], incoming: T[]) {
  const merged = new Map<string, T>();

  base.forEach((item) => merged.set(item.id, item));
  incoming.forEach((item) => {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? preserveDocumentFields(existing, item) : item);
  });

  return Array.from(merged.values());
}

export function filterDeletedItems<T extends { id: string }>(items: T[], deletedEntityIds: Set<string>) {
  return items.filter((item) => !deletedEntityIds.has(item.id));
}

export function preserveDocumentFields<T extends MergeableFinanceItem>(base: T, incoming: T): T {
  return {
    ...base,
    ...incoming,
    attachmentDataUrl: incoming.attachmentDataUrl || base.attachmentDataUrl,
    attachmentStoragePath: incoming.attachmentStoragePath || base.attachmentStoragePath,
    attachmentMimeType: incoming.attachmentMimeType || base.attachmentMimeType,
    attachmentSize: incoming.attachmentSize || base.attachmentSize,
    attachmentImageName: incoming.attachmentImageName || base.attachmentImageName,
    receiptImageName: incoming.receiptImageName || base.receiptImageName,
    documentItems: incoming.documentItems?.length ? incoming.documentItems : base.documentItems,
    fiscalDocument: incoming.fiscalDocument || base.fiscalDocument
  };
}

export function sortByCreatedAtDesc(left: { createdAt?: string }, right: { createdAt?: string }) {
  return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
}

export function withoutVolatileFields(state: FinanceState): FinanceState {
  return {
    ...state,
    updatedAt: ""
  };
}

export function getTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function ensureDefaultAccount(accounts: FinanceAccount[]) {
  return accounts.some((account) => account.id === DEFAULT_FINANCE_ACCOUNT_ID)
    ? accounts
    : [createEmptyFinanceState().accounts[0], ...accounts];
}

function stripUploadedAttachmentDataUrl<T extends { attachmentDataUrl?: string; attachmentStoragePath?: string }>(item: T): T {
  if (!item.attachmentStoragePath || !item.attachmentDataUrl) {
    return item;
  }

  const { attachmentDataUrl: _removedBase64, ...rest } = item;
  return rest as T;
}
