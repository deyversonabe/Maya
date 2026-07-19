import { findDuplicateTransaction } from "@/modules/finance/lib/duplicates";
import type {
  FinanceState,
  TransactionReview,
  TransactionReviewInput,
  TransactionReviewIssue
} from "@/modules/finance/types";

const TRANSFER_KEYWORDS = ["pix", "ted", "doc", "transferencia"];

function normalize(value: string): string {
  return value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();
}

function looksLikeInternalTransfer(description: string, category: string): boolean {
  const text = normalize(`${description} ${category}`);
  return TRANSFER_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function reviewTransactionEntry({
  candidate,
  state
}: {
  candidate: TransactionReviewInput;
  state: FinanceState;
}): TransactionReview {
  const issues: TransactionReviewIssue[] = [];

if (!candidate.description || !candidate.description.trim()) {
  issues.push({
    level: "warning",
    code: "missing_description",
    message: "A descricao esta vazia. Adicione um detalhe para a MAYA identificar o lancamento corretamente."
  });
}

if (!candidate.amount || candidate.amount <= 0) {
  issues.push({
    level: "warning",
    code: "invalid_amount",
    message: "O valor precisa ser maior que zero para o lancamento ser considerado valido."
  });
}

if (!candidate.person || !candidate.person.trim()) {
  issues.push({
    level: "warning",
    code: "missing_person",
    message: "Selecione quem registrou esse lancamento (cadastro de pessoas do casal)."
  });
}

const duplicate = findDuplicateTransaction(
  {
    type: candidate.type,
    description: candidate.description,
    amount: candidate.amount,
    date: candidate.date
  },
  state.transactions
  );

if (duplicate) {
  issues.push({
    level: duplicate.confidence === "exact" ? "warning" : "info",
    code: "possible_duplicate",
    message:
      duplicate.confidence === "exact"
    ? `Esse lancamento parece repetir um registro existente (${duplicate.transaction.description}, ${formatDate(duplicate.transaction.date)}). A MAYA nao vai salvar duplicado automaticamente.`
      : `Encontrei um lancamento parecido (${duplicate.transaction.description}, ${formatDate(duplicate.transaction.date)}). Confirme se nao e a mesma despesa da nota e do extrato.`
  });
}

let suggestedType: TransactionReview["suggestedType"] = null;

if (
  (candidate.type === "income" || candidate.type === "expense") &&
  looksLikeInternalTransfer(candidate.description, candidate.category)
  ) {
  suggestedType = "transfer";
  issues.push({
    level: "info",
    code: "possible_internal_transfer",
    message:
      "A descricao sugere um Pix ou transferencia entre contas proprias. Transferencias internas nao contam como entrada ou saida real e ficam fora do saldo do mes."
  });
}

const ok = !issues.some((issue) => issue.level === "warning");

return {
  ok,
  issues,
  duplicate,
  suggestedType
};
}

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString("pt-BR");
}
