import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { createPluggyConnectToken, isPluggyConfigured } from "@/modules/open-finance/pluggy";
import { hasOpenFinanceItem } from "@/modules/open-finance/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;
  if (!isPluggyConfigured()) return NextResponse.json({ error: "Open Finance ainda nao esta configurado neste ambiente." }, { status: 503 });
  try {
    const body = await request.json().catch(() => ({})) as { itemId?: string };
    const itemId = body.itemId?.trim();
    if (itemId && !(await hasOpenFinanceItem(itemId))) {
      return NextResponse.json({ error: "Conexao nao pertence a esta workspace." }, { status: 403 });
    }
    const result = await createPluggyConnectToken({ clientUserId: access.user.id, itemId });
    return NextResponse.json({ accessToken: result.accessToken });
  } catch (error) {
    console.error("pluggy_connect_token_failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel iniciar o Open Finance." }, { status: 502 });
  }
}
