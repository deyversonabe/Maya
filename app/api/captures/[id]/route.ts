import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { getFinanceCapture, updateFinanceCapture } from "@/modules/captures/server";
import { validateBankStatementDraft, validateFinancialDocumentDraft } from "@/modules/captures/validation";
import type { CaptureDraft, CaptureStatus } from "@/modules/captures/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const capture = await getFinanceCapture(id);
  return capture ? NextResponse.json({ capture }) : NextResponse.json({ error: "Captura nao encontrada." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: CaptureStatus; draft?: CaptureDraft };
    const current = await getFinanceCapture(id);
    if (!current) return NextResponse.json({ error: "Captura nao encontrada." }, { status: 404 });

    const draft = body.draft ?? current.draft;
    const validation =
      draft.type === "bank_statement"
        ? validateBankStatementDraft(draft.value)
        : validateFinancialDocumentDraft(draft.value);

    if (body.status === "confirmed" && validation.status === "blocked") {
      return NextResponse.json({ error: "Corrija os campos bloqueados antes de confirmar.", validation }, { status: 409 });
    }

    const capture = await updateFinanceCapture(id, {
      status: body.status,
      draft,
      validation,
      confirmedBy: body.status === "confirmed" ? access.user.id : undefined
    });
    return NextResponse.json({ capture });
  } catch (error) {
    console.error("capture_update_failed", error);
    return NextResponse.json({ error: "Nao foi possivel atualizar a captura." }, { status: 500 });
  }
}
