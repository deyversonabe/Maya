"use client";

import { useEffect, useState } from "react";
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
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath || dataUrl) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    let isMounted = true;

    if (!supabase) {
      return;
    }

    void supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(storagePath, 10 * 60)
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          console.warn("maya_attachment_signed_url_failed", {
            bucket: ATTACHMENT_BUCKET,
            code: error.name,
            message: error.message
          });
          setSignedUrl(null);
          return;
        }

        setSignedUrl(data.signedUrl);
      });

    return () => {
      isMounted = false;
    };
  }, [dataUrl, storagePath]);

  const href = dataUrl || signedUrl;

  if (!href) {
    return imageName ? (
      <p className="mt-3 text-sm font-bold text-muted">Anexo salvo: {imageName}</p>
    ) : null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        className ??
        "mt-3 inline-flex items-center gap-2 text-sm font-black text-bronze transition hover:text-terracotta"
      }
    >
      <FileImage className="size-4" aria-hidden="true" />
      Ver anexo
    </a>
  );
}
