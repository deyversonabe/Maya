import { describe, expect, it } from "vitest";
import { isPossibleTransactionDuplicate } from "../modules/finance/lib/duplicates";
import type { Transaction } from "../modules/finance/types";

const base: Transaction = {
  id: "a",
  type: "expense",
  description: "Mercado",
  amount: 100,
  category: "Alimentacao",
  person: "Casal",
  date: "2026-08-15",
  recurring: false,
  createdAt: "2026-08-15T12:00:00.000Z"
};

describe("duplicate detection", () => {
  it("does not mark income and expense with same amount/date as duplicate", () => {
    expect(isPossibleTransactionDuplicate(base, { type: "income", amount: base.amount, date: base.date })).toBe(false);
  });

  it("flags same type, same day and same value as duplicate", () => {
    expect(isPossibleTransactionDuplicate(base, { type: "expense", amount: base.amount, date: base.date })).toBe(true);
  });
});
