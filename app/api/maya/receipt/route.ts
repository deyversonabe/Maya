import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { readReceiptWithMaya } from "@/modules/ai/maya";
import type { FinancialDocumentKind } from "@/modules/finance/types";

const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000;
const MAX_PDF_DATA_URL_LENGTH = 10_000_000;

export const maxDuration = 25;

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceMember(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileDataUrl?: string;
      mimeType?: string;
      fileName?: string;
      documentKind?: FinancialDocumentKind;
      qrPayloads?: string[];
    };

    const hasImage = body.imageDataUrl?.startsWith("data:image/");
    const hasPdf = body.fileDataUrl?.startsWith("data:application/pdf");

    if (!hasImage && !hasPdf) {
      return NextResponse.json({ error: "Arquivo invalido. Envie imagem ou PDF." }, { status: 400 });
    }

    if (hasImage && body.imageDataUrl && body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Imagem maior que o limite permitido." }, { status: 413 });
    }

    if (hasPdf && body.fileDataUrl && body.fileDataUrl.length > MAX_PDF_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "PDF maior que o limite permitido." }, { status: 413 });
    }

    const documentText = hasPdf && body.fileDataUrl ? await extractPdfText(body.fileDataUrl) : undefined;
    const result = await readReceiptWithMaya({
      imageDataUrl: hasImage ? body.imageDataUrl : undefined,
      documentText,
      fileName: body.fileName,
      documentKind: body.documentKind,
      qrPayloads: body.qrPayloads
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel ler o comprovante." }, { status: 500 });
  }
}

async function extractPdfText(fileDataUrl: string) {
  const { PDFParse } = await import("pdf-parse");
  const base64 = fileDataUrl.split(",")[1] ?? "";
  const parser = new PDFParse({ data: new Uint8Array(Buffer.from(base64, "base64")) });

  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
