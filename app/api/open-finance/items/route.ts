import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { listOpenFinanceItems, upsertOpenFinanceItem } from "@/modules/open-finance/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;
  try { return NextResponse.json({ items: await listOpenFinanceItems() }); }
  catch (error) { console.error("open_finance_items_list_failed", error); return NextResponse.json({ error: "Nao foi possivel carregar as conexoes." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;
  try {
    const body = await request.json() as { itemId?: string; connectorName?: string; status?: string };
    if (!body.itemId?.trim()) return NextResponse.json({ error: "itemId obrigatorio." }, { status: 400 });
    const item = await upsertOpenFinanceItem({ itemId: body.itemId.trim(), connectorName: body.connectorName, status: body.status, clientUserId: access.user.id });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) { console.error("open_finance_item_save_failed", error); return NextResponse.json({ error: "Nao foi possivel salvar a conexao." }, { status: 500 }); }
}
