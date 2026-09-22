import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/app/api/_shared/require-member";
import { normalizeAllowedAttachmentUrl } from "@/app/api/_shared/attachment-url";
import { readBankStatementWithMaya } from "@/modules/ai/maya";

const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000;
const MAX_PDF_DATA_URL_LENGTH = 5_500_000;

export const maxDuration = 60;

type StatementRequestBody = {
  imageDataUrl?: string;
  fileDataUrl?: string;
  fileUrl?: string;
  documentText?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

export async function POST(request: Request) {
  let body: StatementRequestBody = {};

  try {
    const access = await requireWorkspaceMember(request);
    if (!access.ok) return access.response;

    body = (await request.json()) as StatementRequestBody;

    const hasImage = body.imageDataUrl?.startsWith("data:image/");
    const pdfUrl = normalizeAllowedAttachmentUrl(body.fileUrl);
    const hasPdfData = body.fileDataUrl?.startsWith("data:application/pdf");
    const hasText = Boolean(body.documentText?.trim());
    const isPdfRequest = Boolean(body.fileUrl || hasPdfData || body.fileName?.toLowerCase().endsWith(".pdf"));

    if (body.fileUrl && !pdfUrl) {
      logStatementPdfFailure("signed_url_rejected", body, 400, "invalid_signed_url");
      return NextResponse.json(
        { error: "A URL temporaria do PDF e invalida, expirou ou nao pertence ao Storage autorizado." },
        { status: 400 }
      );
    }

    if (!hasImage && !hasPdfData && !pdfUrl && !hasText) {
      if (isPdfRequest) logStatementPdfFailure("payload_missing", body, 400, "pdf_payload_missing");
      return NextResponse.json({ error: "Envie uma imagem, PDF ou texto de extrato." }, { status: 400 });
    }

    if (hasImage && body.imageDataUrl && body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "A imagem do extrato excede o limite permitido." }, { status: 413 });
    }

    if (hasPdfData && body.fileDataUrl && body.fileDataUrl.length > MAX_PDF_DATA_URL_LENGTH) {
      logStatementPdfFailure("base64_limit", body, 413, "pdf_direct_payload_too_large");
      return NextResponse.json(
        { error: "O PDF excede o limite do envio direto. Configure o Storage privado ou envie um arquivo menor." },
        { status: 413 }
      );
    }

    const pdfBase64 = hasPdfData && body.fileDataUrl ? body.fileDataUrl.split(",")[1] ?? "" : undefined;

    if (hasPdfData && !pdfBase64) {
      logStatementPdfFailure("base64_empty", body, 400, "pdf_empty");
      return NextResponse.json({ error: "O PDF esta vazio ou corrompido." }, { status: 400 });
    }

    const result = await readBankStatementWithMaya({
      imageDataUrl: hasImage ? body.imageDataUrl : undefined,
      pdfBase64,
      pdfUrl,
      documentText: body.documentText,
      fileName: body.fileName
    });

    if (isPdfRequest && result.statementDraft.lines.length === 0) {
      logStatementPdfFailure("no_reliable_lines", body, 200, "statement_lines_empty");
    }

    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.name || "statement_route_error" : "statement_route_error";
    logStatementPdfFailure("route_exception", body, 500, code);
    return NextResponse.json(
      { error: "O arquivo foi recebido, mas a leitura do extrato falhou temporariamente. Tente novamente." },
      { status: 500 }
    );
  }
}

function logStatementPdfFailure(
  stage: string,
  body: StatementRequestBody,
  status: number,
  code: string
) {
  console.error("maya_statement_pdf_failed", {
    stage,
    mimeType: body.mimeType || (body.fileName?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "unknown"),
    fileSize: Number.isFinite(body.fileSize) ? body.fileSize : undefined,
    usingSignedUrl: Boolean(body.fileUrl),
    usingBase64: Boolean(body.fileDataUrl),
    status,
    code
  });
}
