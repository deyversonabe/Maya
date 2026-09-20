import { describe, expect, it } from "vitest";
import { formatUnitCost, parseFinancialAmountInput } from "../lib/utils";

describe("financial values", () => {
  it("keeps Brazilian thousands and cents correctly", () => {
    expect(parseFinancialAmountInput("R$ 5.000")).toBe(5000);
    expect(parseFinancialAmountInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseFinancialAmountInput("45.9")).toBe(45.9);
    expect(parseFinancialAmountInput("0.005")).toBe(0.005);
  });

  it("does not round unit costs to two decimals", () => {
    expect(formatUnitCost(0.1234)).toContain("0,1234");
  });
});
