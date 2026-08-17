import type { FinancialDocumentDraft } from "../types";

export function getReceiptDraftDate(draft: FinancialDocumentDraft) {
  return draft.documentDate || draft.dueDate || draft.entryDate || "";
}

/**
 * Campos que realmente impedem uma nota de virar despesa.
 * missingFields da IA e apenas informativo: campos fiscais opcionais nao podem
 * bloquear o efeito financeiro quando valor/data ja sao confiaveis.
 */
export function getReceiptDraftMissingSaveFields(draft: FinancialDocumentDraft) {
  const missingFields = new Set<string>();
  const date = getReceiptDraftDate(draft);

  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    missingFields.add("valor");
  }

  if (!date) {
    missingFields.add("data da nota");
  }

  if (draft.paymentMethod === "pix" && !draft.paymentRecipient?.trim()) {
    missingFields.add("destinatario do Pix");
  }

  return Array.from(missingFields);
}

export function buildReceiptExpenseDescription(draft: FinancialDocumentDraft) {
  const candidates = [
    draft.description,
    draft.title,
    draft.fiscalDocument?.issuerName ? `Nota fiscal - ${draft.fiscalDocument.issuerName}` : "",
    draft.paymentRecipient ? `Pagamento - ${draft.paymentRecipient}` : "",
    draft.attachmentImageName ? `Nota enviada - ${stripFileExtension(draft.attachmentImageName)}` : ""
  ];

  return candidates.map((candidate) => candidate?.trim()).find(Boolean) ?? "Nota enviada pela MAYA";
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[a-zA-Z0-9]{1,8}$/i, "").replace(/[-_]+/g, " ").trim() || fileName;
}
