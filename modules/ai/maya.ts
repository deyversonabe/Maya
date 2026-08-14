import { buildMayaLocalAnalysis } from "@/modules/finance/lib/calculations";
import { buildMayaFinanceToolAnswer } from "@/modules/finance/lib/maya-finance-tools";
import { expenseCategories, incomeCategories } from "@/modules/finance/data/defaults";
import type {
  BankStatementDraft,
  ExpenseDraft,
  FinanceState,
  FinancialDocumentDraft,
  FinancialDocumentItem,
  FinancialDocumentKind,
  FiscalDocumentMetadata,
  MayaAnalysis,
  PaymentMethod,
  StatementTransactionDraft,
  TimeClockDraft,
  TransactionType
} from "@/modules/finance/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 18_000;
const FISCAL_QR_FETCH_TIMEOUT_MS = 4_000;

export interface TimeClockReadResult {
  timeClockDraft: TimeClockDraft;
  timeClockDrafts?: TimeClockDraft[];
  needsReview: true;
  message: string;
}

interface FiscalQrContext {
  payloads: string[];
  qrCodeContent?: string;
  qrCodeUrl?: string;
  accessKey?: string;
  documentType?: FiscalDocumentMetadata["documentType"];
  issuerCnpj?: string;
  issuerName?: string;
  documentNumber?: string;
  series?: string;
  issueTime?: string;
  documentDate?: string;
  amount?: number;
  paidAmount?: number;
  totalItemsAmount?: number;
  pageText?: string;
}

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
  documentKind = "expense",
  qrPayloads = []
}: {
  imageDataUrl: string;
  fileName?: string;
  documentKind?: FinancialDocumentKind;
  qrPayloads?: string[];
}): Promise<{
  financialDraft: FinancialDocumentDraft;
  expenseDraft: ExpenseDraft;
  needsReview: true;
  message: string;
}> {
  const fallbackDraft = buildFallbackFinancialDraft(fileName, documentKind, imageDataUrl);
  const qrContext = await buildFiscalQrContext(qrPayloads);
  const qrFallbackDraft = mergeQrContextIntoDraft(fallbackDraft, qrContext);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      financialDraft: qrFallbackDraft,
      expenseDraft: buildExpenseDraftFromFinancialDraft(qrFallbackDraft),
      needsReview: true,
      message:
        "MAYA preparou um rascunho seguro. Preencha ou revise os dados manualmente antes de confirmar."
    };
  }

  try {
    const qrContextText = buildFiscalQrPrompt(qrContext);
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
                  "A imagem pode ser nota, DANFE NF-e, DANFE NFC-e, cupom fiscal, boleto, Pix copia e cola, fatura, recibo, comprovante de renda ou conta a pagar.",
                  qrContextText
                    ? `Dados extraidos previamente do QR Code fiscal, use apenas se ajudarem a confirmar o documento: ${qrContextText}`
                    : "",
                  "Faca OCR minucioso antes de responder: leia cabecalho, emissor, CNPJ/CPF, datas, vencimento, favorecido, pagador, forma de pagamento, valor final, descontos, itens e linhas legiveis.",
                  "Antes de classificar o documento, procure por palavras-chave brasileiras como VALOR TOTAL, VALOR PAGO, TOTAL DA NOTA, VENCIMENTO, DATA DE EMISSAO, EMITENTE, DESTINATARIO, FAVORECIDO, CHAVE DE ACESSO, LINHA DIGITAVEL, COPIA E COLA e PIX.",
                  "Responda apenas JSON valido com: kind, title, description, amount, category, documentDate, dueDate, entryDate, paymentMethod, paymentCode, paymentRecipient, confidence, missingFields, items, fiscalDocument, notes.",
                  "kind deve ser expense, income ou bill.",
                  "paymentMethod deve ser cash, boleto, pix, card ou other quando existir.",
                  "Quando paymentMethod for pix e houver destinatario/remetente legivel, preencha paymentRecipient.",
                  "Se for DANFE, NF-e, NFC-e ou cupom fiscal, trate como documento fiscal brasileiro e extraia fiscalDocument com documentType, accessKey, issuerName, issuerCnpj, documentNumber, series, issueTime, protocolNumber, totalItemsAmount, discountAmount, taxAmount e paidAmount quando legiveis.",
                  "documentType deve ser danfe_nfe, danfe_nfce, cupom_fiscal, boleto, pix, recibo, extrato ou unknown.",
                  "accessKey deve ter somente os 44 digitos da chave de acesso quando estiver legivel; nunca invente chave de acesso nem leia conteudo interno de QR Code se ele nao estiver textual.",
                  "Para DANFE/NF-e/NFC-e, amount deve ser o Valor Total da Nota ou Valor Pago quando esse for o total final; nao use impostos, desconto, troco, subtotal, base de calculo ou valor unitario como total.",
                  "Quando a nota tiver total de produtos e total pago diferentes, use o valor efetivamente pago como amount e preserve o total de produtos em fiscalDocument.totalItemsAmount.",
                  "Para boleto ou fatura, amount deve ser valor do documento/valor a pagar, dueDate deve ser vencimento e paymentCode deve ser linha digitavel/codigo de barras textual quando legivel.",
                  "Para comprovante Pix, amount deve ser valor transferido, documentDate deve ser data do comprovante e paymentRecipient deve ser recebedor/favorecido quando legivel.",
                  "title deve ser o emissor/estabelecimento quando legivel. description deve resumir o documento sem inventar: exemplo 'Nota fiscal de mercado' ou 'Conta de energia'.",
                  "items deve listar ate 60 itens ou linhas legiveis com name, amount, quantity, unit, unitPrice, code, ean, ncm, date, type, category, paymentMethod e paymentRecipient quando legiveis.",
                  "Em extrato bancario, use type income para entrada e expense para saida quando a propria linha sustentar essa classificacao.",
                  "Use datas no formato YYYY-MM-DD.",
                  "Para conta a pagar, dueDate e a data de vencimento. Para renda, entryDate e a data de entrada.",
                  "Use categoria em portugues apenas quando a imagem sustentar essa classificacao.",
                  "Preserve centavos e valores exatos. Nunca arredonde valor. Se o documento mostrar R$ 1.234,56, devolva 1234.56.",
                  "Nao invente titulo, descricao, valor, datas, codigo, estabelecimento ou categoria quando nao houver confianca.",
                  "Se um campo nao estiver legivel, use string vazia e inclua o nome dele em missingFields."
                ].filter(Boolean).join(" ")
              },
              {
                type: "input_image",
                detail: "high",
                image_url: imageDataUrl
              }
            ]
          }
        ],
        max_output_tokens: 3200,
        store: false,
        text: { format: { type: "json_object" } }
    });

    if (!response.ok) {
      const error = await parseOpenAIError(response);
      logReceiptReadFailure(error, documentKind);

      return {
        financialDraft: qrFallbackDraft,
        expenseDraft: buildExpenseDraftFromFinancialDraft(qrFallbackDraft),
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
        financialDraft: qrFallbackDraft,
        expenseDraft: buildExpenseDraftFromFinancialDraft(qrFallbackDraft),
        needsReview: true,
        message: "MAYA nao encontrou dados confiaveis no anexo. Preencha manualmente antes de salvar."
      };
    }

    const financialDraft = normalizeFinancialDraft(mergeQrContextIntoParsed(parsed, qrContext), qrFallbackDraft, documentKind);

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
      financialDraft: qrFallbackDraft,
      expenseDraft: buildExpenseDraftFromFinancialDraft(qrFallbackDraft),
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
                  "Faca OCR minucioso linha por linha, preservando descricao, valor exato com centavos, data e sinal de entrada/saida.",
                  "Separe somente linhas financeiras reais em entradas e saidas.",
                  "Ignore saldo anterior, saldo final, limite, cabecalhos, totais, subtotais, tarifas demonstrativas sem transacao, mensagens promocionais e linhas ilegiveis.",
                  "Nunca invente valor, data, pessoa, banco, descricao ou categoria.",
                  "Valores devem ser positivos. Se o extrato mostrar -35,90, devolva amount 35.90 e type expense. Use type income para credito/entrada e expense para debito/saida.",
                  "Use datas no formato YYYY-MM-DD. Se a data nao existir ou estiver ilegivel, nao inclua a linha.",
                  `Categorias de renda permitidas: ${incomeCategories.join(", ")}.`,
                  `Categorias de despesa permitidas: ${expenseCategories.join(", ")}.`,
                  "Quando nao houver categoria confiavel, use Outros.",
                  "Quando a linha for Pix, use paymentMethod pix e preencha paymentRecipient com o nome legivel da pessoa/empresa quando existir.",
                  "Se uma linha tiver descricao quebrada em mais de uma linha visual, una a descricao antes de devolver.",
                  "Se o extrato usar D/C, credito/debito, entrada/saida, verde/vermelho ou sinais +/-, use isso para classificar type.",
                  "Ignore linhas de saldo inicial, saldo anterior, saldo disponivel, saldo atual, saldo final, limite, total de creditos e total de debitos mesmo que tenham valor.",
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
        max_output_tokens: 2600,
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

