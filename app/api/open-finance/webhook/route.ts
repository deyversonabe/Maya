import { NextResponse } from "next/server";
import { updateOpenFinanceItemFromWebhook } from "@/modules/open-finance/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ error: "Webhook Open Finance ainda nao configurado com segredo." }, { status: 503 });
  const received = request.headers.get("x-maya-pluggy-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (received !== expected) return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { event?: string; itemId?: string };
  // Mantem o trabalho curto: apenas registra o estado da conexao; sincronizacao detalhada e feita sob demanda.
  if (body.itemId && body.event) {
    try { await updateOpenFinanceItemFromWebhook({ itemId: body.itemId, event: body.event }); }
    catch (error) { console.error("pluggy_webhook_update_failed", error); }
  }
  return NextResponse.json({ received: true });
}
