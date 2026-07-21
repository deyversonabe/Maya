import { buildMayaLocalAnalysis } from "@/modules/finance/lib/calculations";
import { buildMayaFinanceToolAnswer } from "@/modules/finance/lib/maya-finance-tools";
import { expenseCategories, incomeCategories } from "@/modules/finance/data/defaults";
import type {
  BankStatementDraft,
  ExpenseDraft,
  FinanceState,
  FinancialDocumentDraft,
  FinancialDocumentKind,
  MayaAnalysis,
  PaymentMethod,
  StatementTransactionDraft,
  TransactionType
} from "@/modules/finance/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 7_500;

export async function generateMayaAnalysis({
  state,
  question
}: {
  state: FinanceState;
  question?: string;
}): Promise<MayaAnalysis> {
  const localAnalysis = buildMayaLocalAnalysis(state, question);
  const toolAnalysis = buildMayaFinanceToolAnswer(state, question);
  const apiKey = process.env.OPENAI_API_KEY;

  if (toolAnalysis) {
    return toolAnalysis;
  }

  if (!apiKey) {
    return localAnalysis;
  }

  try {
    const response = await fetchOpenAIResponse(apiKey, {
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Voce e a MAYA, assistente financeira premium do casal no app Maya.",
                  "Fale em portugues do Brasil, com clareza, acolhimento e precisao.",
                  "Nunca julgue. Nunca assuste. Mostre leitura minuciosa, comparacao mensal, saude financeira e proximos passos.",
                  "Nao invente dados, valores, categorias, historico ou conclusoes que nao estejam no estado financeiro enviado.",
                  "Se nao houver dados reais suficientes, declare dados insuficientes e oriente o primeiro cadastro.",
                  "Nao prometa rentabilidade nem substitua consultoria financeira profissional.",
                  "Quando o usuario perguntar sobre juros, emprestimos, financiamento ou renegociacao, oriente de forma educativa com base no contexto brasileiro.",
                  "Use como base conceitual CET, Banco Central, CDC, Lei do Superendividamento, Procon-SP e Consumidor.gov.br, sem inventar artigos, taxas oficiais ou normas especificas.",
                  "Peca contrato, CET, taxa mensal/anual, IOF, tarifas, valor liberado, parcelas, vencimentos e demonstrativo da divida antes de concluir.",
                  "Nao se apresente como advogada, correspondente bancaria ou consultora certificada. Em cobranca abusiva ou conflito juridico, recomende canais oficiais ou profissional habilitado.",
                  "Responda em JSON valido com: message, healthScore, trend, highlights, nextActions."
                ].join(" ")
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  question,
                  state,
                  localAnalysis
                })
              }
            ]
          }
        ],
        max_output_tokens: 1000,
        store: false,
        text: { format: { type: "json_object" } }
    });

    if (!response.ok) {
      return localAnalysis;
    }

    const data = (await response.json()) as OpenAIResponse;
    const text = getOutputText(data);
    const parsed = parseJsonObject(text);

    return {
      assistantName: "MAYA",
      message: typeof parsed.message === "string" ? parsed.message : localAnalysis.message,
      healthScore: clampNumber(parsed.healthScore, 0, 100, localAnalysis.healthScore),
      trend: isTrend(parsed.trend) ? parsed.trend : localAnalysis.trend,
      highlights: toStringArray(parsed.highlights, localAnalysis.highlights),
      nextActions: toStringArray(parsed.nextActions, localAnalysis.nextActions)
    };
  } catch {
    return localAnalysis;
  }
}

