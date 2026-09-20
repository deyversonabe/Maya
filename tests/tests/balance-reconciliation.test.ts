import { describe, expect, it } from "vitest";
import { createEmptyFinanceState } from "../modules/finance/data/defaults";
import { calculateSummary } from "../modules/finance/lib/calculations";
import { buildFinancialPosition } from "../modules/finance/lib/balance";

function buildState() {
  const state = createEmptyFinanceState();
  state.accounts = [
    {
      ...state.accounts[0],
      openingBalance: -1809.84,
      openingBalanceDate: "2026-09-01"
    }
  ];
  state.transactions = [
    {
      id: "income_sep",
      type: "income",
      description: "Salario Deyverson (2/3)",
      amount: 2800,
      category: "Salario",
      person: "Deyverson",
      date: "2026-09-07",
      recurring: false,
      accountId: state.accounts[0].id,
      createdAt: "2026-09-07T12:00:00.000Z"
    }
  ];
  state.bills = [
    {
      id: "bill_sep",
      title: "Contas previstas setembro",
      amount: 1134.9,
      category: "Moradia",
      person: "Casal",
      dueDate: "2026-09-25",
      paymentMethod: "boleto",
      recurrence: "none",
      status: "pending",
      source: "manual",
      accountId: state.accounts[0].id,
      createdAt: "2026-09-01T12:00:00.000Z"
    }
  ];
  return state;
}

describe("financial balance reconciliation", () => {
  it("separates monthly result, accumulated balance and projected balance", () => {
    const state = buildState();
    const now = new Date("2026-09-20T12:00:00.000Z");
    const position = buildFinancialPosition(state, "2026-09", now);
    const summary = calculateSummary(state, now);

    expect(summary.periodResult).toBeCloseTo(2800, 2);
    expect(position.currentBalance).toBeCloseTo(990.16, 2);
    expect(summary.currentBalance).toBeCloseTo(990.16, 2);
    expect(summary.unpaidBills).toBeCloseTo(1134.9, 2);
    expect(summary.projectedBalance).toBeCloseTo(-144.74, 2);
  });

  it("does not report 100 percent savings when known unpaid bills exist", () => {
    const summary = calculateSummary(buildState(), new Date("2026-09-20T12:00:00.000Z"));

    expect(summary.realizedSavingsRate).toBe(100);
    expect(summary.savingsRate).not.toBe(100);
    expect(summary.projectedSavingsRate).toBeCloseTo(((2800 - 1134.9) / 2800) * 100, 5);
  });
});
