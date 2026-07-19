import { buildMayaLocalAnalysis } from "@/modules/finance/lib/calculations";
import type { ExpenseDraft, FinanceState, MayaAnalysis } from "@/modules/finance/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

export async function generateMayaAnalysis({
  state,
  question
}: {
  state: FinanceState;
  question?: string;
}): Promise<MayaAnalysis> {
  const localAnalysis = buildMayaLocalAnalysis(state, question);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return localAnalysis;
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
        max_output_tokens: 1000
      })
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
  fileName
}: {
  imageDataUrl: string;
  fileName?: string;
}): Promise<{
  expenseDraft: ExpenseDraft;
  needsReview: true;
  message: string;
}> {
  const fallbackDraft = buildFallbackExpenseDraft(fileName);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      expenseDraft: fallbackDraft,
      needsReview: true,
      message:
        "MAYA preparou um rascunho seguro. Preencha ou revise os dados manualmente antes de confirmar."
    };
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Voce e a MAYA. Leia esta imagem de nota, cupom ou comprovante.",
                  "Extraia uma despesa revisavel para o app Maya.",
                  "Responda apenas JSON valido com: description, amount, category, date, confidence, items.",
                  "Use categoria em portugues apenas quando a imagem sustentar essa classificacao.",
                  "Se faltar data, use a data de hoje.",
                  "Nao invente valores, itens, estabelecimento ou categoria quando nao houver confianca."
                ].join(" ")
              },
              {
                type: "input_image",
                image_url: imageDataUrl
              }
            ]
          }
        ],
        max_output_tokens: 700
      })
    });

    if (!response.ok) {
      return {
        expenseDraft: fallbackDraft,
        needsReview: true,
        message: "Nao consegui ler a nota agora. O rascunho manual continua disponivel."
      };
    }

    const data = (await response.json()) as OpenAIResponse;
    const parsed = parseJsonObject(getOutputText(data));
    const amount = clampNumber(parsed.amount, 0, 9999999, 0);
    const date = typeof parsed.date === "string" ? parsed.date.slice(0, 10) : new Date().toISOString().slice(0, 10);

    return {
      expenseDraft: {
        description: typeof parsed.description === "string" ? parsed.description : fallbackDraft.description,
        amount,
        category: typeof parsed.category === "string" ? parsed.category : fallbackDraft.category,
        date,
        person: "Casal",
        confidence: clampNumber(parsed.confidence, 0, 1, 0.6),
        source: "receipt",
        receiptImageName: fileName,
        items: Array.isArray(parsed.items)
          ? parsed.items
              .map((item) => ({
                name: String((item as { name?: unknown }).name ?? ""),
                amount: Number((item as { amount?: unknown }).amount)
              }))
              .filter((item) => item.name)
          : []
      },
      needsReview: true,
      message: "MAYA leu a nota e criou um rascunho. Revise antes de salvar."
    };
  } catch {
    return {
      expenseDraft: fallbackDraft,
      needsReview: true,
      message: "Nao consegui concluir a leitura da imagem. Voce ainda pode salvar a despesa manualmente."
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

function buildFallbackExpenseDraft(fileName?: string): ExpenseDraft {
  return {
    description: "Comprovante pendente de revisao",
    amount: 0,
    category: "Outros",
    date: new Date().toISOString().slice(0, 10),
    person: "Casal",
    confidence: 0,
    source: "receipt",
    receiptImageName: fileName,
    items: []
  };
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