export async function readReceiptWithMaya({
  imageDataUrl,
  fileName,
  documentKind = "expense"
}: {
  imageDataUrl: string;
  fileName?: string;
  documentKind?: FinancialDocumentKind;
}): Promise<{
  financialDraft: FinancialDocumentDraft;
  expenseDraft: ExpenseDraft;
  needsReview: true;
  message: string;
}> {
  const fallbackDraft = buildFallbackFinancialDraft(fileName, documentKind, imageDataUrl);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      financialDraft: fallbackDraft,
      expenseDraft: buildExpenseDraftFromFinancialDraft(fallbackDraft),
      needsReview: true,
      message:
        "MAYA preparou um rascunho seguro. Preencha ou revise os dados manualmente antes de confirmar."
    };
  }

  try {
    const response = await fetchOpenAIResponse(apiKey, {
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || DEFAULT_VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Voce e a MAYA. Leia esta imagem financeira com cuidado.",
                  "O usuario quer um rascunho revisavel para o app Maya.",
                  `Tipo solicitado: ${documentKind}.`,
                  "A imagem pode ser nota, boleto, Pix copia e cola, fatura, recibo, comprovante de renda ou conta a pagar.",
                  "Responda apenas JSON valido com: kind, title, description, amount, category, documentDate, dueDate, entryDate, paymentMethod, paymentCode, paymentRecipient, confidence, missingFields, items, notes.",
                  "kind deve ser expense, income ou bill.",
                  "paymentMethod deve ser boleto, pix, card ou other quando existir.",
                  "Quando paymentMethod for pix e houver destinatario/remetente legivel, preencha paymentRecipient.",
                  "items deve listar itens de nota ou linhas de extrato com name, amount, date, type e category quando legiveis.",
                  "Em extrato bancario, use type income para entrada e expense para saida quando a propria linha sustentar essa classificacao.",
                  "Use datas no formato YYYY-MM-DD.",
                  "Para conta a pagar, dueDate e a data de vencimento. Para renda, entryDate e a data de entrada.",
                  "Use categoria em portugues apenas quando a imagem sustentar essa classificacao.",
                  "Nao invente titulo, descricao, valor, datas, codigo, estabelecimento ou categoria quando nao houver confianca.",
                  "Se um campo nao estiver legivel, use string vazia e inclua o nome dele em missingFields."
                ].join(" ")
              },
              {
                type: "input_image",
                detail: "high",
                image_url: imageDataUrl
              }
            ]
          }
        ],
        max_output_tokens: 900,
        store: false,
        text: { format: { type: "json_object" } }
    });

    if (!response.ok) {
      const error = await parseOpenAIError(response);
      logReceiptReadFailure(error, documentKind);

      return {
        financialDraft: fallbackDraft,
        expenseDraft: buildExpenseDraftFromFinancialDraft(fallbackDraft),
        needsReview: true,
        message: buildReceiptFailureMessage(error)
      };
    }

    const data = (await response.json()) as OpenAIResponse;
    const parsed = parseJsonObject(getOutputText(data));

    if (Object.keys(parsed).length === 0) {
      logReceiptReadFailure(
        {
          category: "invalid_output",
          status: 200,
          code: "empty_or_invalid_json"
        },
        documentKind
      );

      return {
        financialDraft: fallbackDraft,
        expenseDraft: buildExpenseDraftFromFinancialDraft(fallbackDraft),
        needsReview: true,
        message: "MAYA nao encontrou dados confiaveis no anexo. Preencha manualmente antes de salvar."
      };
    }

    const financialDraft = normalizeFinancialDraft(parsed, fallbackDraft, documentKind);

    return {
      financialDraft,
      expenseDraft: buildExpenseDraftFromFinancialDraft(financialDraft),
      needsReview: true,
      message: "MAYA leu o anexo e criou um rascunho. Revise antes de salvar."
    };
  } catch (error) {
    const failure = normalizeCaughtFailure(error);
    logReceiptReadFailure(failure, documentKind);

    return {
      financialDraft: fallbackDraft,
      expenseDraft: buildExpenseDraftFromFinancialDraft(fallbackDraft),
      needsReview: true,
      message: buildReceiptFailureMessage(failure)
    };
  }
}

