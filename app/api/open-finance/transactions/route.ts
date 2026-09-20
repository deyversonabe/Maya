import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { listPluggyAccounts, listPluggyTransactions } from "@/modules/open-finance/pluggy";
import { listOpenFinanceItems } from "@/modules/open-finance/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;
  const accountId = new URL(request.url).searchParams.get("accountId")?.trim();
  if (!accountId) return NextResponse.json({ error: "accountId obrigatorio." }, { status: 400 });
  try {
    // Nunca use um accountId recebido do navegador diretamente com a chave global da Pluggy.
    // Primeiro prove que a conta pertence a um Item ja registrado na workspace atual.
    const items = await listOpenFinanceItems();
    let authorized = false;
    for (const item of items) {
      const accounts = await listPluggyAccounts(item.itemId);
      if (accounts.some((account) => account.id === accountId)) {
        authorized = true;
        break;
      }
    }
    if (!authorized) return NextResponse.json({ error: "Conta conectada nao pertence a esta workspace." }, { status: 403 });
    return NextResponse.json({ transactions: await listPluggyTransactions(accountId) });
  } catch (error) {
    console.error("pluggy_transactions_failed", error);
    return NextResponse.json({ error: "Nao foi possivel consultar as transacoes." }, { status: 502 });
  }
}
