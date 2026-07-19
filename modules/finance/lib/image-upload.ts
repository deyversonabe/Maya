"use client";

const MAX_IMAGE_EDGE = 1600;
const MAX_DATA_URL_LENGTH = 3_800_000;
const JPEG_QUALITY = 0.86;

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

      if (quality > 0.62) {
        quality -= 0.08;
      } else {
        dimensions = {
          width: Math.max(1, Math.round(dimensions.width * 0.85)),
          height: Math.max(1, Math.round(dimensions.height * 0.85))
        };
        quality = 0.78;
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
