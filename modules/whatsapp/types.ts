import type { ExpenseDraft } from "@/modules/finance/types";

export type WhatsAppMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
  image?: {
    id: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
  };
};

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
};

export type WhatsAppMediaMetadata = {
  id: string;
  url: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
};

export type WhatsAppProcessingResult = {
  received: true;
  processed: number;
  ignored: number;
  repliesSent: number;
};

export type WhatsAppReceiptResult = {
  to: string;
  messageId: string;
  draft: ExpenseDraft;
  reply: string;
};