export async function readBankStatementWithMaya({
  imageDataUrl,
  fileName
}: {
  imageDataUrl: string;
  fileName?: string;
}): Promise<{
  statementDraft: BankStatementDraft;
  needsReview: true;
  message: string;
}> {
  const fallbackDraft = buildFallbackBankStatementDraft(fileName, imageDataUrl);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      statementDraft: fallbackDraft,
      needsReview: true,
      message:
        "MAYA preparou a revisao do extrato, mas a leitura automatica precisa da chave de IA no servidor."
    };
  }

  try {
    const response = await fetchOpenAIResponse(apiKey, {
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || DEFAULT_VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Voce e a MAYA, assistente financeira do app.",
                  "Leia esta imagem de extrato bancario ou lista de transacoes.",
                  "Separe somente linhas financeiras reais em entradas e saidas.",
                  "Ignore saldo anterior, saldo final, limite, cabecalhos, totais, subtotais, tarifas demonstrativas sem transacao, mensagens promocionais e linhas ilegiveis.",
                  "Nunca invente valor, data, pessoa, banco, descricao ou categoria.",
                  "Valores devem ser positivos. Use type income para credito/entrada e expense para debito/saida.",
                  "Use datas no formato YYYY-MM-DD. Se a data nao existir ou estiver ilegivel, nao inclua a linha.",
                  `Categorias de renda permitidas: ${incomeCategories.join(", ")}.`,
                  `Categorias de despesa permitidas: ${expenseCategories.join(", ")}.`,
                  "Quando nao houver categoria confiavel, use Outros.",
                  "Quando a linha for Pix, use paymentMethod pix e preencha paymentRecipient com o nome legivel da pessoa/empresa quando existir.",
                  "Responda apenas JSON valido com: title, periodStart, periodEnd, confidence, missingFields, lines, notes.",
                  "lines deve ser array com: type, description, amount, category, date, paymentMethod, paymentRecipient, confidence, notes."
                ].join(" ")
              },
              {
                type: "input_image",
                detail: "high",
                image_url: imageDataUrl
              }
            ]
          }
        ],
        max_output_tokens: 1400,
        store: false,
        text: { format: { type: "json_object" } }
    });

    if (!response.ok) {
      const error = await parseOpenAIError(response);
      logReceiptReadFailure(error, "statement");

      return {
        statementDraft: fallbackDraft,
        needsReview: true,
        message: buildReceiptFailureMessage(error)
      };
    }

    const data = (await response.json()) as OpenAIResponse;
    const parsed = parseJsonObject(getOutputText(data));
    const statementDraft = normalizeBankStatementDraft(parsed, fallbackDraft);

    return {
      statementDraft,
      needsReview: true,
      message:
        statementDraft.lines.length > 0
          ? "MAYA leu o extrato e separou entradas e saidas. Revise antes de importar."
          : "MAYA nao encontrou linhas confiaveis no extrato. Tente uma imagem mais nitida ou importe manualmente."
    };
  } catch (error) {
    const failure = normalizeCaughtFailure(error);
    logReceiptReadFailure(failure, "statement");

    return {
      statementDraft: fallbackDraft,
      needsReview: true,
      message: buildReceiptFailureMessage(failure)
    };
  }
}

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}

type OpenAIFailureCategory =
  | "auth"
  | "quota"
  | "model"
  | "image"
  | "timeout"
  | "temporary"
  | "invalid_output"
  | "unknown";

interface OpenAIFailure {
  category: OpenAIFailureCategory;
  status?: number;
  code?: string;
  requestId?: string;
  message?: string;
}

async function fetchOpenAIResponse(apiKey: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    return await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseOpenAIError(response: Response): Promise<OpenAIFailure> {
  const requestId = response.headers.get("x-request-id") ?? response.headers.get("openai-request-id") ?? undefined;
  const body = await response.text();
  const parsed = parseJsonObject(body);
  const error = typeof parsed.error === "object" && parsed.error !== null ? (parsed.error as Record<string, unknown>) : parsed;
  const code = toCleanString(error.code) || toCleanString(error.type) || `http_${response.status}`;
  const message = toCleanString(error.message);

  return {
    category: categorizeOpenAIError(response.status, code, message),
    status: response.status,
    code,
    requestId,
    message: sanitizeLogText(message)
  };
}

function normalizeCaughtFailure(error: unknown): OpenAIFailure {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { category: "timeout", code: "request_timeout" };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return { category: "timeout", code: "request_timeout" };
  }

  return {
    category: "temporary",
    code: error instanceof Error ? sanitizeLogText(error.name || "request_failed") : "request_failed",
    message: error instanceof Error ? sanitizeLogText(error.message) : undefined
  };
}

function categorizeOpenAIError(status: number, code: string, message: string): OpenAIFailureCategory {
  const text = `${code} ${message}`.toLowerCase();

  if (status === 401 || status === 403 || text.includes("api key") || text.includes("auth")) {
    return "auth";
  }

  if (status === 429 || text.includes("quota") || text.includes("rate limit") || text.includes("billing")) {
    return "quota";
  }

  if (text.includes("model") || text.includes("unsupported") || text.includes("does not exist")) {
    return "model";
  }

  if (text.includes("image") || text.includes("base64") || text.includes("file size") || text.includes("mime")) {
    return "image";
  }

  if (status >= 500) {
    return "temporary";
  }

  return "unknown";
}

function buildReceiptFailureMessage(error: OpenAIFailure) {
  switch (error.category) {
    case "auth":
      return "A leitura automatica nao esta autorizada no servidor. O rascunho manual continua disponivel.";
    case "quota":
      return "A leitura automatica atingiu o limite de uso agora. Revise manualmente ou tente novamente mais tarde.";
    case "model":
      return "A leitura automatica precisa de ajuste na configuracao do servidor. O rascunho manual continua disponivel.";
    case "image":
      return "A imagem nao foi aceita para leitura. Tente outra foto em JPG/PNG, com boa luz, ou preencha manualmente.";
    case "timeout":
      return "A leitura demorou mais que o esperado. Tente novamente com uma foto mais nitida ou preencha manualmente.";
    case "invalid_output":
      return "MAYA nao encontrou dados confiaveis no anexo. Preencha manualmente antes de salvar.";
    case "temporary":
    case "unknown":
    default:
      return "Nao consegui ler o anexo agora. O rascunho manual continua disponivel.";
  }
}

