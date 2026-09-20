import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { normalizeAllowedAttachmentUrl } from "@/app/api/_shared/attachment-url";
import { readBankStatementWithMaya } from "@/modules/ai/maya";

const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000;
const MAX_PDF_DATA_URL_LENGTH = 5_500_000;

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceMember(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileDataUrl?: string;
      fileUrl?: string;
      documentText?: string;
      fileName?: string;
    };

    const hasImage = body.imageDataUrl?.startsWith("data:image/");
    const pdfUrl = normalizeAllowedAttachmentUrl(body.fileUrl);
    const hasPdfData = body.fileDataUrl?.startsWith("data:application/pdf");
    const hasText = Boolean(body.documentText?.trim());

    if (body.fileUrl && !pdfUrl) {
      return NextResponse.json({ error: "URL de PDF invalida ou nao autorizada." }, { status: 400 });
    }
    if (!hasImage && !hasPdfData && !pdfUrl && !hasText) {
      return NextResponse.json({ error: "Envie uma imagem, PDF ou texto de extrato." }, { status: 400 });
    }
    if (hasImage && body.imageDataUrl && body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Imagem maior que o limite permitido." }, { status: 413 });
    }
    if (hasPdfData && body.fileDataUrl && body.fileDataUrl.length > MAX_PDF_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "PDF maior que o limite permitido para envio direto." }, { status: 413 });
    }

    const pdfBase64 = hasPdfData && body.fileDataUrl ? body.fileDataUrl.split(",")[1] ?? "" : undefined;
    const result = await readBankStatementWithMaya({
      imageDataUrl: hasImage ? body.imageDataUrl : undefined,
      pdfBase64,
      pdfUrl,
      documentText: body.documentText,
      fileName: body.fileName
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("maya_statement_read_failed", error);
    return NextResponse.json({ error: "Nao foi possivel ler o extrato." }, { status: 500 });
  }
}
