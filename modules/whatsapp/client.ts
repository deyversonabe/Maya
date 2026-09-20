import type { WhatsAppMediaMetadata } from "./types";

const DEFAULT_WHATSAPP_API_VERSION = "v23.0";
const MAX_MEDIA_BYTES = 25_000_000;

type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
};

export class WhatsAppClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppClientError";
  }
}

export function getWhatsAppConfig(): WhatsAppConfig | null {
  if (process.env.WHATSAPP_ENABLED !== "true") return null;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return {
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION || DEFAULT_WHATSAPP_API_VERSION
  };
}

export async function fetchWhatsAppMediaMetadata(mediaId: string, config: WhatsAppConfig) {
  const response = await fetch(`${getGraphBaseUrl(config)}/${mediaId}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) throw new WhatsAppClientError("Nao foi possivel localizar a midia enviada.");
  const metadata = (await response.json()) as Partial<WhatsAppMediaMetadata>;
  if (!metadata.url || !metadata.id) throw new WhatsAppClientError("Midia recebida sem URL valida.");
  return metadata as WhatsAppMediaMetadata;
}

export async function downloadWhatsAppMedia(media: WhatsAppMediaMetadata, config: WhatsAppConfig) {
  const response = await fetch(media.url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) throw new WhatsAppClientError("Nao foi possivel baixar a midia recebida.");
  const contentType = response.headers.get("content-type") || media.mime_type || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) throw new WhatsAppClientError("O arquivo recebido e maior que o limite permitido.");
  return { bytes: new Uint8Array(arrayBuffer), contentType };
}

export async function downloadWhatsAppMediaAsDataUrl(media: WhatsAppMediaMetadata, config: WhatsAppConfig) {
  const { bytes, contentType } = await downloadWhatsAppMedia(media, config);
  const base64 = Buffer.from(bytes).toString("base64");
  return { dataUrl: `data:${contentType};base64,${base64}`, bytes, contentType };
}

export async function downloadWhatsAppImageAsDataUrl(media: WhatsAppMediaMetadata, config: WhatsAppConfig) {
  const downloaded = await downloadWhatsAppMediaAsDataUrl(media, config);
  if (!downloaded.contentType.startsWith("image/")) throw new WhatsAppClientError("O arquivo recebido nao parece ser uma imagem.");
  return downloaded.dataUrl;
}

export async function sendWhatsAppTextMessage({
  to,
  body,
  config
}: {
  to: string;
  body: string;
  config: WhatsAppConfig;
}) {
  const response = await fetch(`${getGraphBaseUrl(config)}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body }
    })
  });
  if (!response.ok) throw new WhatsAppClientError("Nao foi possivel enviar resposta pelo WhatsApp.");
}

function getGraphBaseUrl(config: WhatsAppConfig) {
  return `https://graph.facebook.com/${config.apiVersion}`;
}
