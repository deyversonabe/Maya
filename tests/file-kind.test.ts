import { describe, expect, it } from "vitest";
import { formatFileSize, isImageFile, isPdfFile, isSupportedDocumentFile } from "@/modules/finance/lib/file-kind";

describe("finance document file kinds", () => {
  it("detects PDF by MIME or .pdf extension when mobile sends an empty MIME", () => {
    expect(isPdfFile({ name: "extrato.pdf", type: "application/pdf" })).toBe(true);
    expect(isPdfFile({ name: "EXTRATO.PDF", type: "" })).toBe(true);
    expect(isPdfFile({ name: "extrato.png", type: "image/png" })).toBe(false);
  });

  it("accepts common image formats and rejects unrelated files", () => {
    expect(isImageFile({ name: "foto.jpg", type: "image/jpeg" })).toBe(true);
    expect(isImageFile({ name: "foto.heic", type: "" })).toBe(true);
    expect(isSupportedDocumentFile({ name: "nota.pdf", type: "" })).toBe(true);
    expect(isSupportedDocumentFile({ name: "planilha.csv", type: "text/csv" })).toBe(false);
  });

  it("formats file sizes for UI without changing the file", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
