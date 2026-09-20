import type { BankStatementDraft, FinancialDocumentDraft } from "@/modules/finance/types";
import type { CaptureValidationIssue, CaptureValidationReport } from "./types";

const MONEY_TOLERANCE = 0.02;

export function validateFinancialDocumentDraft(draft: FinancialDocumentDraft): CaptureValidationReport {
  const issues: CaptureValidationIssue[] = [];
  const checks: CaptureValidationReport["checks"] = [];
  const description = (draft.description || draft.title || "").trim();
  const documentDate = draft.documentDate || draft.dueDate || draft.entryDate || "";

  addCheck(checks, "description", "Descricao identificada", Boolean(description));
  if (!description) issues.push(error("missing_description", "description", "Informe uma descricao antes de confirmar."));

  const amountOk = Number.isFinite(draft.amount) && draft.amount > 0;
  addCheck(checks, "amount", "Valor maior que zero", amountOk, amountOk ? formatMoney(draft.amount) : undefined);
  if (!amountOk) issues.push(error("invalid_amount", "amount", "O valor precisa ser maior que zero."));

  const dateOk = isValidDateKey(documentDate);
  addCheck(checks, "date", "Data valida", dateOk, documentDate || "Nao identificada");
  if (!dateOk) issues.push(error("invalid_date", "date", "Informe uma data valida antes de confirmar."));

  const confidence = clamp01(draft.confidence);
  addCheck(checks, "confidence", "Confianca da leitura", confidence >= 0.75, `${Math.round(confidence * 100)}%`);
  if (confidence < 0.55) {
    issues.push(warning("low_confidence", "confidence", "Leitura com baixa confianca. Confira todos os campos."));
  } else if (confidence < 0.75) {
    issues.push(warning("medium_confidence", "confidence", "A leitura precisa de uma conferencia mais cuidadosa."));
  }

  const accessKey = onlyDigits(draft.fiscalDocument?.accessKey);
  if (accessKey) {
    const ok = accessKey.length === 44;
    addCheck(checks, "access_key", "Chave fiscal com 44 digitos", ok, `${accessKey.length} digitos`);
    if (!ok) issues.push(warning("invalid_access_key", "fiscalDocument.accessKey", "A chave fiscal encontrada nao possui 44 digitos."));
  }

  const cnpj = onlyDigits(draft.fiscalDocument?.issuerCnpj);
  if (cnpj) {
    const ok = cnpj.length === 14;
    addCheck(checks, "cnpj", "CNPJ com 14 digitos", ok, `${cnpj.length} digitos`);
    if (!ok) issues.push(warning("invalid_cnpj", "fiscalDocument.issuerCnpj", "O CNPJ encontrado nao possui 14 digitos."));
  }

  const paidAmount = finitePositive(draft.fiscalDocument?.paidAmount);
  if (paidAmount !== undefined && amountOk) {
    const difference = roundMoney(Math.abs(paidAmount - draft.amount));
    const ok = difference <= MONEY_TOLERANCE;
    addCheck(checks, "paid_amount", "Total pago confere com o valor", ok, `Diferenca ${formatMoney(difference)}`);
    if (!ok) issues.push(warning("paid_amount_mismatch", "amount", `O total pago difere do valor principal em ${formatMoney(difference)}.`));
  }

  const itemSum = sumDocumentItems(draft);
  if (itemSum !== undefined && amountOk) {
    const difference = roundMoney(Math.abs(itemSum - draft.amount));
    const ok = difference <= Math.max(MONEY_TOLERANCE, draft.amount * 0.005);
    addCheck(checks, "item_sum", "Soma dos itens confere com o total", ok, `Itens ${formatMoney(itemSum)} · diferenca ${formatMoney(difference)}`);
    if (!ok) issues.push(warning("items_total_mismatch", "items", `A soma dos itens difere do total em ${formatMoney(difference)}.`));
  }

  for (const field of draft.missingFields ?? []) {
    if (["description", "title", "amount", "documentDate", "dueDate", "entryDate"].includes(field)) continue;
    issues.push(warning("missing_field", field, `Campo nao identificado automaticamente: ${field}.`));
  }

  return finishValidation(issues, checks, confidence);
}

