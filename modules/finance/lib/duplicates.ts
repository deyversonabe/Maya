import type { PayableBill, Transaction } from "../types";

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

function areSameMoneyValue(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}