export async function readTimeClockWithMaya({
  imageDataUrl,
  fileName,
  targetDate
}: {
  imageDataUrl: string;
  fileName?: string;
  targetDate?: string;
}): Promise<TimeClockReadResult> {
  const fallbackDraft = buildFallbackTimeClockDraft(targetDate);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      timeClockDraft: fallbackDraft,
      needsReview: true,
      message: "MAYA preparou o rascunho do ponto, mas a leitura automatica precisa da chave de IA no servidor."
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
                  "Voce e a MAYA. Leia esta imagem de registro de ponto ou espelho de ponto brasileiro.",
                  "O objetivo e preencher um rascunho revisavel de horas trabalhadas, nao criar lancamento financeiro.",
                  targetDate ? `Data alvo selecionada pelo usuario: ${targetDate}. Se essa data aparecer no documento, use somente os horarios dessa data.` : "Se houver varias datas, escolha a data mais legivel e mais completa.",
                  "Ignore cabecalho, nome da empresa, CNPJ, matricula, assinatura, totais legais, banco de horas antigo, observacoes administrativas, linhas de escala e qualquer texto que nao seja data/horario do dia.",
                  "Em comprovante individual de REP/relógio de ponto, procure principalmente os rotulos DATA ou TA e HORA. Exemplo comum: DATA: 03/08/2026 HORA: 18:13.",
                  "Quando a imagem tiver apenas uma batida, retorne essa batida em punches e preencha somente o campo mais provavel entre firstIn, firstOut, secondIn ou secondOut. Nao use o mesmo horario como entrada e saida.",
                  "Procure horarios reais de batida do ponto: entrada, inicio do intervalo, fim do intervalo e saida.",
                  "Mapeie as quatro batidas como firstIn, firstOut, secondIn e secondOut quando for possivel.",
                  "Se houver quatro batidas no dia, use startTime como a primeira batida, endTime como a ultima batida e lunchMinutes como a diferenca entre segunda e terceira batida.",
                  "Se houver duas batidas no dia, use primeira e ultima batida, e deixe lunchMinutes como 72 apenas se o documento nao mostrar intervalo; inclua lunchMinutes em missingFields.",
                  "Se houver mais de quatro batidas, use a primeira e a ultima como jornada total e use as batidas intermediarias mais provaveis para intervalo; explique em notes.",
                  "Use formato de data YYYY-MM-DD e horarios HH:mm em 24 horas.",
                  "Preserve os horarios exatos. Nunca arredonde minutos.",
                  "Nao invente data ou horario. Se nao enxergar com confianca, deixe vazio e inclua o campo em missingFields.",
                  "expectedMinutes deve ser 528 para dia util comum quando a data for segunda a sexta, 0 para sabado/domingo, salvo se o documento mostrar carga esperada diferente.",
                  "Responda apenas JSON valido com: date, firstIn, firstOut, secondIn, secondOut, startTime, endTime, lunchMinutes, expectedMinutes, confidence, missingFields, punches, notes.",
                  "punches deve listar todos os horarios de batida usados ou relevantes no formato HH:mm."
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
        max_output_tokens: 1200,
        store: false,
        text: { format: { type: "json_object" } }
    });

    if (!response.ok) {
      const error = await parseOpenAIError(response);
      logTimeClockReadFailure(error);

      return {
        timeClockDraft: fallbackDraft,
        needsReview: true,
        message: buildReceiptFailureMessage(error)
      };
    }

    const data = (await response.json()) as OpenAIResponse;
    const parsed = parseJsonObject(getOutputText(data));
    const parsedEntries = Array.isArray(parsed.entries) ? parsed.entries : Array.isArray(parsed.dias) ? parsed.dias : [];
    const timeClockDrafts = parsedEntries
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => normalizeTimeClockDraft(entry, buildFallbackTimeClockDraft(toDateString(entry.date ?? entry.data) || targetDate)))
      .filter((draft) => draft.date && draft.punches.length > 0);
    const timeClockDraft = timeClockDrafts[0] ?? normalizeTimeClockDraft(parsed, fallbackDraft);

    return {
      timeClockDraft,
      timeClockDrafts: timeClockDrafts.length > 1 ? timeClockDrafts : undefined,
      needsReview: true,
      message:
        timeClockDrafts.length > 1
          ? `MAYA encontrou ${timeClockDrafts.length} dia(s) no relatorio. Revise os registros importados.`
          : timeClockDraft.startTime && timeClockDraft.endTime
          ? "MAYA leu o ponto e preencheu o rascunho. Revise os horarios antes de salvar."
          : "MAYA nao encontrou horarios suficientes no ponto. Complete manualmente antes de salvar."
    };
  } catch (error) {
    const failure = normalizeCaughtFailure(error);
    logTimeClockReadFailure(failure);

    return {
      timeClockDraft: fallbackDraft,
      needsReview: true,
      message: buildReceiptFailureMessage(failure)
    };
  }
}

