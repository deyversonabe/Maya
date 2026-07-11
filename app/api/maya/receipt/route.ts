import { NextResponse } from "next/server";
import { readReceiptWithMaya } from "@/modules/ai/maya";

const MAX_IMAGE_DATA_URL_LENGTH = 8_000_000;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileName?: string;
    };

    if (!body.imageDataUrl?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Imagem invalida." }, { status: 400 });
    }

    if (body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Imagem maior que o limite permitido." }, { status: 413 });
    }

    const result = await readReceiptWithMaya({
      imageDataUrl: body.imageDataUrl,
      fileName: body.fileName
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel ler o comprovante." }, { status: 500 });
  }
}