function logReceiptReadFailure(error: OpenAIFailure, documentKind: FinancialDocumentKind) {
  console.warn("maya_receipt_read_failed", {
    category: error.category,
    status: error.status,
    code: error.code,
    requestId: error.requestId,
    documentKind,
    message: error.message
  });
}

function sanitizeLogText(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 180);
}

function buildFallbackFinancialDraft(
  fileName: string | undefined,
  kind: FinancialDocumentKind,
  imageDataUrl?: string
): FinancialDocumentDraft {
  return {
    kind,
    title: "",
    description: "",
    amount: 0,
    category: "Outros",
    documentDate: "",
    dueDate: kind === "bill" ? "" : undefined,
    entryDate: kind === "income" ? "" : undefined,
    person: "Casal",
    paymentMethod: kind === "bill" ? "boleto" : undefined,
    paymentCode: "",
    confidence: 0,
    source: kind === "bill" ? "attachment" : "receipt",
    attachmentImageName: fileName,
    attachmentDataUrl: imageDataUrl,
    missingFields:
      kind === "bill"
        ? ["title", "amount", "dueDate"]
        : kind === "income"
          ? ["description", "amount", "entryDate"]
          : ["description", "amount", "documentDate"],
    items: [],
    notes: fileName ? `Anexo pendente de revisao: ${fileName}` : ""
  };
}

function normalizeFinancialDraft(
  parsed: Record<string, unknown>,
  fallback: FinancialDocumentDraft,
  requestedKind: FinancialDocumentKind
): FinancialDocumentDraft {
  const kind = normalizeKind(parsed.kind, requestedKind);
  const title = toCleanString(parsed.title);
  const description = toCleanString(parsed.description);
  const amount = clampNumber(parsed.amount, 0, 9999999, 0);
  const documentDate = toDateString(parsed.documentDate) || toDateString(parsed.date);
  const dueDate = toDateString(parsed.dueDate) || (kind === "bill" ? documentDate : "");
  const entryDate = toDateString(parsed.entryDate) || (kind === "income" ? documentDate : "");
  const category = toCleanString(parsed.category) || fallback.category;
  const paymentMethod = normalizePaymentMethod(parsed.paymentMethod, fallback.paymentMethod);
  const paymentCode = toCleanString(parsed.paymentCode);
  const missingFields = new Set<string>(
    Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String) : []
  );

  if (kind === "bill" && !title) {
    missingFields.add("title");
  }

  if (!description && kind !== "bill") {
    missingFields.add("description");
  }

  if (amount <= 0) {
    missingFields.add("amount");
  }

  if (kind === "bill" && !dueDate) {
    missingFields.add("dueDate");
  }

  if (kind === "income" && !entryDate) {
    missingFields.add("entryDate");
  }

  if (kind === "expense" && !documentDate) {
    missingFields.add("documentDate");
  }

  return {
    ...fallback,
    kind,
    title,
    description,
    amount,
    category,
    documentDate,
    dueDate: dueDate || undefined,
    entryDate: entryDate || undefined,
    paymentMethod,
    paymentCode,
    paymentRecipient: toCleanString(parsed.paymentRecipient),
    otherCategoryDescription: category === "Outros" ? toCleanString(parsed.otherCategoryDescription) : undefined,
    confidence: clampNumber(parsed.confidence, 0, 1, fallback.confidence),
    missingFields: Array.from(missingFields),
    items: normalizeItems(parsed.items),
    notes: toCleanString(parsed.notes) || fallback.notes
  };
}

function buildExpenseDraftFromFinancialDraft(draft: FinancialDocumentDraft): ExpenseDraft {
  return {
    description: draft.description || draft.title,
    amount: draft.amount,
    category: draft.category,
    date: draft.documentDate || draft.dueDate || draft.entryDate || "",
    person: draft.person,
    confidence: draft.confidence,
    source: "receipt",
    receiptImageName: draft.attachmentImageName,
    paymentMethod: draft.paymentMethod,
    paymentRecipient: draft.paymentRecipient,
    otherCategoryDescription: draft.otherCategoryDescription,
    items: draft.items
  };
}

