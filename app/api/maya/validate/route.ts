import { NextResponse } from "next/server";
import { reviewTransactionEntry } from "@/modules/ai/validation";
import { migrateFinanceState } from "@/modules/finance/lib/migrations";
import type { FinanceState, TransactionReviewInput } from "@/modules/finance/types";

export async function POST(request: Request) {
  try {
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
