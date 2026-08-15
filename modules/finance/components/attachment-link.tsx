"use client";

import { useState } from "react";
import { FileImage } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const ATTACHMENT_BUCKET = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET || "maya-finance-attachments";

export function AttachmentLink({
  dataUrl,
  storagePath,
  imageName,
  className
}: {
  dataUrl?: string;
  storagePath?: string;
  imageName?: string;
  className?: string;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const baseClassName =
    className ??
    "mt-3 inline-flex items-center gap-2 text-sm font-black text-bronze transition hover:text-terracotta disabled:cursor-wait disabled:opacity-70";

  async function openStorageAttachment() {
    if (!storagePath) {
      return;
    }

    const popup = window.open("", "_blank", "noopener,noreferrer");
    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      popup?.close();
      return;
    }

    setIsOpening(true);

    try {
      const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(storagePath, 10 * 60);

      if (error || !data.signedUrl) {
        console.warn("maya_attachment_signed_url_failed", {
          bucket: ATTACHMENT_BUCKET,
          code: error?.name,
          message: error?.message
        });
        popup?.close();
        return;
      }

      if (popup) {
        popup.location.href = data.signedUrl;
      } else {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsOpening(false);
    }
  }

  if (dataUrl) {
    return (
      <a href={dataUrl} target="_blank" rel="noreferrer" className={baseClassName}>
        <FileImage className="size-4" aria-hidden="true" />
        Ver anexo
      </a>
    );
  }

  if (storagePath) {
    return (
      <button type="button" onClick={() => void openStorageAttachment()} disabled={isOpening} className={baseClassName}>
        <FileImage className="size-4" aria-hidden="true" />
        {isOpening ? "Abrindo anexo..." : "Ver anexo"}
      </button>
    );
  }

  return imageName ? <p className="mt-3 text-sm font-bold text-muted">Anexo salvo: {imageName}</p> : null;
}
