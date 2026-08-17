import type { DuplicateTransactionResult, PayableBill, Transaction } from "../types";

export interface TransactionDuplicateMatch {
  incoming: Omit<Transaction, "id" | "createdAt">;
  existing: Transaction;
}

export interface BillDuplicateMatch {
  incoming: Omit<PayableBill, "id" | "createdAt">;
  existing: PayableBill;
}

export function findTransactionDuplicateMatches(
  existingTransactions: Transaction[],
  incomingTransactions: Array<Omit<Transaction, "id" | "createdAt">>
): TransactionDuplicateMatch[] {
  const matches: TransactionDuplicateMatch[] = [];
  const seen = new Set<string>();

  incomingTransactions.forEach((incoming) => {
    if (incoming.type !== "income" && incoming.type !== "expense") {
      return;
    }

    existingTransactions
      .filter((existing) => isPossibleTransactionDuplicate(existing, incoming))
      .forEach((existing) => {
        const key = `${existing.id}_${incoming.type}_${incoming.date}_${normalizeAmountKey(incoming.amount)}_${incoming.description}`;

        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        matches.push({
          incoming,
          existing
        });
      });
  });

  return matches;
}

export function findBillDuplicateMatches(
  existingBills: PayableBill[],
  incomingBills: Array<Omit<PayableBill, "id" | "createdAt">>
): BillDuplicateMatch[] {
  return incomingBills.flatMap((incoming) =>
    existingBills
      .filter((existing) => existing.dueDate === incoming.dueDate && areSameMoneyValue(existing.amount, incoming.amount))
      .map((existing) => ({
        incoming,
        existing
      }))
  );
}

export function findDuplicateTransaction(
  candidate: Pick<Transaction, "type" | "description" | "amount" | "date">,
  existingTransactions: Transaction[]
): DuplicateTransactionResult | null {
  if (candidate.type !== "income" && candidate.type !== "expense") {
    return null;
  }

  const exact = existingTransactions.find(
    (transaction) => transaction.type === candidate.type && isSameDaySameAmount(transaction, candidate)
  );

  if (exact) {
    return {
      transaction: exact,
      confidence: "exact"
    };
  }

  const similar = existingTransactions.find(
    (transaction) => isPossibleTransactionDuplicate(transaction, candidate)
  );

  return similar
    ? {
        transaction: similar,
        confidence: "similar"
      }
    : null;
}

export function isPossibleTransactionDuplicate(
  existing: Pick<Transaction, "type" | "amount" | "date"> & Partial<Pick<Transaction, "fiscalDocument">>,
  incoming: Pick<Transaction, "type" | "amount" | "date"> & Partial<Pick<Transaction, "fiscalDocument">>
) {
  if (!isTrackedTransactionType(existing.type) || !isTrackedTransactionType(incoming.type)) {
    return false;
  }

  if (existing.type !== incoming.type) {
    return false;
  }

  const existingAccessKey = normalizeFiscalAccessKey(existing.fiscalDocument?.accessKey);
  const incomingAccessKey = normalizeFiscalAccessKey(incoming.fiscalDocument?.accessKey);

  if (existingAccessKey && incomingAccessKey && existingAccessKey === incomingAccessKey) {
    return true;
  }

  if (!areSameMoneyValue(existing.amount, incoming.amount)) {
    return false;
  }

  if (existing.date === incoming.date) {
    return true;
  }

  return existing.type === incoming.type && areDatesNear(existing.date, incoming.date);
}

function isSameDaySameAmount(
  existing: Pick<Transaction, "type" | "amount" | "date">,
  incoming: Pick<Transaction, "type" | "amount" | "date">
) {
  return existing.type === incoming.type && existing.date === incoming.date && areSameMoneyValue(existing.amount, incoming.amount);
}

function isTrackedTransactionType(type: Transaction["type"]) {
  return type === "income" || type === "expense";
}

function areSameMoneyValue(left: number, right: number) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.005;
}

function normalizeAmountKey(value: number) {
  return Number.isFinite(value) ? String(value) : "invalid";
}

function areDatesNear(left: string, right: string) {
  const leftTime = Date.parse(`${left}T12:00:00`);
  const rightTime = Date.parse(`${right}T12:00:00`);

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false;
  }

  return Math.abs(leftTime - rightTime) <= 2 * 86_400_000;
}

export function normalizeFiscalAccessKey(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 44 ? digits : "";
}

export function findTransactionByFiscalAccessKey(
  transactions: Transaction[],
  accessKey: string | undefined,
  type: Transaction["type"] = "expense"
) {
  const normalized = normalizeFiscalAccessKey(accessKey);

  if (!normalized) {
    return undefined;
  }

  return transactions.find(
    (transaction) => transaction.type === type && normalizeFiscalAccessKey(transaction.fiscalDocument?.accessKey) === normalized
  );
}
