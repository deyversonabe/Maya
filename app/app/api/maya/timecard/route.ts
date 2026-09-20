import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { normalizeAllowedAttachmentUrl } from "@/app/api/_shared/attachment-url";
import { readTimeClockWithMaya } from "@/modules/ai/maya";

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
      targetDate?: string;
    };

    const pdfUrl = normalizeAllowedAttachmentUrl(body.fileUrl);

    if (body.fileUrl && !pdfUrl) {
      return NextResponse.json({ error: "URL de PDF invalida ou nao autorizada." }, { status: 400 });
    }

    if (pdfUrl || body.fileDataUrl?.startsWith("data:application/pdf")) {
      if (body.fileDataUrl && body.fileDataUrl.length > MAX_PDF_DATA_URL_LENGTH) {
        return NextResponse.json({ error: "PDF maior que o limite permitido para envio direto." }, { status: 413 });
      }

      const pdfBase64 = body.fileDataUrl?.split(",")[1] ?? "";

      if (!pdfUrl && !pdfBase64) {
        return NextResponse.json({ error: "PDF vazio ou invalido." }, { status: 400 });
      }

      const result = await readTimeClockWithMaya({
        pdfBase64: pdfBase64 || undefined,
        pdfUrl,
        fileName: body.fileName,
        targetDate: body.targetDate
      });

      return NextResponse.json(result);
    }

    if (!body.imageDataUrl?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Arquivo invalido. Envie imagem ou PDF." }, { status: 400 });
    }

    if (body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Imagem maior que o limite permitido." }, { status: 413 });
    }

    const result = await readTimeClockWithMaya({
      imageDataUrl: body.imageDataUrl,
      fileName: body.fileName,
      targetDate: body.targetDate
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("maya_timecard_read_failed", error);
    return NextResponse.json({ error: "Nao foi possivel ler o registro de ponto." }, { status: 500 });
  }
}
