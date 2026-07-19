import type { DuplicateMatch, Transaction, TransactionType } from "../types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const AMOUNT_TOLERANCE = 0.005;
const EXACT_WINDOW_DAYS = 1;
const LIKELY_WINDOW_DAYS = 3;

export function normalizeText(value: string): string {
  return value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/\s+/g, " ");
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();

if (Number.isNaN(a) || Number.isNaN(b)) {
  return Number.POSITIVE_INFINITY;
}

return Math.abs(a - b) / DAY_IN_MS;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

interface DuplicateCandidate {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
}

export function findDuplicateTransaction(
  candidate: DuplicateCandidate,
  existing: Transaction[]
  ): DuplicateMatch | null {
  const candidateText = normalizeText(candidate.description);

let bestMatch: DuplicateMatch | null = null;

for (const transaction of existing) {
  if (transaction.type !== candidate.type) {
    continue;
  }

  if (!sameAmount(transaction.amount, candidate.amount)) {
    continue;
  }

  const gap = daysBetween(transaction.date, candidate.date);
  const existingText = normalizeText(transaction.description);
  const sameDescription = existingText === candidateText;

  if (gap <= EXACT_WINDOW_DAYS && sameDescription) {
    return {
      transaction,
      confidence: "exact",
      reason: "Mesmo valor, mesma descricao e mesma data de um lancamento ja existente."
    };
  }

  if (gap <= LIKELY_WINDOW_DAYS && sameDescription) {
    bestMatch = {
      transaction,
      confidence: "likely",
      reason: "Valor igual e data proxima de um lancamento ja existente, pode ser o mesmo evento (ex: despesa da nota e do extrato)."
    };
  }
}

return bestMatch;
}

export function partitionDuplicates(
  candidates: Transaction[],
  existing: Transaction[]
  ): { accepted: Transaction[]; skipped: Array<{ transaction: Transaction; duplicate: DuplicateMatch }> } {
  const accepted: Transaction[] = [];
  const skipped: Array<{ transaction: Transaction; duplicate: DuplicateMatch }> = [];
  const pool = [...existing];

for (const candidate of candidates) {
  const duplicate = findDuplicateTransaction(candidate, pool);

  if (duplicate && duplicate.confidence === "exact") {
    skipped.push({ transaction: candidate, duplicate });
    continue;
  }

  accepted.push(candidate);
  pool.push(candidate);
}

return { accepted, skipped };
}
