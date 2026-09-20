import { describe, expect, it } from "vitest";
import { validateBankStatementDraft, validateFinancialDocumentDraft } from "@/modules/captures/validation";
import type { BankStatementDraft, FinancialDocumentDraft } from "@/modules/finance/types";

describe("validacao de capturas", () => {
  it("marca nota coerente como pronta, mas a confirmacao continua externa a validacao", () => {
    const draft: FinancialDocumentDraft = {
      kind: "expense",
      title: "Mercado",
      description: "Compra supermercado",
      amount: 150,
      category: "Alimentacao",
      person: "Casal",
      documentDate: "2026-09-20",
      confidence: 1,
      source: "receipt",
      missingFields: [],
      items: [
        { name: "Item A", quantity: 1, unitPrice: 100, amount: 100 },
        { name: "Item B", quantity: 1, unitPrice: 50, amount: 50 }
      ],
      fiscalDocument: { issuerCnpj: "12345678000199", accessKey: "1".repeat(44), paidAmount: 150 }
    };
    const result = validateFinancialDocumentDraft(draft);
    expect(result.status).toBe("ready");
    expect(result.score).toBe(100);
  });

  it("bloqueia documento sem valor/data essenciais", () => {
    const draft: FinancialDocumentDraft = {
      kind: "expense",
      title: "",
      description: "",
      amount: 0,
      category: "Outros",
      person: "Casal",
      documentDate: "2026-02-31",
      confidence: 0.3,
      source: "receipt",
      missingFields: []
    };
    const result = validateFinancialDocumentDraft(draft);
    expect(result.status).toBe("blocked");
    expect(result.issues.some((issue) => issue.level === "error")).toBe(true);
  });

  it("reconcilia extrato com saldo inicial + entradas - saidas = saldo final", () => {
    const draft: BankStatementDraft = {
      title: "Extrato setembro",
      confidence: 1,
      openingBalance: -1809.84,
      closingBalance: 990.16,
      totalIncome: 2800,
      totalExpenses: 0,
      lines: [{
        type: "income",
        description: "Salario",
        amount: 2800,
        category: "Salario",
        person: "Casal",
        date: "2026-09-07",
        confidence: 1
      }],
      missingFields: []
    };
    const result = validateBankStatementDraft(draft);
    expect(result.status).toBe("ready");
    expect(result.checks.find((check) => check.code === "balance_reconciliation")?.ok).toBe(true);
  });

  it("pede revisao quando a reconciliacao do extrato nao fecha", () => {
    const draft: BankStatementDraft = {
      title: "Extrato",
      confidence: 0.9,
      openingBalance: 100,
      closingBalance: 400,
      lines: [{
        type: "income",
        description: "Entrada",
        amount: 100,
        category: "Outros",
        person: "Casal",
        date: "2026-09-20",
        confidence: 0.9
      }],
      missingFields: []
    };
    const result = validateBankStatementDraft(draft);
    expect(result.status).toBe("review");
    expect(result.issues.some((issue) => issue.code === "balance_reconciliation_mismatch")).toBe(true);
  });
});
