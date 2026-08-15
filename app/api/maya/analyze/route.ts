import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { generateMayaAnalysis } from "@/modules/ai/maya";
import { migrateFinanceState } from "@/modules/finance/lib/migrations";
import type { FinanceState } from "@/modules/finance/types";

export const maxDuration = 25;

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceMember(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      state?: FinanceState;
      question?: string;
    };

    if (!body.state) {
      return NextResponse.json({ error: "Estado financeiro invalido." }, { status: 400 });
    }

    const state = migrateFinanceState(body.state);
    const analysis = await generateMayaAnalysis({
      state,
      question: body.question
    });

    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel gerar analise da MAYA." }, { status: 500 });
  }
}
