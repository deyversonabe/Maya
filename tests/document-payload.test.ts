import { describe, expect, it } from "vitest";
import { buildDocumentReadPayload } from "@/modules/finance/lib/document-payload";

describe("buildDocumentReadPayload", () => {
  it("uses input image data for photos", () => {
    expect(
      buildDocumentReadPayload({
        imageDataUrl: "data:image/jpeg;base64,abc",
        fileDataUrl: "data:image/jpeg;base64,abc",
        fileName: "comprovante.jpg",
        mimeType: "image/jpeg",
        size: 123
      })
    ).toEqual({
      imageDataUrl: "data:image/jpeg;base64,abc",
      fileName: "comprovante.jpg",
      mimeType: "image/jpeg",
      fileSize: 123
    });
  });

  it("prefers signed URL for PDFs and does not send base64 at the same time", () => {
    const payload = buildDocumentReadPayload({
      fileDataUrl: "data:application/pdf;base64,JVBERi0x",
      signedUrl: "https://project.supabase.co/storage/v1/object/sign/maya-finance-attachments/a/extrato.pdf?token=abc",
      storagePath: "a/extrato.pdf",
      fileName: "extrato.pdf",
      mimeType: "application/pdf",
      size: 456
    });

    expect(payload.fileUrl).toContain("extrato.pdf?token=abc");
    expect(payload.fileDataUrl).toBeUndefined();
  });

  it("uses base64 fallback for a PDF when Storage did not return a signed URL", () => {
    const payload = buildDocumentReadPayload({
      fileDataUrl: "data:application/pdf;base64,JVBERi0x",
      fileName: "extrato.pdf",
      mimeType: "application/pdf",
      size: 456
    });

    expect(payload.fileDataUrl).toBe("data:application/pdf;base64,JVBERi0x");
    expect(payload.fileUrl).toBeUndefined();
  });
});
