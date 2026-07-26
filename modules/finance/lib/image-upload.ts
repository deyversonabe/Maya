"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MAX_IMAGE_EDGE = 2600;
const MAX_DATA_URL_LENGTH = 3_200_000;
const JPEG_QUALITY = 0.9;
const ATTACHMENT_BUCKET = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET || "maya-finance-attachments";
const WORKSPACE_ID =
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";

export interface FinanceAttachmentUpload {
  imageDataUrl: string;
  fileName: string;
  storagePath?: string;
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
  const storagePath = await tryUploadAttachment(file.name, binary);

  return {
    imageDataUrl,
    fileName: file.name,
    storagePath,
    mimeType,
    size: binary.size
  };
}

function fileToDataUrl(file: File) {
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

async function tryUploadAttachment(fileName: string, blob: Blob) {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return undefined;
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return undefined;
  }

  const path = `${WORKSPACE_ID}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sanitizeFileName(
    fileName
  )}.jpg`;

  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type || "image/jpeg",
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

  return path;
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