export function readTimeClockReportText({
  text,
  fileName,
  targetDate
}: {
  text: string;
  fileName?: string;
  targetDate?: string;
}): TimeClockReadResult {
  const fallbackDraft = buildFallbackTimeClockDraft(targetDate);
  const timeClockDrafts = parseTimeClockReportText(text, fileName);

  if (timeClockDrafts.length === 0) {
    return {
      timeClockDraft: fallbackDraft,
      needsReview: true,
      message: "MAYA nao encontrou linhas de ponto confiaveis no PDF. Envie uma imagem mais nitida ou preencha manualmente."
    };
  }

  return {
    timeClockDraft: timeClockDrafts[0],
    timeClockDrafts,
    needsReview: true,
    message: `MAYA importou ${timeClockDrafts.length} dia(s) do relatorio de ponto. Todos ficam editaveis no calendario.`
  };
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

function logTimeClockReadFailure(error: OpenAIFailure) {
  console.warn("maya_timecard_read_failed", {
    category: error.category,
    status: error.status,
    code: error.code,
    requestId: error.requestId,
    message: error.message
  });
}

function sanitizeLogText(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 180);
}

async function buildFiscalQrContext(rawPayloads: string[]): Promise<FiscalQrContext> {
  const payloads = normalizeQrPayloads(rawPayloads);
  const context: FiscalQrContext = { payloads };

  for (const payload of payloads) {
    const partial = parseFiscalQrPayload(payload);
    mergeFiscalQrContext(context, partial);
  }

  if (context.qrCodeUrl) {
    const pageText = await fetchFiscalQrPageText(context.qrCodeUrl);
    if (pageText) {
      mergeFiscalQrContext(context, parseFiscalQrPageText(pageText));
      context.pageText = pageText.slice(0, 2200);
    }
  }

  return context;
}

function normalizeQrPayloads(payloads: string[]) {
  return Array.from(
    new Set(
      payloads
        .map((payload) => toCleanString(payload))
        .filter(Boolean)
        .map((payload) => payload.slice(0, 1200))
    )
  ).slice(0, 3);
}

function parseFiscalQrPayload(payload: string): FiscalQrContext {
  const url = parseUrl(payload);
  const text = decodeURIComponentSafe(payload);
  const accessKey = extractAccessKey(text);
  const qrCodeUrl = url?.toString();
  const pParam = url?.searchParams.get("p") ?? url?.searchParams.get("chNFe") ?? url?.searchParams.get("chave");
  const pParts = pParam ? pParam.split("|").map((part) => part.trim()) : [];
  const keyFromParam = extractAccessKey(pParam ?? "");
  const key = keyFromParam || accessKey;
  const keyMetadata = parseAccessKeyMetadata(key);
  const amount = parseNfceQrAmount(pParts);
  const documentDate = parseNfceQrDate(pParts);

  return {
    payloads: [payload],
    qrCodeContent: payload,
    qrCodeUrl,
    accessKey: key,
    documentType: keyMetadata.documentType || inferFiscalDocumentType(text),
    issuerCnpj: keyMetadata.issuerCnpj,
    documentNumber: keyMetadata.documentNumber,
    series: keyMetadata.series,
    documentDate,
    amount,
    paidAmount: amount,
    totalItemsAmount: amount
  };
}

async function fetchFiscalQrPageText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FISCAL_QR_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
        "user-agent": "MayaFinance/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    return htmlToReadableText(html);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseFiscalQrPageText(pageText: string): FiscalQrContext {
  const text = pageText.replace(/\s+/g, " ").trim();
  const issuerCnpj = normalizeCnpj(text.match(/CNPJ[:\s]*([0-9./-]{14,18})/i)?.[1]);
  const issuerName =
    toCleanString(text.match(/(?:Emitente|Estabelecimento|Razao Social)[:\s]+([^|]{3,90}?)(?: CNPJ| Endereco|$)/i)?.[1]) ||
    toCleanString(text.match(/NFC-e\s+([^|]{3,90}?)(?: CNPJ|$)/i)?.[1]);
  const amount = parseFiscalAmountFromText(text);
  const documentDate = toDateString(
    text.match(/(?:Emissao|Data de emissao|Data)[:\s]*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ||
      text.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/)?.[1]
  );
  const issueTime = normalizeTimeString(text.match(/(\d{2}:\d{2}(?::\d{2})?)/)?.[1]);

  return {
    payloads: [],
    issuerCnpj,
    issuerName,
    amount,
    paidAmount: amount,
    totalItemsAmount: amount,
    documentDate,
    issueTime
  };
}

function mergeQrContextIntoParsed(parsed: Record<string, unknown>, context: FiscalQrContext) {
  if (!hasFiscalQrContext(context)) {
    return parsed;
  }

  const fiscalSource = getObjectRecord(parsed.fiscalDocument) ?? {};
  const notes = [toCleanString(parsed.notes), buildFiscalQrNotes(context)].filter(Boolean).join("\n");

  return {
    ...parsed,
    title: parsed.title || context.issuerName,
    amount: firstDefined(parsed.amount, context.amount),
    totalAmount: firstDefined(parsed.totalAmount, context.amount),
    valorTotal: firstDefined(parsed.valorTotal, context.amount),
    documentDate: parsed.documentDate || context.documentDate,
    issueDate: parsed.issueDate || context.documentDate,
    paymentCode: parsed.paymentCode || context.qrCodeUrl || context.qrCodeContent,
    fiscalDocument: {
      documentType: context.documentType,
      accessKey: context.accessKey,
      qrCodeContent: context.qrCodeContent,
      qrCodeUrl: context.qrCodeUrl,
      issuerName: context.issuerName,
      issuerCnpj: context.issuerCnpj,
      documentNumber: context.documentNumber,
      series: context.series,
      issueTime: context.issueTime,
      paidAmount: context.paidAmount,
      totalItemsAmount: context.totalItemsAmount,
      ...fiscalSource
    },
    notes
  };
}

