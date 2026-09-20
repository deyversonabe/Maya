import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { createFinanceCapture, listFinanceCaptures } from "@/modules/captures/server";
import { validateBankStatementDraft, validateFinancialDocumentDraft } from "@/modules/captures/validation";
import type { CaptureDraft, CaptureKind } from "@/modules/captures/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const captures = await listFinanceCaptures({ status: status === "all" ? undefined : status, limit: 150 });
    return NextResponse.json({ captures });
  } catch (error) {
    console.error("capture_list_failed", error);
    return NextResponse.json({ error: "Nao foi possivel carregar a Caixa de capturas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireWorkspaceMember(request);
  if (!access.ok) return access.response;

  try {
    const body = (await request.json()) as {
      kind?: CaptureKind;
      title?: string;
      rawText?: string;
      draft?: CaptureDraft;
      attachmentName?: string;
      attachmentMimeType?: string;
    };

    if (!body.draft || !body.title?.trim()) {
      return NextResponse.json({ error: "Rascunho invalido." }, { status: 400 });
    }

    const validation =
      body.draft.type === "bank_statement"
        ? validateBankStatementDraft(body.draft.value)
        : validateFinancialDocumentDraft(body.draft.value);

    const capture = await createFinanceCapture({
      source: "app",
      kind: body.kind ?? body.draft.type,
      title: body.title.trim(),
      rawText: body.rawText,
      draft: body.draft,
      validation,
      attachmentName: body.attachmentName,
      attachmentMimeType: body.attachmentMimeType
    });

    return NextResponse.json({ capture }, { status: 201 });
  } catch (error) {
    console.error("capture_create_failed", error);
    return NextResponse.json({ error: "Nao foi possivel criar o rascunho." }, { status: 500 });
  }
}
