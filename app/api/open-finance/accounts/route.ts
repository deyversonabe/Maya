import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { listPluggyAccounts } from "@/modules/open-finance/pluggy";
import { hasOpenFinanceItem } from "@/modules/open-finance/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;
  const itemId = new URL(request.url).searchParams.get("itemId")?.trim();
  if (!itemId) return NextResponse.json({ error: "itemId obrigatorio." }, { status: 400 });
  try {
    if (!(await hasOpenFinanceItem(itemId))) {
      return NextResponse.json({ error: "Conexao nao pertence a esta workspace." }, { status: 403 });
    }
    return NextResponse.json({ accounts: await listPluggyAccounts(itemId) });
  } catch (error) {
    console.error("pluggy_accounts_failed", error);
    return NextResponse.json({ error: "Nao foi possivel consultar as contas conectadas." }, { status: 502 });
  }
}