function mergeQrContextIntoDraft(draft: FinancialDocumentDraft, context: FiscalQrContext): FinancialDocumentDraft {
  if (!hasFiscalQrContext(context)) {
    return draft;
  }

  const parsedDraft = normalizeFinancialDraft(mergeQrContextIntoParsed({}, context), draft, draft.kind);

  return {
    ...draft,
    ...parsedDraft,
    attachmentImageName: draft.attachmentImageName,
    attachmentDataUrl: draft.attachmentDataUrl,
    attachmentStoragePath: draft.attachmentStoragePath,
    attachmentMimeType: draft.attachmentMimeType,
    attachmentSize: draft.attachmentSize,
    missingFields: parsedDraft.missingFields,
    notes: buildFinancialDocumentNotes(parsedDraft.notes ?? "", parsedDraft.fiscalDocument, draft.notes)
  };
}

function buildFiscalQrPrompt(context: FiscalQrContext) {
  if (!hasFiscalQrContext(context)) {
    return "";
  }

  return [
    context.qrCodeUrl ? `URL do QR: ${context.qrCodeUrl}` : "",
    context.accessKey ? `chave de acesso: ${context.accessKey}` : "",
    context.issuerCnpj ? `CNPJ emitente: ${context.issuerCnpj}` : "",
    context.issuerName ? `emissor: ${context.issuerName}` : "",
    context.documentNumber ? `numero: ${context.documentNumber}` : "",
    context.series ? `serie: ${context.series}` : "",
    context.documentDate ? `data: ${context.documentDate}` : "",
    Number.isFinite(context.amount) ? `valor: ${context.amount}` : "",
    context.pageText ? `texto parcial da pagina fiscal: ${context.pageText}` : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function buildFiscalQrNotes(context: FiscalQrContext) {
  const lines = [
    context.qrCodeUrl ? `QR fiscal: ${context.qrCodeUrl}.` : "",
    context.qrCodeContent && !context.qrCodeUrl ? `Conteudo do QR fiscal: ${context.qrCodeContent}.` : ""
  ];

  return lines.filter(Boolean).join("\n");
}

function hasFiscalQrContext(context: FiscalQrContext) {
  return Boolean(
    context.qrCodeContent ||
      context.qrCodeUrl ||
      context.accessKey ||
      context.issuerCnpj ||
      context.issuerName ||
      context.documentNumber ||
      context.amount ||
      context.documentDate
  );
}

function mergeFiscalQrContext(target: FiscalQrContext, source: FiscalQrContext) {
  target.qrCodeContent ||= source.qrCodeContent;
  target.qrCodeUrl ||= source.qrCodeUrl;
  target.accessKey ||= source.accessKey;
  target.documentType ||= source.documentType;
  target.issuerCnpj ||= source.issuerCnpj;
  target.issuerName ||= source.issuerName;
  target.documentNumber ||= source.documentNumber;
  target.series ||= source.series;
  target.issueTime ||= source.issueTime;
  target.documentDate ||= source.documentDate;
  target.amount ||= source.amount;
  target.paidAmount ||= source.paidAmount;
  target.totalItemsAmount ||= source.totalItemsAmount;
}

function parseAccessKeyMetadata(accessKey?: string) {
  if (!accessKey || accessKey.length !== 44) {
    return {};
  }

  const model = accessKey.slice(20, 22);

  return {
    documentType: model === "65" ? "danfe_nfce" : model === "55" ? "danfe_nfe" : undefined,
    issuerCnpj: normalizeCnpj(accessKey.slice(6, 20)),
    series: accessKey.slice(22, 25).replace(/^0+/, "") || accessKey.slice(22, 25),
    documentNumber: accessKey.slice(25, 34).replace(/^0+/, "") || accessKey.slice(25, 34)
  } satisfies Partial<FiscalQrContext>;
}

function parseNfceQrAmount(parts: string[]) {
  for (const part of parts.slice(3, 8)) {
    const value = parseNumber(part.replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value < 999999) {
      return value;
    }
  }

  return undefined;
}

function parseNfceQrDate(parts: string[]) {
  for (const part of parts) {
    const date = toDateString(part);
    if (date) {
      return date;
    }
  }

  return "";
}

function parseFiscalAmountFromText(text: string) {
  const match =
    text.match(/(?:Valor\s+total|Valor\s+pago|Total\s+da\s+nota|Total)[:\sR$]*([0-9.]+,\d{2})/i) ??
    text.match(/R\$\s*([0-9.]+,\d{2})/i);

  return match ? parseNumber(match[1]) : undefined;
}

function inferFiscalDocumentType(text: string): FiscalDocumentMetadata["documentType"] | undefined {
  const normalized = text.toLowerCase();

  if (normalized.includes("nfce") || normalized.includes("nfc-e")) {
    return "danfe_nfce";
  }

  if (normalized.includes("nfe") || normalized.includes("nf-e")) {
    return "danfe_nfe";
  }

  return normalized.includes("cupom") ? "cupom_fiscal" : undefined;
}

function extractAccessKey(text: string) {
  return text.match(/\b\d{44}\b/)?.[0] ?? "";
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function htmlToReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstDefined<T>(primary: T | undefined, fallback: T | undefined) {
  return primary !== undefined && primary !== "" ? primary : fallback;
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
  const fiscalDocument = normalizeFiscalDocument(parsed);
  const fiscalSource = getObjectRecord(parsed.fiscalDocument);
  const title = toCleanString(
    parsed.title ??
      parsed.issuerName ??
      parsed.issuer ??
      parsed.emitente ??
      parsed.nomeEmitente ??
      parsed.merchantName ??
      parsed.establishmentName ??
      parsed.nomeEstabelecimento ??
      parsed.beneficiaryName ??
      parsed.beneficiario ??
      parsed.favorecido ??
      parsed.recebedor
  );
  const description = toCleanString(
    parsed.description ??
      parsed.descricao ??
      parsed.documentDescription ??
      parsed.details ??
      parsed.detalhes ??
      parsed.historic ??
      parsed.historico ??
      parsed.memo
  );
  const amount = clampNumber(
    parsed.amount ??
      parsed.totalAmount ??
      parsed.valorTotal ??
      parsed.total ??
      parsed.valorDocumento ??
      parsed.valorAPagar ??
      parsed.valorCobranca ??
      parsed.valorPago ??
      parsed.totalPago ??
      parsed.valorLiquido ??
      parsed.valorFinal ??
      parsed.valorTransferido ??
      parsed.value,
    0,
    9999999,
    fiscalDocument?.paidAmount ?? fiscalDocument?.totalItemsAmount ?? 0
  );
  const documentDate =
    toDateString(parsed.documentDate) ||
    toDateString(parsed.issueDate) ||
    toDateString(parsed.emissionDate) ||
    toDateString(parsed.dataEmissao) ||
    toDateString(parsed.date);
  const dueDate =
    toDateString(parsed.dueDate) ||
    toDateString(parsed.vencimento) ||
    toDateString(parsed.due) ||
    (kind === "bill" ? documentDate : "");
  const entryDate =
    toDateString(parsed.entryDate) ||
    toDateString(parsed.paymentDate) ||
    toDateString(parsed.dataPagamento) ||
    (kind === "income" ? documentDate : "");
  const category = toCleanString(parsed.category) || fallback.category;
  const paymentMethod = normalizePaymentMethod(parsed.paymentMethod, fallback.paymentMethod);
  const paymentCode = toCleanString(
    parsed.paymentCode ??
      parsed.linhaDigitavel ??
      parsed.codigoDigitavel ??
      parsed.barcode ??
      parsed.codigoBarras ??
      parsed.pixCopiaCola ??
      parsed.codigoPix ??
      parsed.brcode ??
      parsed.brCode
  );
  const missingFields = new Set<string>(
    Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String) : []
  );
  const items = normalizeItems(
    parsed.items ??
      parsed.itens ??
      parsed.products ??
      parsed.produtos ??
      parsed.documentItems ??
      fiscalSource?.items ??
      fiscalSource?.itens ??
      fiscalSource?.products ??
      fiscalSource?.produtos
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
    paymentRecipient: toCleanString(
      parsed.paymentRecipient ??
        parsed.recipient ??
        parsed.receiver ??
        parsed.destinatario ??
        parsed.recebedor ??
        parsed.beneficiary ??
        parsed.beneficiario ??
        parsed.favorecido ??
        parsed.issuerName ??
        parsed.emitente ??
        parsed.merchantName ??
        parsed.establishmentName
    ),
    otherCategoryDescription: category === "Outros" ? toCleanString(parsed.otherCategoryDescription) : undefined,
    confidence: clampNumber(parsed.confidence, 0, 1, fallback.confidence),
    missingFields: Array.from(missingFields),
    items,
    fiscalDocument,
    notes: buildFinancialDocumentNotes(toCleanString(parsed.notes), fiscalDocument, fallback.notes)
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
    items: draft.items,
    fiscalDocument: draft.fiscalDocument
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
  const rawLines = parsed.lines ?? parsed.linhas ?? parsed.transactions ?? parsed.transacoes ?? parsed.items;
  const lines = Array.isArray(rawLines)
    ? rawLines
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

function buildFallbackTimeClockDraft(targetDate?: string): TimeClockDraft {
  const date = toDateString(targetDate) || "";

  return {
    date,
    firstIn: "",
    firstOut: "",
    secondIn: "",
    secondOut: "",
    startTime: "",
    endTime: "",
    lunchMinutes: 72,
    expectedMinutes: date ? getDefaultExpectedMinutesForDate(date) : 528,
    confidence: 0,
    missingFields: ["date", "firstIn", "firstOut", "secondIn", "secondOut", "startTime", "endTime"],
    punches: [],
    notes: "Ponto pendente de revisao manual."
  };
}

function normalizeTimeClockDraft(parsed: Record<string, unknown>, fallback: TimeClockDraft): TimeClockDraft {
  const date = toDateString(parsed.date ?? parsed.data ?? parsed.workDate ?? parsed.referenceDate) || fallback.date;
  const rawPunches = parsed.punches ?? parsed.batidas ?? parsed.times ?? parsed.horarios;
  const punches = normalizeClockPunches(rawPunches);
  const inferredFields = inferTimeClockFieldsFromPunches(punches);
  const firstIn =
    normalizeClockTime(parsed.firstIn ?? parsed.entrada1 ?? parsed.primeiraEntrada) ||
    inferredFields.firstIn ||
    fallback.firstIn ||
    "";
  const firstOut =
    normalizeClockTime(parsed.firstOut ?? parsed.saidaAlmoco ?? parsed.inicioIntervalo ?? parsed.intervalStart) ||
    inferredFields.firstOut ||
    fallback.firstOut ||
    "";
  const secondIn =
    normalizeClockTime(parsed.secondIn ?? parsed.retornoAlmoco ?? parsed.fimIntervalo ?? parsed.intervalEnd) ||
    inferredFields.secondIn ||
    fallback.secondIn ||
    "";
  const secondOut =
    normalizeClockTime(parsed.secondOut ?? parsed.saidaFinal ?? parsed.endTime ?? parsed.saida) ||
    inferredFields.secondOut ||
    fallback.secondOut ||
    "";
  const startTime =
    (firstIn && secondOut ? firstIn : "") ||
    (punches.length >= 2 ? punches[0] : "") ||
    normalizeClockTime(parsed.startTime ?? parsed.entrada ?? parsed.firstPunch ?? parsed.inicio) ||
    fallback.startTime;
  const endTime =
    (firstIn && secondOut ? secondOut : "") ||
    (punches.length >= 2 ? punches[punches.length - 1] : "") ||
    normalizeClockTime(parsed.endTime ?? parsed.saida ?? parsed.lastPunch ?? parsed.fim) ||
    fallback.endTime;
  const secondPunch = firstOut ? timeToMinutes(firstOut) : Number.NaN;
  const thirdPunch = secondIn ? timeToMinutes(secondIn) : Number.NaN;
  const lunchFromPunches =
    Number.isFinite(secondPunch) && Number.isFinite(thirdPunch) && thirdPunch > secondPunch
      ? thirdPunch - secondPunch
      : Number.NaN;
  const lunchMinutes = clampNumber(
    parsed.lunchMinutes ?? parsed.intervalMinutes ?? parsed.almocoMinutos ?? parsed.intervaloMinutos,
    0,
    240,
    Number.isFinite(lunchFromPunches) ? lunchFromPunches : fallback.lunchMinutes
  );
  const expectedMinutes = clampNumber(
    parsed.expectedMinutes ?? parsed.cargaEsperadaMinutos ?? parsed.jornadaEsperadaMinutos,
    0,
    720,
    date ? getDefaultExpectedMinutesForDate(date) : fallback.expectedMinutes ?? 528
  );
  const missingFields = new Set<string>(
    Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String) : fallback.missingFields
  );

  if (date) {
    missingFields.delete("date");
  } else {
    missingFields.add("date");
  }

  if (startTime) {
    missingFields.delete("startTime");
  } else {
    missingFields.add("startTime");
  }

  if (endTime) {
    missingFields.delete("endTime");
  } else {
    missingFields.add("endTime");
  }

  ([
    ["firstIn", firstIn],
    ["firstOut", firstOut],
    ["secondIn", secondIn],
    ["secondOut", secondOut]
  ] as const).forEach(([field, value]) => {
    if (value) {
      missingFields.delete(field);
    } else {
      missingFields.add(field);
    }
  });

  if (!Number.isFinite(lunchFromPunches) && (!firstOut || !secondIn)) {
    missingFields.add("lunchMinutes");
  } else {
    missingFields.delete("lunchMinutes");
  }

  return {
    date,
    firstIn,
    firstOut,
    secondIn,
    secondOut,
    startTime,
    endTime,
    lunchMinutes: Math.round(lunchMinutes),
    expectedMinutes: Math.round(expectedMinutes),
    confidence: clampNumber(parsed.confidence, 0, 1, fallback.confidence),
    missingFields: Array.from(missingFields),
    punches,
    notes: toCleanString(parsed.notes) || fallback.notes
  };
}

function parseTimeClockReportText(text: string, fileName?: string): TimeClockDraft[] {
  const bestByDate = new Map<string, TimeClockDraft>();

  text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .forEach((line) => {
      const dateMatch = line.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);

      if (!dateMatch || dateMatch.index === undefined) {
        return;
      }

      const [, day, month, year] = dateMatch;
      const date = `${year}-${month}-${day}`;
      const timeMatches = Array.from(line.matchAll(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g));
      const reportTimes = normalizeClockPunches(orderReportTimesForDateLine(timeMatches, dateMatch.index));
      const { punches, expectedMinutes } = splitReportPunchesAndExpected(reportTimes, date);

      if (punches.length === 0) {
        return;
      }

      const parsed = buildTimeClockParsedObjectFromReportLine({
        date,
        punches,
        expectedMinutes,
        line,
        fileName
      });
      const draft = normalizeTimeClockDraft(parsed, buildFallbackTimeClockDraft(date));
      const current = bestByDate.get(date);

      if (!current || draft.punches.length > current.punches.length || draft.missingFields.length < current.missingFields.length) {
        bestByDate.set(date, draft);
      }
    });

  return Array.from(bestByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function orderReportTimesForDateLine(timeMatches: RegExpMatchArray[], dateIndex: number) {
  const times = timeMatches.map((match) => match[0]);

  if (timeMatches.length >= 4 && (timeMatches[0].index ?? 0) < dateIndex) {
    const firstPunchMovedToEnd = times[times.length - 1];
    return [firstPunchMovedToEnd, ...times.slice(0, -1)];
  }

  return times;
}

function splitReportPunchesAndExpected(reportTimes: string[], date: string) {
  if (reportTimes.length === 0) {
    return { punches: [] as string[], expectedMinutes: getDefaultExpectedMinutesForDate(date) };
  }

  const times = [...reportTimes];
  let expectedMinutes = getDefaultExpectedMinutesForDate(date);
  const last = times[times.length - 1];
  const secondLast = times[times.length - 2];

  if (times.length >= 2 && isLikelyExpectedDuration(secondLast) && isLikelyMissingDuration(last)) {
    expectedMinutes = timeToMinutes(secondLast);
    times.splice(-2, 2);
  } else if (times.length >= 3 && isLikelyExpectedDuration(last)) {
    expectedMinutes = timeToMinutes(last);
    times.splice(-1, 1);
  }

  if (times.length === 2 && isLikelyExpectedDuration(times[0]) && isLikelyExpectedDuration(times[1])) {
    return { punches: [] as string[], expectedMinutes };
  }

  return { punches: times.slice(0, 4), expectedMinutes };
}

function buildTimeClockParsedObjectFromReportLine({
  date,
  punches,
  expectedMinutes,
  line,
  fileName
}: {
  date: string;
  punches: string[];
  expectedMinutes: number;
  line: string;
  fileName?: string;
}) {
  const missingFields: string[] = [];
  const fields = {
    firstIn: "",
    firstOut: "",
    secondIn: "",
    secondOut: ""
  };

  if (punches.length >= 4) {
    fields.firstIn = punches[0];
    fields.firstOut = punches[1];
    fields.secondIn = punches[2];
    fields.secondOut = punches[3];
  } else if (punches.length === 3) {
    fields.firstIn = punches[0];
    fields.firstOut = punches[1];
    fields.secondIn = punches[2];
    missingFields.push("secondOut");
  } else if (punches.length === 2) {
    fields.firstIn = punches[0];
    fields.secondOut = punches[1];
    missingFields.push("firstOut", "secondIn", "lunchMinutes");
  } else if (punches.length === 1) {
    fields.firstIn = punches[0];
    missingFields.push("firstOut", "secondIn", "secondOut", "endTime", "lunchMinutes");
  }

  const lunchMinutes =
    fields.firstOut && fields.secondIn && timeToMinutes(fields.secondIn) > timeToMinutes(fields.firstOut)
      ? timeToMinutes(fields.secondIn) - timeToMinutes(fields.firstOut)
      : 72;
  const notes = [
    fileName ? `Importado do relatorio ${fileName}.` : "Importado de relatorio de ponto.",
    `Linha lida: ${line}.`,
    missingFields.length ? "Registro incompleto: revise os campos vazios." : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    date,
    ...fields,
    startTime: fields.firstIn,
    endTime: fields.secondOut || punches[punches.length - 1] || "",
    lunchMinutes,
    expectedMinutes,
    confidence: missingFields.length ? 0.74 : 0.94,
    missingFields,
    punches,
    notes
  };
}

function isLikelyExpectedDuration(value: string | undefined) {
  if (!value) {
    return false;
  }

  const minutes = timeToMinutes(value);
  return minutes >= 420 && minutes <= 600;
}

function isLikelyMissingDuration(value: string | undefined) {
  if (!value) {
    return false;
  }

  const minutes = timeToMinutes(value);
  return minutes >= 0 && minutes <= 420;
}

function inferTimeClockFieldsFromPunches(punches: string[]) {
  const fields = {
    firstIn: "",
    firstOut: "",
    secondIn: "",
    secondOut: ""
  };

  if (punches.length >= 4) {
    const sorted = [...punches].sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
    return {
      firstIn: sorted[0],
      firstOut: sorted[1],
      secondIn: sorted[2],
      secondOut: sorted[3]
    };
  }

  punches.forEach((punch) => {
    const minutes = timeToMinutes(punch);

    if (minutes <= timeToMinutes("10:30")) {
      fields.firstIn = punch;
    } else if (minutes <= timeToMinutes("13:00")) {
      fields.firstOut = punch;
    } else if (minutes <= timeToMinutes("16:30")) {
      fields.secondIn = punch;
    } else {
      fields.secondOut = punch;
    }
  });

  return fields;
}

function normalizeStatementLine(value: unknown): StatementTransactionDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const line = value as Record<string, unknown>;
  const amountSource = line.amount ?? line.value ?? line.valor ?? line.valorTransacao ?? line.valorLancamento;
  const type = normalizeStatementLineType(line, amountSource);
  const description = toCleanString(
    line.description ??
      line.descricao ??
      line.historic ??
      line.history ??
      line.historico ??
      line.memo ??
      line.name ??
      line.titulo
  );
  const amount = positiveAmount(amountSource);
  const date = toDateString(line.date ?? line.transactionDate ?? line.data ?? line.dataTransacao);

  if (!type || !description || amount <= 0 || !date) {
    return null;
  }

  const category = normalizeStatementCategory(type, line.category);
  const paymentMethod = normalizePaymentMethod(line.paymentMethod ?? line.method ?? line.formaPagamento ?? line.meioPagamento, undefined);
  const paymentRecipient = toCleanString(
    line.paymentRecipient ??
      line.recipient ??
      line.receiver ??
      line.destinatario ??
      line.recebedor ??
      line.favorecido ??
      line.counterparty ??
      line.contraparte
  );

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

function normalizeStatementLineType(
  line: Record<string, unknown>,
  amountSource: unknown
): Extract<TransactionType, "income" | "expense"> | null {
  if (line.type === "income" || line.type === "expense") {
    return line.type;
  }

  const directionText = toCleanString(
    line.type ??
      line.direction ??
      line.nature ??
      line.natureza ??
      line.signal ??
      line.sinal ??
      line.dc ??
      line.debitCredit ??
      line.tipo
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    directionText.includes("income") ||
    directionText.includes("entrada") ||
    directionText.includes("credito") ||
    directionText === "c" ||
    directionText === "cr" ||
    directionText.includes("credit")
  ) {
    return "income";
  }

  if (
    directionText.includes("expense") ||
    directionText.includes("saida") ||
    directionText.includes("debito") ||
    directionText === "d" ||
    directionText === "db" ||
    directionText.includes("debit")
  ) {
    return "expense";
  }

  const numericAmount = parseNumber(amountSource);

  if (Number.isFinite(numericAmount) && numericAmount < 0) {
    return "expense";
  }

  return null;
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

function normalizeFiscalDocument(parsed: Record<string, unknown>): FiscalDocumentMetadata | undefined {
  const fiscalSource = getObjectRecord(parsed.fiscalDocument) ?? parsed;
  const documentType = normalizeFiscalDocumentType(
    fiscalSource.documentType ?? fiscalSource.fiscalDocumentType ?? fiscalSource.type
  );
  const accessKey = normalizeFixedDigits(
    fiscalSource.accessKey ?? fiscalSource.chaveAcesso ?? fiscalSource.chaveDeAcesso,
    44
  );
  const qrCodeContent = toCleanString(fiscalSource.qrCodeContent ?? fiscalSource.qrPayload ?? fiscalSource.qrCode);
  const qrCodeUrl = toCleanString(fiscalSource.qrCodeUrl ?? fiscalSource.qrUrl ?? fiscalSource.urlQrCode);
  const issuerName = toCleanString(
    fiscalSource.issuerName ??
      fiscalSource.emitente ??
      fiscalSource.nomeEmitente ??
      fiscalSource.merchantName ??
      fiscalSource.establishmentName
  );
  const issuerCnpj = normalizeCnpj(
    fiscalSource.issuerCnpj ??
      fiscalSource.cnpjEmitente ??
      fiscalSource.emitenteCnpj ??
      fiscalSource.cnpj ??
      fiscalSource.merchantCnpj
  );
  const documentNumber = normalizeLooseId(
    fiscalSource.documentNumber ?? fiscalSource.nfNumber ?? fiscalSource.numeroNota ?? fiscalSource.numeroNf ?? fiscalSource.number ?? fiscalSource.numero
  );
  const series = normalizeLooseId(fiscalSource.series ?? fiscalSource.serie);
  const issueTime = normalizeTimeString(fiscalSource.issueTime ?? fiscalSource.horaEmissao ?? fiscalSource.time ?? fiscalSource.hora);
  const protocolNumber = normalizeLooseId(fiscalSource.protocolNumber ?? fiscalSource.protocolo);
  const totalItemsAmount = optionalAmount(
    fiscalSource.totalItemsAmount ?? fiscalSource.itemsTotal ?? fiscalSource.valorTotalProdutos ?? fiscalSource.totalProdutos
  );
  const discountAmount = optionalAmount(fiscalSource.discountAmount ?? fiscalSource.discount ?? fiscalSource.desconto);
  const taxAmount = optionalAmount(fiscalSource.taxAmount ?? fiscalSource.taxes ?? fiscalSource.valorTributos ?? fiscalSource.tributos);
  const paidAmount = optionalAmount(
    fiscalSource.paidAmount ??
      fiscalSource.valorPago ??
      fiscalSource.valorTotalNota ??
      fiscalSource.totalNota ??
      fiscalSource.valorTotal ??
      fiscalSource.totalAmount ??
      fiscalSource.amount
  );

  const fiscalDocument = {
    documentType,
    accessKey,
    qrCodeContent,
    qrCodeUrl,
    issuerName,
    issuerCnpj,
    documentNumber,
    series,
    issueTime,
    protocolNumber,
    totalItemsAmount,
    discountAmount,
    taxAmount,
    paidAmount
  };

  const hasFiscalData = Object.values(fiscalDocument).some((value) => value !== undefined && value !== "");

  return hasFiscalData ? fiscalDocument : undefined;
}

function normalizeFiscalDocumentType(value: unknown): FiscalDocumentMetadata["documentType"] | undefined {
  const text = toCleanString(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (!text) {
    return undefined;
  }

  if (text.includes("nfce") || text.includes("nfc-e") || text.includes("danfe nfce")) {
    return "danfe_nfce";
  }

  if (text.includes("nfe") || text.includes("nf-e") || text.includes("danfe")) {
    return "danfe_nfe";
  }

  if (text.includes("cupom")) {
    return "cupom_fiscal";
  }

  if (text.includes("boleto")) {
    return "boleto";
  }

  if (text.includes("pix")) {
    return "pix";
  }

  if (text.includes("recibo")) {
    return "recibo";
  }

  if (text.includes("extrato")) {
    return "extrato";
  }

  return text === "unknown" ? "unknown" : undefined;
}

function buildFinancialDocumentNotes(
  aiNotes: string,
  fiscalDocument: FiscalDocumentMetadata | undefined,
  fallbackNotes?: string
) {
  const fiscalLines = buildFiscalDocumentSummary(fiscalDocument);
  const notes = [aiNotes, ...fiscalLines].filter(Boolean).join("\n");

  return notes || fallbackNotes;
}

function buildFiscalDocumentSummary(fiscalDocument?: FiscalDocumentMetadata) {
  if (!fiscalDocument) {
    return [];
  }

  const lines = ["Dados fiscais lidos pela MAYA:"];
  const documentTypeLabels: Record<NonNullable<FiscalDocumentMetadata["documentType"]>, string> = {
    danfe_nfe: "DANFE NF-e",
    danfe_nfce: "DANFE NFC-e",
    cupom_fiscal: "Cupom fiscal",
    boleto: "Boleto",
    pix: "Pix",
    recibo: "Recibo",
    extrato: "Extrato",
    unknown: "Documento nao identificado"
  };

  if (fiscalDocument.documentType) {
    lines.push(`Tipo: ${documentTypeLabels[fiscalDocument.documentType]}.`);
  }

  if (fiscalDocument.issuerName) {
    lines.push(`Emissor: ${fiscalDocument.issuerName}.`);
  }

  if (fiscalDocument.issuerCnpj) {
    lines.push(`CNPJ: ${fiscalDocument.issuerCnpj}.`);
  }

  if (fiscalDocument.documentNumber) {
    lines.push(`Numero: ${fiscalDocument.documentNumber}.`);
  }

  if (fiscalDocument.series) {
    lines.push(`Serie: ${fiscalDocument.series}.`);
  }

  if (fiscalDocument.accessKey) {
    lines.push(`Chave de acesso: ${fiscalDocument.accessKey}.`);
  }

  if (fiscalDocument.qrCodeUrl) {
    lines.push(`QR fiscal: ${fiscalDocument.qrCodeUrl}.`);
  }

  if (fiscalDocument.protocolNumber) {
    lines.push(`Protocolo: ${fiscalDocument.protocolNumber}.`);
  }

  return lines;
}

function normalizePaymentMethod(value: unknown, fallback?: PaymentMethod): PaymentMethod | undefined {
  if (value === "cash" || value === "boleto" || value === "pix" || value === "card" || value === "other") {
    return value;
  }

  const text = toCleanString(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (text.includes("dinheiro") || text.includes("especie") || text.includes("cash")) {
    return "cash";
  }

  if (text.includes("pix")) {
    return "pix";
  }

  if (text.includes("boleto") || text.includes("linha digitavel") || text.includes("codigo de barras")) {
    return "boleto";
  }

  if (text.includes("cartao") || text.includes("card") || text.includes("credito") || text.includes("debito")) {
    return "card";
  }

  if (text) {
    return "other";
  }

  return fallback;
}

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toDateString(value: unknown) {
  const text = toCleanString(value);

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const isoSlash = text.match(/\b(\d{4})\/(\d{2})\/(\d{2})\b/);

  if (isoSlash) {
    return `${isoSlash[1]}-${isoSlash[2]}-${isoSlash[3]}`;
  }

  const brazilian = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})\b/);

  if (!brazilian) {
    return "";
  }

  const day = brazilian[1].padStart(2, "0");
  const month = brazilian[2].padStart(2, "0");
  const year = brazilian[3].length === 2 ? `20${brazilian[3]}` : brazilian[3];
  const date = new Date(`${year}-${month}-${day}T12:00:00`);

  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function normalizeItems(value: unknown): FinancialDocumentItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const source = getObjectRecord(item);

      return {
        name: toCleanString(
          source?.name ??
            source?.nome ??
            source?.productName ??
            source?.produto ??
            source?.itemName ??
            source?.description ??
            source?.descricaoProduto ??
            source?.descricao ??
            source?.xProd
        ),
        amount: optionalAmount(
          source?.amount ??
            source?.total ??
            source?.itemTotal ??
            source?.totalItem ??
            source?.valorTotal ??
            source?.valorItem ??
            source?.valorProduto ??
            source?.vProd ??
            source?.valor
        ),
        quantity: optionalAmount(source?.quantity ?? source?.qty ?? source?.qCom ?? source?.quantidade ?? source?.qtd),
        unit: toCleanString(source?.unit ?? source?.unidade ?? source?.uCom),
        unitPrice: optionalAmount(
          source?.unitPrice ??
            source?.price ??
            source?.precoUnitario ??
            source?.valorUnitario ??
            source?.vUnCom ??
            source?.vUnTrib
        ),
        code: normalizeLooseId(source?.code ?? source?.productCode ?? source?.cProd ?? source?.codigo ?? source?.codigoProduto),
        ean: normalizeLooseId(source?.ean ?? source?.barcode ?? source?.cEAN ?? source?.codigoDeBarras ?? source?.gtin),
        ncm: normalizeLooseId(source?.ncm ?? source?.NCM),
        date: toDateString(source?.date ?? source?.data),
        type: normalizeTransactionType(source?.type),
        category: toCleanString(source?.category),
        paymentMethod: normalizePaymentMethod(source?.paymentMethod ?? source?.formaPagamento, undefined),
        paymentRecipient: toCleanString(source?.paymentRecipient ?? source?.destinatario ?? source?.recebedor)
      };
    })
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name,
      amount: item.amount,
      quantity: item.quantity,
      unit: item.unit || undefined,
      unitPrice: item.unitPrice,
      code: item.code || undefined,
      ean: item.ean || undefined,
      ncm: item.ncm || undefined,
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
  const number = parseNumber(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

function optionalAmount(value: unknown) {
  const number = parseNumber(value);

  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function positiveAmount(value: unknown) {
  const number = parseNumber(value);

  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const text = value.trim().replace(/[^\d,.-]/g, "");

  if (!text) {
    return Number.NaN;
  }

  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(text)
      ? text.replace(/\./g, "")
      : text;

  return Number(normalized);
}

function getObjectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeFixedDigits(value: unknown, length: number) {
  const digits = normalizeLooseId(value);

  return digits.length === length ? digits : "";
}

function normalizeCnpj(value: unknown) {
  const digits = normalizeLooseId(value);

  return digits.length === 14 ? digits : "";
}

function normalizeLooseId(value: unknown) {
  return toCleanString(value).replace(/\D/g, "");
}

function normalizeTimeString(value: unknown) {
  const text = toCleanString(value);
  const match = text.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);

  return match?.[0] ?? "";
}

function normalizeClockPunches(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeClockTime(item)).filter(Boolean).slice(0, 12);
}

function normalizeClockTime(value: unknown) {
  const raw = normalizeTimeString(value);

  if (!raw) {
    return "";
  }

  const [hours = "0", minutes = "0"] = raw.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return Number.NaN;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDefaultExpectedMinutesForDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);

  if (!Number.isFinite(parsed.getTime())) {
    return 528;
  }

  const weekday = parsed.getDay();
  return weekday >= 1 && weekday <= 5 ? 528 : 0;
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