export function validateBankStatementDraft(draft: BankStatementDraft): CaptureValidationReport {
  const issues: CaptureValidationIssue[] = [];
  const checks: CaptureValidationReport["checks"] = [];
  const lines = draft.lines ?? [];

  addCheck(checks, "lines", "Extrato possui lancamentos", lines.length > 0, `${lines.length} linha(s)`);
  if (lines.length === 0) issues.push(error("statement_empty", "lines", "Nenhuma linha financeira confiavel foi identificada."));

  let invalidLines = 0;
  let lowConfidenceLines = 0;
  lines.forEach((line, index) => {
    const valid = Boolean(line.description.trim()) && line.amount > 0 && isValidDateKey(line.date);
    if (!valid) {
      invalidLines += 1;
      issues.push(error("invalid_statement_line", `lines.${index}`, `A linha ${index + 1} precisa de descricao, valor e data validos.`));
    }
    if (clamp01(line.confidence) < 0.65) {
      lowConfidenceLines += 1;
      issues.push(warning("low_line_confidence", `lines.${index}`, `Confira a linha ${index + 1}: leitura com baixa confianca.`));
    }
  });
  addCheck(checks, "line_integrity", "Linhas completas", invalidLines === 0, invalidLines ? `${invalidLines} linha(s) invalida(s)` : "Todas completas");
  addCheck(checks, "line_confidence", "Confianca das linhas", lowConfidenceLines === 0, lowConfidenceLines ? `${lowConfidenceLines} linha(s) para revisar` : "Sem alertas");

  const computedIncome = roundMoney(lines.filter((line) => line.type === "income").reduce((sum, line) => sum + line.amount, 0));
  const computedExpenses = roundMoney(lines.filter((line) => line.type === "expense").reduce((sum, line) => sum + line.amount, 0));

  if (finiteNumber(draft.totalIncome) !== undefined) {
    const diff = roundMoney(Math.abs((draft.totalIncome ?? 0) - computedIncome));
    const ok = diff <= MONEY_TOLERANCE;
    addCheck(checks, "income_total", "Total de entradas reconciliado", ok, `Calculado ${formatMoney(computedIncome)}`);
    if (!ok) issues.push(warning("income_total_mismatch", "totalIncome", `Entradas do cabecalho e linhas diferem em ${formatMoney(diff)}.`));
  }

  if (finiteNumber(draft.totalExpenses) !== undefined) {
    const diff = roundMoney(Math.abs((draft.totalExpenses ?? 0) - computedExpenses));
    const ok = diff <= MONEY_TOLERANCE;
    addCheck(checks, "expense_total", "Total de saidas reconciliado", ok, `Calculado ${formatMoney(computedExpenses)}`);
    if (!ok) issues.push(warning("expense_total_mismatch", "totalExpenses", `Saidas do cabecalho e linhas diferem em ${formatMoney(diff)}.`));
  }

  if (finiteNumber(draft.openingBalance) !== undefined && finiteNumber(draft.closingBalance) !== undefined) {
    const expected = roundMoney((draft.openingBalance ?? 0) + computedIncome - computedExpenses);
    const difference = roundMoney((draft.closingBalance ?? 0) - expected);
    const ok = Math.abs(difference) <= MONEY_TOLERANCE;
    addCheck(checks, "balance_reconciliation", "Saldo inicial + entradas - saidas = saldo final", ok, `Diferenca ${formatMoney(difference)}`);
    if (!ok) issues.push(warning("balance_reconciliation_mismatch", "closingBalance", `A reconciliacao do extrato apresenta diferenca de ${formatMoney(difference)}.`));
  } else {
    issues.push({ code: "balance_not_available", level: "info", field: "openingBalance", message: "Saldo inicial/final nao foi identificado; a reconciliacao completa nao pode ser executada." });
  }

  const confidence = clamp01(draft.confidence);
  addCheck(checks, "confidence", "Confianca geral da leitura", confidence >= 0.75, `${Math.round(confidence * 100)}%`);
  if (confidence < 0.55) issues.push(warning("low_confidence", "confidence", "Leitura geral com baixa confianca."));

  return finishValidation(issues, checks, confidence);
}

function finishValidation(
  issues: CaptureValidationIssue[],
  checks: CaptureValidationReport["checks"],
  confidence: number
): CaptureValidationReport {
  const hasError = issues.some((issue) => issue.level === "error");
  const hasWarning = issues.some((issue) => issue.level === "warning");
  const checkRatio = checks.length ? checks.filter((check) => check.ok).length / checks.length : 0;
  const score = Math.max(0, Math.min(100, Math.round(checkRatio * 70 + confidence * 30 - (hasError ? 20 : 0))));
  return {
    status: hasError ? "blocked" : hasWarning ? "review" : "ready",
    score,
    issues,
    checks
  };
}

function error(code: string, field: string, message: string): CaptureValidationIssue {
  return { code, field, message, level: "error" };
}

function warning(code: string, field: string, message: string): CaptureValidationIssue {
  return { code, field, message, level: "warning" };
}

function addCheck(checks: CaptureValidationReport["checks"], code: string, label: string, ok: boolean, detail?: string) {
  checks.push({ code, label, ok, detail });
}

function onlyDigits(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function isValidDateKey(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function finitePositive(value?: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
}

function finiteNumber(value?: number) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function sumDocumentItems(draft: FinancialDocumentDraft) {
  const amounts = (draft.items ?? [])
    .map((item) => {
      if (Number.isFinite(item.amount)) return Number(item.amount);
      if (Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice)) return Number(item.quantity) * Number(item.unitPrice);
      return undefined;
    })
    .filter((value): value is number => value !== undefined && value >= 0);
  return amounts.length ? roundMoney(amounts.reduce((sum, value) => sum + value, 0)) : undefined;
}
