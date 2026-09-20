import type { DuplicateTransactionResult, PayableBill, Transaction } from "../types";

export interface TransactionDuplicateMatch {
  incoming: Omit<Transaction, "id" | "createdAt">;
  existing: Transaction;
}

export interface BillDuplicateMatch {
  incoming: Omit<PayableBill, "id" | "createdAt">;
  existing: PayableBill;
}

export interface BillTransactionDuplicateMatch {
  bill: PayableBill;
  transaction: Transaction;
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
      .filter((existing) => isPossibleBillDuplicate(existing, incoming))
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
  existing: Pick<Transaction, "type" | "amount" | "date"> &
    Partial<Pick<Transaction, "fiscalDocument" | "description" | "paymentRecipient" | "category">>,
  incoming: Pick<Transaction, "type" | "amount" | "date"> &
    Partial<Pick<Transaction, "fiscalDocument" | "description" | "paymentRecipient" | "category">>
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

  if (existing.date === incoming.date || areDatesNear(existing.date, incoming.date)) {
    return true;
  }

  // Datas muito distantes normalmente representam recorrencias legitimas.
  // A excecao e um forte indicio de ano digitado/OCR errado: mesmo valor,
  // anos bem diferentes e descricao/recebedor essencialmente iguais.
  return hasSuspiciousYearMismatch(existing.date, incoming.date) && haveStrongTextIdentity(existing, incoming);
}

export function isPossibleBillDuplicate(
  existing: Pick<PayableBill, "amount" | "dueDate" | "title"> & Partial<Pick<PayableBill, "paymentRecipient" | "category">>,
  incoming: Pick<PayableBill, "amount" | "dueDate" | "title"> & Partial<Pick<PayableBill, "paymentRecipient" | "category">>
) {
  if (!areSameMoneyValue(existing.amount, incoming.amount)) return false;
  if (existing.dueDate === incoming.dueDate || areDatesNear(existing.dueDate, incoming.dueDate)) return true;

  return (
    hasSuspiciousYearMismatch(existing.dueDate, incoming.dueDate) &&
    haveStrongTextIdentity(
      { description: existing.title, paymentRecipient: existing.paymentRecipient, category: existing.category },
      { description: incoming.title, paymentRecipient: incoming.paymentRecipient, category: incoming.category }
    )
  );
}

export function findPaidBillTransactionDuplicateMatches(
  transactions: Transaction[],
  bills: PayableBill[]
): BillTransactionDuplicateMatch[] {
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "expense");

  return bills
    .filter((bill) => bill.status === "paid")
    .flatMap((bill) =>
      expenseTransactions
        .filter((transaction) => {
          if (!areSameMoneyValue(transaction.amount, bill.amount)) return false;
          const billDate = bill.paidAt?.slice(0, 10) || bill.dueDate;
          if (!areDatesNear(transaction.date, billDate)) return false;

          return haveStrongTextIdentity(
            {
              description: transaction.description,
              paymentRecipient: transaction.paymentRecipient,
              category: transaction.category
            },
            { description: bill.title, paymentRecipient: bill.paymentRecipient, category: bill.category }
          );
        })
        .map((transaction) => ({ bill, transaction }))
    );
}


function hasSuspiciousYearMismatch(left: string, right: string) {
  const leftYear = Number(left.slice(0, 4));
  const rightYear = Number(right.slice(0, 4));
  return Number.isInteger(leftYear) && Number.isInteger(rightYear) && Math.abs(leftYear - rightYear) >= 2;
}

function haveStrongTextIdentity(
  left: { description?: string; paymentRecipient?: string; category?: string },
  right: { description?: string; paymentRecipient?: string; category?: string }
) {
  const leftRecipient = normalizeDuplicateText(left.paymentRecipient);
  const rightRecipient = normalizeDuplicateText(right.paymentRecipient);
  if (leftRecipient && rightRecipient && textSimilarity(leftRecipient, rightRecipient) >= 0.8) return true;

  const leftDescription = normalizeDuplicateText(left.description);
  const rightDescription = normalizeDuplicateText(right.description);
  if (leftDescription && rightDescription && textSimilarity(leftDescription, rightDescription) >= 0.65) return true;

  const leftCategory = normalizeDuplicateText(left.category);
  const rightCategory = normalizeDuplicateText(right.category);
  return Boolean(leftDescription && rightDescription && leftCategory && leftCategory === rightCategory && textSimilarity(leftDescription, rightDescription) >= 0.5);
}

function normalizeDuplicateText(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(conta|pagamento|compra|de|da|do|e|em|para|pix|boleto)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function textSimilarity(left: string, right: string) {
  if (left === right) return 1;
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
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
