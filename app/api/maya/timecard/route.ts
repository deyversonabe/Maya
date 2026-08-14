import { NextResponse } from "next/server";
import { readTimeClockReportText, readTimeClockWithMaya } from "@/modules/ai/maya";

const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000;
const MAX_PDF_DATA_URL_LENGTH = 10_000_000;

export const maxDuration = 25;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageDataUrl?: string;
      fileDataUrl?: string;
      mimeType?: string;
      fileName?: string;
      targetDate?: string;
    };

    if (body.fileDataUrl?.startsWith("data:application/pdf")) {
      if (body.fileDataUrl.length > MAX_PDF_DATA_URL_LENGTH) {
        return NextResponse.json({ error: "PDF maior que o limite permitido." }, { status: 413 });
      }

      const { PDFParse } = await import("pdf-parse");
      const base64 = body.fileDataUrl.split(",")[1] ?? "";
      const parser = new PDFParse({ data: new Uint8Array(Buffer.from(base64, "base64")) });
      let pdfText = "";

      try {
        pdfText = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }

      return NextResponse.json(
        readTimeClockReportText({
          text: pdfText,
          fileName: body.fileName,
          targetDate: body.targetDate
        })
      );
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
