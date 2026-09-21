import { readBankStatementWithMaya, readReceiptWithMaya, transcribeAudioWithMaya } from "@/modules/ai/maya";
import { createFinanceCapture } from "@/modules/captures/server";
import { validateBankStatementDraft, validateFinancialDocumentDraft } from "@/modules/captures/validation";
import {
  downloadWhatsAppMedia,
  downloadWhatsAppMediaAsDataUrl,
  fetchWhatsAppMediaMetadata,
  getWhatsAppConfig,
  sendWhatsAppTextMessage,
  WhatsAppClientError
} from "./client";
import type { WhatsAppMessage, WhatsAppProcessingResult, WhatsAppWebhookPayload } from "./types";

export async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload): Promise<WhatsAppProcessingResult> {
  const messages = extractMessages(payload);
  const config = getWhatsAppConfig();
  let repliesSent = 0;
  let processed = 0;

  if (!config) return { received: true, processed: 0, ignored: messages.length, repliesSent };

  for (const message of messages) {
    try {
      const capture = await buildCaptureFromMessage(message, config);
      if (!capture) continue;
      processed += 1;
      repliesSent += (await safeSendTextMessage({ to: message.from, body: buildCaptureReply(capture), config })) ? 1 : 0;
    } catch (error) {
      repliesSent += (await safeSendTextMessage({ to: message.from, body: buildErrorReply(error), config })) ? 1 : 0;
    }
  }

  return { received: true, processed, ignored: Math.max(0, messages.length - processed), repliesSent };
}

async function buildCaptureFromMessage(message: WhatsAppMessage, config: NonNullable<ReturnType<typeof getWhatsAppConfig>>) {
  if (message.type === "text" && message.text?.body?.trim()) {
    const text = message.text.body.trim();
    const result = await readReceiptWithMaya({ documentText: text, fileName: "whatsapp-texto.txt", documentKind: inferDocumentKind(text) });
    const validation = validateFinancialDocumentDraft(result.financialDraft);
    return createFinanceCapture({
      source: "whatsapp",
      sourceRef: message.id,
      sender: message.from,
      kind: "text",
      title: result.financialDraft.title || result.financialDraft.description || "Mensagem do WhatsApp",
      rawText: text,
      draft: { type: "financial_document", value: result.financialDraft },
      validation
    });
  }

  if (message.type === "audio" && message.audio?.id) {
    const metadata = await fetchWhatsAppMediaMetadata(message.audio.id, config);
    const { bytes, contentType } = await downloadWhatsAppMedia(metadata, config);
    const text = await transcribeAudioWithMaya({ bytes, fileName: `${message.audio.id}.${audioExtension(contentType)}`, mimeType: contentType });
    const result = await readReceiptWithMaya({ documentText: text, fileName: "whatsapp-audio.txt", documentKind: inferDocumentKind(text) });
    const validation = validateFinancialDocumentDraft(result.financialDraft);
    return createFinanceCapture({
      source: "whatsapp",
      sourceRef: message.id,
      sender: message.from,
      kind: "audio",
      title: result.financialDraft.title || result.financialDraft.description || "Audio do WhatsApp",
      rawText: text,
      draft: { type: "financial_document", value: result.financialDraft },
      validation,
      attachmentName: `${message.audio.id}.${audioExtension(contentType)}`,
      attachmentMimeType: contentType
    });
  }

  const media = message.type === "image" ? message.image : message.type === "document" ? message.document : undefined;
  if (!media?.id) return null;
  const metadata = await fetchWhatsAppMediaMetadata(media.id, config);
  const downloaded = await downloadWhatsAppMediaAsDataUrl(metadata, config);
  const providedFileName = message.type === "document" ? message.document?.filename : undefined;
  const fileName = providedFileName ? providedFileName : `${media.id}.${fileExtension(downloaded.contentType)}`;
  const caption = message.type === "image" ? message.image?.caption : message.document?.caption;
  const hint = `${caption ?? ""} ${fileName}`.trim();
  const isStatement = /extrato|statement|movimenta|conta corrente/i.test(hint);

  if (isStatement) {
    const result = await readBankStatementWithMaya({
      imageDataUrl: downloaded.contentType.startsWith("image/") ? downloaded.dataUrl : undefined,
      pdfBase64: downloaded.contentType === "application/pdf" ? Buffer.from(downloaded.bytes).toString("base64") : undefined,
      fileName
    });
    const validation = validateBankStatementDraft(result.statementDraft);
    return createFinanceCapture({
      source: "whatsapp",
      sourceRef: message.id,
      sender: message.from,
      kind: "bank_statement",
      title: result.statementDraft.title || "Extrato recebido pelo WhatsApp",
      draft: { type: "bank_statement", value: result.statementDraft },
      validation,
      attachmentName: fileName,
      attachmentMimeType: downloaded.contentType
    });
  }

  const result = await readReceiptWithMaya({
    imageDataUrl: downloaded.contentType.startsWith("image/") ? downloaded.dataUrl : undefined,
    pdfBase64: downloaded.contentType === "application/pdf" ? Buffer.from(downloaded.bytes).toString("base64") : undefined,
    fileName,
    documentKind: inferDocumentKind(hint)
  });
  const validation = validateFinancialDocumentDraft(result.financialDraft);
  return createFinanceCapture({
    source: "whatsapp",
    sourceRef: message.id,
    sender: message.from,
    kind: "financial_document",
    title: result.financialDraft.title || result.financialDraft.description || "Documento recebido pelo WhatsApp",
    draft: { type: "financial_document", value: result.financialDraft },
    validation,
    attachmentName: fileName,
    attachmentMimeType: downloaded.contentType
  });
}

function extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  return payload.entry?.flatMap((entry) => entry.changes ?? []).flatMap((change) => change.value?.messages ?? []).filter((message): message is WhatsAppMessage => Boolean(message.id && message.from)) ?? [];
}

function buildCaptureReply(capture: Awaited<ReturnType<typeof createFinanceCapture>>) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const status = capture.validationStatus === "ready" ? "Pronto para revisar" : capture.validationStatus === "blocked" ? "Precisa de correcao" : "Revisao recomendada";
  const link = appUrl ? `${appUrl}/captures?id=${capture.id}` : "Abra a Caixa de capturas no app.";
  return [
    "MAYA recebeu e organizou seu envio.",
    "",
    `Status: ${status} (${capture.validationScore}/100)`,
    `Rascunho: ${capture.title}`,
    "",
    "Nada foi lancado automaticamente. Confira, edite o que precisar e confirme no app.",
    link
  ].join("\n");
}

function inferDocumentKind(text: string): "expense" | "income" | "bill" {
  const normalized = text.toLowerCase();
  if (/recebi|recebido|salario|entrada|ganhei|cliente pagou/.test(normalized)) return "income";
  if (/vencimento|boleto|conta a pagar|fatura/.test(normalized)) return "bill";
  return "expense";
}

function buildErrorReply(error: unknown) {
  if (error instanceof WhatsAppClientError) return `${error.message} Tente novamente ou use o app.`;
  return "Nao consegui processar esse envio agora. Nada foi lancado. Tente novamente ou use o app.";
}

async function safeSendTextMessage(parameters: Parameters<typeof sendWhatsAppTextMessage>[0]) {
  try { await sendWhatsAppTextMessage(parameters); return true; } catch { return false; }
}

function fileExtension(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function audioExtension(mimeType: string) {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("webm")) return "webm";
  return "ogg";
}
