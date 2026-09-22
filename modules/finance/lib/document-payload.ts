import type { FinanceDocumentAttachmentUpload } from "./image-upload";

export type DocumentReadPayload = {
  imageDataUrl?: string;
  fileDataUrl?: string;
  fileUrl?: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
};

export function buildDocumentReadPayload(attachment: FinanceDocumentAttachmentUpload): DocumentReadPayload {
  const isPdf =
    attachment.mimeType === "application/pdf" || attachment.fileName.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return {
      imageDataUrl: attachment.imageDataUrl,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      fileSize: attachment.size
    };
  }

  return {
    fileDataUrl: attachment.signedUrl ? undefined : attachment.fileDataUrl,
    fileUrl: attachment.signedUrl,
    mimeType: "application/pdf",
    fileName: attachment.fileName,
    fileSize: attachment.size
  };
}
