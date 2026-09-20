/**
 * Aceita somente URLs assinadas do Storage do proprio projeto Supabase.
 * O navegador gera a URL temporaria depois do upload direto; a Function recebe
 * apenas uma URL curta em vez do PDF em base64, evitando o limite de payload.
 */
export function normalizeAllowedAttachmentUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const attachmentBucket = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET || "maya-finance-attachments";

  if (!configuredSupabaseUrl) {
    return undefined;
  }

  try {
    const candidate = new URL(value);
    const supabase = new URL(configuredSupabaseUrl);

    if (candidate.protocol !== "https:" || candidate.hostname !== supabase.hostname) {
      return undefined;
    }

    const expectedPathPrefix = `/storage/v1/object/sign/${attachmentBucket}/`;

    if (!candidate.pathname.startsWith(expectedPathPrefix) || !candidate.searchParams.get("token")) {
      return undefined;
    }

    if (!candidate.pathname.toLowerCase().endsWith(".pdf")) {
      return undefined;
    }

    return candidate.toString();
  } catch {
    return undefined;
  }
}
