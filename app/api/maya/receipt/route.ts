import { NextResponse } from "next/server";
import { readReceiptWithMaya } from "@/modules/ai/maya";
import type { FinancialDocumentKind } from "@/modules/finance/types";

const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;

export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileName?: string;
      documentKind?: FinancialDocumentKind;
    };

    if (!body.imageDataUrl?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Imagem invalida." }, { status: 400 });
    }

    if (body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Imagem maior que o limite permitido." }, { status: 413 });
    }

    const result = await readReceiptWithMaya({
      imageDataUrl: body.imageDataUrl,
      fileName: body.fileName,
      documentKind: body.documentKind
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel ler o comprovante." }, { status: 500 });
  }
}
