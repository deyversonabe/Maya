import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { normalizeAllowedAttachmentUrl } from "@/app/api/_shared/attachment-url";
import { readReceiptWithMaya } from "@/modules/ai/maya";
import type { FinancialDocumentKind } from "@/modules/finance/types";

const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;
const MAX_PDF_DATA_URL_LENGTH = 4_000_000;

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceMember(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileDataUrl?: string;
      fileUrl?: string;
      mimeType?: string;
      fileName?: string;
      documentKind?: FinancialDocumentKind;
      qrPayloads?: string[];
    };

    const hasImage = body.imageDataUrl?.startsWith("data:image/");
    const pdfUrl = normalizeAllowedAttachmentUrl(body.fileUrl);
    const hasPdfData = body.fileDataUrl?.startsWith("data:application/pdf");
    const hasPdf = Boolean(pdfUrl || hasPdfData);

    if (body.fileUrl && !pdfUrl) {
      return NextResponse.json({ error: "URL de PDF invalida ou nao autorizada." }, { status: 400 });
    }

    if (!hasImage && !hasPdf) {
      return NextResponse.json({ error: "Arquivo invalido. Envie imagem ou PDF." }, { status: 400 });
    }

    if (hasImage && body.imageDataUrl && body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Imagem maior que o limite permitido." }, { status: 413 });
    }

    if (hasPdfData && body.fileDataUrl && body.fileDataUrl.length > MAX_PDF_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "PDF maior que o limite permitido para envio direto." }, { status: 413 });
    }

    const pdfBase64 = hasPdfData && body.fileDataUrl ? body.fileDataUrl.split(",")[1] ?? "" : undefined;

    if (hasPdf && !pdfUrl && !pdfBase64) {
      return NextResponse.json({ error: "PDF vazio ou invalido." }, { status: 400 });
    }

    const result = await readReceiptWithMaya({
      imageDataUrl: hasImage ? body.imageDataUrl : undefined,
      pdfBase64,
      pdfUrl,
      fileName: body.fileName,
      documentKind: body.documentKind,
      qrPayloads: body.qrPayloads
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("maya_receipt_read_failed", error);
    return NextResponse.json({ error: "Nao foi possivel ler o comprovante." }, { status: 500 });
  }
}
