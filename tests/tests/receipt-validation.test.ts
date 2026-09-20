import { describe, expect, it } from "vitest";
import { buildReceiptExpenseDescription, getReceiptDraftMissingSaveFields } from "../modules/finance/lib/receipt-validation";
import type { FinancialDocumentDraft } from "../modules/finance/types";

function draft(overrides: Partial<FinancialDocumentDraft> = {}): FinancialDocumentDraft {
  return {
    kind: "expense",
    title: "",
    description: "",
    amount: 123.45,
    category: "Outros",
    documentDate: "2026-08-16",
    person: "Casal",
    confidence: 0.8,
    missingFields: ["paymentMethod", "items", "issuerName"],
    items: [],
    ...overrides
  };
}

describe("receipt save validation", () => {
  it("does not let AI missingFields block a financially complete expense", () => {
    expect(getReceiptDraftMissingSaveFields(draft())).toEqual([]);
  });

  it("uses a safe fallback description when OCR cannot describe the note", () => {
    expect(buildReceiptExpenseDescription(draft({ fiscalDocument: { documentType: "danfe_nfe", issuerName: "Mercado Teste" } }))).toBe(
      "Nota fiscal - Mercado Teste"
    );
  });

  it("requires a Pix recipient only when paymentMethod is pix", () => {
    expect(getReceiptDraftMissingSaveFields(draft({ paymentMethod: "pix", paymentRecipient: "" }))).toContain("destinatario do Pix");
  });
});
