"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toDateKey } from "@/lib/utils";

const MAX_IMAGE_EDGE = 3000;
const MAX_DATA_URL_LENGTH = 3_800_000;
const MAX_DOCUMENT_DATA_URL_LENGTH = 3_900_000;
const JPEG_QUALITY = 0.92;
const ATTACHMENT_BUCKET = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET || "maya-finance-attachments";
const WORKSPACE_ID =
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";

export interface FinanceAttachmentUpload {
  imageDataUrl: string;
  fileName: string;
  storagePath?: string;
  signedUrl?: string;
  mimeType: string;
  size: number;
}

export interface FinanceDocumentAttachmentUpload {
  imageDataUrl?: string;
  fileDataUrl?: string;
  fileName: string;
  storagePath?: string;
  signedUrl?: string;
  mimeType: string;
  size: number;
}

export async function fileToOptimizedImageDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("invalid_image_file");
  }

  const originalDataUrl = await fileToDataUrl(file);

  try {
    const image = await loadImage(originalDataUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      if (originalDataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error("image_too_large");
      }

      return originalDataUrl;
    }

    let dimensions = fitInside(image.naturalWidth, image.naturalHeight, MAX_IMAGE_EDGE);
    let quality = JPEG_QUALITY;
    let dataUrl = "";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, dimensions.width, dimensions.height);
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

      dataUrl = canvas.toDataURL("image/jpeg", quality);

      if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }

      if (quality > 0.72) {
        quality -= 0.06;
      } else {
        dimensions = {
          width: Math.max(1, Math.round(dimensions.width * 0.9)),
          height: Math.max(1, Math.round(dimensions.height * 0.9))
        };
        quality = 0.84;
      }
    }

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error("image_too_large");
    }

    return dataUrl;
  } catch {
    if (originalDataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error("image_too_large");
    }

    return originalDataUrl;
  }
}

export async function fileToFinanceAttachment(file: File): Promise<FinanceAttachmentUpload> {
  const imageDataUrl = await fileToOptimizedImageDataUrl(file);
  const mimeType = getMimeTypeFromDataUrl(imageDataUrl) || "image/jpeg";
  const binary = dataUrlToBlob(imageDataUrl, mimeType);
  const uploaded = await tryUploadAttachment(file.name, binary, mimeType);

  return {
    imageDataUrl,
    fileName: file.name,
    storagePath: uploaded?.storagePath,
    signedUrl: uploaded?.signedUrl,
    mimeType,
    size: binary.size
  };
}

export async function fileToFinanceDocumentAttachment(file: File): Promise<FinanceDocumentAttachmentUpload> {
  if (file.type.startsWith("image/")) {
    const attachment = await fileToFinanceAttachment(file);

    return {
      ...attachment,
      fileDataUrl: attachment.imageDataUrl
    };
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("invalid_finance_document_file");
  }

  const mimeType = file.type || "application/pdf";
  const uploaded = await tryUploadAttachment(file.name, file, mimeType);

  if (uploaded?.signedUrl) {
    return {
      fileName: file.name,
      storagePath: uploaded.storagePath,
      signedUrl: uploaded.signedUrl,
      mimeType,
      size: file.size
    };
  }

  const fileDataUrl = await fileToDataUrl(file);

  if (fileDataUrl.length > MAX_DOCUMENT_DATA_URL_LENGTH) {
    throw new Error("document_too_large");
  }

  return {
    fileDataUrl,
    fileName: file.name,
    storagePath: uploaded?.storagePath,
    mimeType: getMimeTypeFromDataUrl(fileDataUrl) || mimeType,
    size: file.size
  };
}

export async function detectQrPayloadsFromImageDataUrl(imageDataUrl: string) {
  const Detector = (
    globalThis as typeof globalThis & {
      BarcodeDetector?: new (options: { formats: string[] }) => {
        detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
      };
    }
  ).BarcodeDetector;

  if (!Detector) {
    return [];
  }

  try {
    const image = await loadImage(imageDataUrl);
    const detector = new Detector({ formats: ["qr_code"] });
    const results = await detector.detect(image);

    return Array.from(
      new Set(
        results
          .map((result) => result.rawValue?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
  } catch {
    return [];
  }
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = src;
  });
}

function fitInside(width: number, height: number, maxEdge: number) {
  const longestEdge = Math.max(width, height);

  if (!Number.isFinite(longestEdge) || longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function tryUploadAttachment(fileName: string, blob: Blob, mimeType: string) {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return undefined;
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return undefined;
  }

  const path = `${WORKSPACE_ID}/${toDateKey()}/${crypto.randomUUID()}-${buildStoredFileName(fileName, mimeType)}`;

  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type || mimeType,
    upsert: false
  });

  if (error) {
    console.warn("maya_attachment_upload_failed", {
      bucket: ATTACHMENT_BUCKET,
      code: error.name,
      message: error.message
    });
    return undefined;
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 10 * 60);

  if (signedError || !signedData?.signedUrl) {
    console.warn("maya_attachment_signed_url_failed", {
      bucket: ATTACHMENT_BUCKET,
      code: signedError?.name,
      message: signedError?.message
    });
    return { storagePath: path };
  }

  return { storagePath: path, signedUrl: signedData.signedUrl };
}

function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, (character) => character.charCodeAt(0));
  const byteArray = new Uint8Array(byteNumbers);

  return new Blob([byteArray], { type: mimeType });
}

function getMimeTypeFromDataUrl(dataUrl: string) {
  return dataUrl.match(/^data:([^;]+);base64,/)?.[1];
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "anexo";
}

function buildStoredFileName(fileName: string, mimeType: string) {
  const sanitized = sanitizeFileName(fileName);
  const extension = extensionFromMimeType(mimeType) || extensionFromFileName(sanitized) || "bin";
  const baseName = sanitized.replace(/\.[a-zA-Z0-9]{1,8}$/i, "") || "anexo";

  return `${baseName}.${extension}`;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "jpg";
  }

  return "";
}

function extensionFromFileName(fileName: string) {
  return fileName.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]?.toLowerCase() ?? "";
}
