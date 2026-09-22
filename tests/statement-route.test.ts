import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readBankStatementWithMaya: vi.fn(async () => ({
    statementDraft: {
      title: "Extrato",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      confidence: 0.99,
      missingFields: [],
      lines: []
    },
    needsReview: true as const,
    message: "Rascunho criado."
  }))
}));

vi.mock("@/app/api/_shared/require-member", () => ({
  requireWorkspaceMember: vi.fn(async () => ({ ok: true }))
}));

vi.mock("@/modules/ai/maya", () => ({
  readBankStatementWithMaya: mocks.readBankStatementWithMaya
}));

import { POST } from "@/app/api/maya/statement/route";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalBucket = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET = "maya-finance-attachments";
  mocks.readBankStatementWithMaya.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  if (originalBucket === undefined) delete process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET;
  else process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET = originalBucket;
});

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/maya/statement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/maya/statement PDF contract", () => {
  it("passes direct PDF base64 to the MAYA reader", async () => {
    const response = await POST(
      makeRequest({
        fileDataUrl: "data:application/pdf;base64,JVBERi0x",
        fileName: "extrato.pdf",
        mimeType: "application/pdf",
        fileSize: 1234
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.readBankStatementWithMaya).toHaveBeenCalledWith(
      expect.objectContaining({ pdfBase64: "JVBERi0x", pdfUrl: undefined, fileName: "extrato.pdf" })
    );
  });

  it("passes an authorized signed PDF URL without also sending base64", async () => {
    const signedUrl =
      "https://project.supabase.co/storage/v1/object/sign/maya-finance-attachments/workspace/extrato.pdf?token=abc";
    const response = await POST(
      makeRequest({ fileUrl: signedUrl, fileName: "extrato.pdf", mimeType: "application/pdf", fileSize: 2222 })
    );

    expect(response.status).toBe(200);
    expect(mocks.readBankStatementWithMaya).toHaveBeenCalledWith(
      expect.objectContaining({ pdfUrl: signedUrl, pdfBase64: undefined, fileName: "extrato.pdf" })
    );
  });

  it("rejects a PDF URL from another host", async () => {
    const response = await POST(
      makeRequest({ fileUrl: "https://evil.example/extrato.pdf?token=abc", fileName: "extrato.pdf" })
    );

    expect(response.status).toBe(400);
    expect(mocks.readBankStatementWithMaya).not.toHaveBeenCalled();
  });

  it("rejects oversized direct PDF payloads with a specific status", async () => {
    const response = await POST(
      makeRequest({ fileDataUrl: `data:application/pdf;base64,${"A".repeat(5_500_001)}`, fileName: "grande.pdf" })
    );

    expect(response.status).toBe(413);
    expect(mocks.readBankStatementWithMaya).not.toHaveBeenCalled();
  });
});
