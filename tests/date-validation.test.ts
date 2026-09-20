import { describe, expect, it } from "vitest";
import { createDefaultFinanceAccount } from "../modules/finance/data/defaults";
import { getFinanceDateIssue, isValidCalendarDateKey } from "../modules/finance/lib/date-validation";

describe("finance date validation", () => {
  it("rejects impossible calendar dates", () => {
    expect(isValidCalendarDateKey("2026-02-31")).toBe(false);
    expect(isValidCalendarDateKey("2026-09-20")).toBe(true);
  });

  it("flags years far outside the account history", () => {
    const account = { ...createDefaultFinanceAccount(), openingBalanceDate: "2026-01-01" };
    const now = new Date("2026-09-20T12:00:00.000Z");

    expect(getFinanceDateIssue("2022-07-15", [account], now)).toBe("implausible_year");
    expect(getFinanceDateIssue("2025-09-15", [account], now)).toBeNull();
    expect(getFinanceDateIssue("2026-09-20", [account], now)).toBeNull();
  });
});
