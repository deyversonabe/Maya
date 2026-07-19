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
  return incomingTransactions.flatMap((incoming) => {
    if (incoming.type !== "income" && incoming.type !== "expense") {
      return [];
    }

    return existingTransactions
      .filter(
        (existing) =>
          existing.type === incoming.type &&
          existing.date === incoming.date &&
          areSameMoneyValue(existing.amount, incoming.amount)
      )
      .map((existing) => ({
        incoming,
        existing
      }));
  });
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
    (transaction) =>
      transaction.type === candidate.type &&
      transaction.date === candidate.date &&
      areSameMoneyValue(transaction.amount, candidate.amount)
  );

  if (exact) {
    return {
      transaction: exact,
      confidence: "exact"
    };
  }

  const similar = existingTransactions.find(
    (transaction) =>
      transaction.type === candidate.type &&
      areSameMoneyValue(transaction.amount, candidate.amount) &&
      areDatesNear(transaction.date, candidate.date)
  );

  return similar
    ? {
        transaction: similar,
        confidence: "similar"
      }
    : null;
}

function areSameMoneyValue(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

function areDatesNear(left: string, right: string) {
  const leftTime = Date.parse(`${left}T12:00:00`);
  const rightTime = Date.parse(`${right}T12:00:00`);

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false;
  }

  return Math.abs(leftTime - rightTime) <= 2 * 86_400_000;
}
