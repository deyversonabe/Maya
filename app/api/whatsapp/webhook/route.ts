import { NextResponse } from "next/server";
import { processWhatsAppWebhook } from "@/modules/whatsapp/processor";
import { isValidWebhookChallenge, verifyMetaSignature } from "@/modules/whatsapp/security";
import type { WhatsAppWebhookPayload } from "@/modules/whatsapp/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  const isValid = isValidWebhookChallenge({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    expectedToken: process.env.WHATSAPP_VERIFY_TOKEN
  });

  if (!isValid || !challenge) {
    return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}

export async function POST(request: Request) {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    return NextResponse.json({ received: true, processed: 0, ignored: 0, repliesSent: 0 });
  }

  const rawBody = await request.text();
  const isValidSignature = verifyMetaSignature({
    rawBody,
    signature: request.headers.get("x-hub-signature-256"),
    appSecret: process.env.WHATSAPP_APP_SECRET
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "Assinatura invalida." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    const result = await processWhatsAppWebhook(payload);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ received: true, processed: 0, ignored: 0, repliesSent: 0 });
  }
}