function buildFallbackBankStatementDraft(fileName: string | undefined, imageDataUrl?: string): BankStatementDraft {
  return {
    title: "",
    periodStart: "",
    periodEnd: "",
    confidence: 0,
    attachmentImageName: fileName,
    attachmentDataUrl: imageDataUrl,
    lines: [],
    missingFields: ["lines"],
    notes: fileName ? `Extrato pendente de revisao: ${fileName}` : ""
  };
}

function normalizeBankStatementDraft(
  parsed: Record<string, unknown>,
  fallback: BankStatementDraft
): BankStatementDraft {
  const lines = Array.isArray(parsed.lines)
    ? parsed.lines
        .map((line) => normalizeStatementLine(line))
        .filter((line): line is StatementTransactionDraft => Boolean(line))
    : [];
  const missingFields = new Set<string>(
    Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String) : []
  );

  if (lines.length === 0) {
    missingFields.add("lines");
  }

  return {
    ...fallback,
    title: toCleanString(parsed.title) || fallback.title,
    periodStart: toDateString(parsed.periodStart) || fallback.periodStart,
    periodEnd: toDateString(parsed.periodEnd) || fallback.periodEnd,
    confidence: clampNumber(parsed.confidence, 0, 1, fallback.confidence),
    lines,
    missingFields: Array.from(missingFields),
    notes: toCleanString(parsed.notes) || fallback.notes
  };
}

function normalizeStatementLine(value: unknown): StatementTransactionDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const line = value as Record<string, unknown>;
  const type = line.type === "income" ? "income" : line.type === "expense" ? "expense" : null;
  const description = toCleanString(line.description);
  const amount = clampNumber(line.amount, 0, 9999999, 0);
  const date = toDateString(line.date);

  if (!type || !description || amount <= 0 || !date) {
    return null;
  }

  const category = normalizeStatementCategory(type, line.category);
  const paymentMethod = normalizePaymentMethod(line.paymentMethod, undefined);
  const paymentRecipient = toCleanString(line.paymentRecipient);

  return {
    type,
    description,
    amount,
    category,
    person: "Casal",
    date,
    paymentMethod,
    paymentRecipient: paymentMethod === "pix" ? paymentRecipient : paymentRecipient || undefined,
    otherCategoryDescription:
      category === "Outros" ? toCleanString(line.otherCategoryDescription) || toCleanString(line.notes) : undefined,
    confidence: clampNumber(line.confidence, 0, 1, 0.65),
    notes: toCleanString(line.notes) || undefined
  };
}

function normalizeStatementCategory(type: Extract<TransactionType, "income" | "expense">, value: unknown) {
  const category = toCleanString(value);
  const allowed = type === "income" ? incomeCategories : expenseCategories;

  return allowed.includes(category) ? category : "Outros";
}

function getOutputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ?? "{}"
  );
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }

    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function normalizeKind(value: unknown, fallback: FinancialDocumentKind): FinancialDocumentKind {
  return value === "expense" || value === "income" || value === "bill" || value === "statement" ? value : fallback;
}

function normalizePaymentMethod(value: unknown, fallback?: PaymentMethod): PaymentMethod | undefined {
  if (value === "boleto" || value === "pix" || value === "card" || value === "other") {
    return value;
  }

  return fallback;
}

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toDateString(value: unknown) {
  const text = toCleanString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }

  return text;
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      name: String((item as { name?: unknown }).name ?? "").trim(),
      amount: Number((item as { amount?: unknown }).amount),
      date: toDateString((item as { date?: unknown }).date),
      type: normalizeTransactionType((item as { type?: unknown }).type),
      category: toCleanString((item as { category?: unknown }).category),
      paymentMethod: normalizePaymentMethod((item as { paymentMethod?: unknown }).paymentMethod, undefined),
      paymentRecipient: toCleanString((item as { paymentRecipient?: unknown }).paymentRecipient)
    }))
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name,
      amount: Number.isFinite(item.amount) ? item.amount : undefined,
      date: item.date || undefined,
      type: item.type,
      category: item.category || undefined,
      paymentMethod: item.paymentMethod,
      paymentRecipient: item.paymentRecipient || undefined
    }));
}

function normalizeTransactionType(value: unknown): TransactionType | undefined {
  if (value === "income" || value === "expense" || value === "investment" || value === "transfer") {
    return value;
  }

  return undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value.map(String).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function isTrend(value: unknown): value is MayaAnalysis["trend"] {
  return value === "growth" || value === "drop" || value === "stable";
}
