import { describe, expect, it } from "vitest";
import {
  isPossibleBillDuplicate,
  isPossibleTransactionDuplicate
} from "../modules/finance/lib/duplicates";
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

  it("flags the same fiscal access key even when OCR produced a different date/year", () => {
    const accessKey = "35260812345678000123550010000012341000012345";
    expect(
      isPossibleTransactionDuplicate(
        { ...base, date: "2022-08-15", fiscalDocument: { documentType: "danfe_nfe", accessKey } },
        { type: "expense", amount: 61.69, date: "2026-08-15", fiscalDocument: { documentType: "danfe_nfe", accessKey } }
      )
    ).toBe(true);
  });

  it("flags likely year mistakes when amount and description identify the same expense", () => {
    expect(
      isPossibleTransactionDuplicate(
        { ...base, description: "Conta de agua e esgoto", amount: 118.47, date: "2022-07-15" },
        { type: "expense", description: "Agua", amount: 118.47, date: "2026-08-11" }
      )
    ).toBe(true);
  });

  it("does not flag equal recurring values in nearby years when descriptions differ", () => {
    expect(
      isPossibleTransactionDuplicate(
        { ...base, description: "Internet", amount: 100, date: "2024-08-15" },
        { type: "expense", description: "Academia", amount: 100, date: "2026-08-15" }
      )
    ).toBe(false);
  });

  it("flags bill duplicates with suspicious year and strong title identity", () => {
    expect(
      isPossibleBillDuplicate(
        { title: "Conta de agua e esgoto", amount: 118.47, dueDate: "2022-07-15", category: "Moradia" },
        { title: "Agua", amount: 118.47, dueDate: "2026-08-11", category: "Moradia" }
      )
    ).toBe(true);
  });
});
