import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { reviewTransactionEntry } from "@/modules/ai/validation";
import { migrateFinanceState } from "@/modules/finance/lib/migrations";
import type { FinanceState, TransactionReviewInput } from "@/modules/finance/types";

export const maxDuration = 25;

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceMember(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      state?: FinanceState;
      candidate?: TransactionReviewInput;
    };

    if (!body.state || !body.candidate) {
      return NextResponse.json({ error: "Dados invalidos para revisao da MAYA." }, { status: 400 });
    }

    const state = migrateFinanceState(body.state);
    const review = reviewTransactionEntry({
      candidate: body.candidate,
      state
    });

    return NextResponse.json(review);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel revisar o lancamento com a MAYA." }, { status: 500 });
  }
}
