import { readReceiptWithMaya } from "@/modules/ai/maya";
import { formatCurrency } from "@/lib/utils";
import {
  downloadWhatsAppImageAsDataUrl,
  fetchWhatsAppMediaMetadata,
  getWhatsAppConfig,
  sendWhatsAppTextMessage,
  WhatsAppClientError
} from "./client";
import type { WhatsAppMessage, WhatsAppProcessingResult, WhatsAppWebhookPayload } from "./types";

export async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload): Promise<WhatsAppProcessingResult> {
  const messages = extractMessages(payload);
  const imageMessages = messages.filter((message) => message.type === "image" && message.image?.id);
  const config = getWhatsAppConfig();
  let repliesSent = 0;

  if (!config) {
    return {
      received: true,
      processed: 0,
      ignored: messages.length,
      repliesSent
    };
  }

  for (const message of imageMessages) {
    try {
      const media = await fetchWhatsAppMediaMetadata(message.image!.id, config);
      const imageDataUrl = await downloadWhatsAppImageAsDataUrl(media, config);
      const result = await readReceiptWithMaya({
        imageDataUrl,
        fileName: `${message.image!.id}.${getImageExtension(media.mime_type)}`
      });
      const reply = buildReceiptReply(result.expenseDraft);

      const wasReplySent = await safeSendTextMessage({
        to: message.from,
        body: reply,
        config
      });
      repliesSent += wasReplySent ? 1 : 0;
    } catch (error) {
      const wasReplySent = await safeSendTextMessage({
        to: message.from,
        body: buildErrorReply(error),
        config
      });
      repliesSent += wasReplySent ? 1 : 0;
    }
  }

  const processed = imageMessages.length;

  return {
    received: true,
    processed,
    ignored: messages.length - processed,
    repliesSent
  };
}

function extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  return (
    payload.entry
      ?.flatMap((entry) => entry.changes ?? [])
      .flatMap((change) => change.value?.messages ?? [])
      .filter((message): message is WhatsAppMessage => Boolean(message.id && message.from)) ?? []
  );
}

function buildReceiptReply(draft: {
  description: string;
  amount: number;
  category: string;
  date: string;
  confidence: number;
}) {
  const confidence = Math.round(draft.confidence * 100);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appInstruction = appUrl ? `\n\nAbra o app para revisar: ${appUrl}/expenses` : "\n\nAbra o app e revise em Despesas.";

  return [
    "MAYA recebeu sua nota e preparou um rascunho.",
    "",
    `Descricao: ${draft.description}`,
    `Valor: ${formatCurrency(draft.amount)}`,
    `Categoria: ${draft.category}`,
    `Data: ${draft.date}`,
    `Confianca: ${confidence}%`,
    "",
    "Revise antes de salvar. Nada foi lancado automaticamente.",
    appInstruction
  ].join("\n");
}

function buildErrorReply(error: unknown) {
  if (error instanceof WhatsAppClientError) {
    return `${error.message} Voce pode cadastrar a despesa manualmente no app.`;
  }

  return "Nao consegui ler essa nota agora. Voce pode cadastrar a despesa manualmente no app.";
}

async function safeSendTextMessage(parameters: Parameters<typeof sendWhatsAppTextMessage>[0]) {
  try {
    await sendWhatsAppTextMessage(parameters);
    return true;
  } catch {
    return false;
  }
}

function getImageExtension(mimeType?: string) {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}
