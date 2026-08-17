import { describe, expect, it } from "vitest";
import { getTransactionsByMonth } from "../modules/finance/lib/calculations";
import type { Transaction } from "../modules/finance/types";

function expense(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? `txn_${Math.random()}`,
    type: "expense",
    description: overrides.description ?? "Despesa",
    amount: overrides.amount ?? 0,
    category: overrides.category ?? "Outros",
    person: overrides.person ?? "Casal",
    date: overrides.date ?? "2026-08-16",
    recurring: false,
    source: overrides.source ?? "manual",
    createdAt: overrides.createdAt ?? "2026-08-16T12:00:00.000Z",
    ...overrides
  };
}

describe("receipt monthly financial flow", () => {
  it("counts a receipt expense in the same monthly transaction path as a manual expense", () => {
    const transactions = [
      expense({ id: "manual", amount: 100, source: "manual", date: "2026-08-10" }),
      expense({ id: "receipt", amount: 123.45, source: "receipt", date: "2026-08-16" }),
      expense({ id: "other-month", amount: 999, source: "receipt", date: "2026-07-16" })
    ];

    const august = getTransactionsByMonth(transactions, "2026-08");

    expect(august).toHaveLength(2);
    expect(august.reduce((total, transaction) => total + transaction.amount, 0)).toBeCloseTo(223.45, 2);
    expect(august.map((transaction) => transaction.source)).toContain("receipt");
  });
});
