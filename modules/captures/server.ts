import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { CaptureDraft, CaptureKind, CaptureSource, CaptureValidationReport, FinanceCaptureRecord } from "./types";

const WORKSPACE_ID =
  process.env.MAYA_WORKSPACE_ID ||
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID ||
  "00000000-0000-4000-8000-000000000001";

export async function createFinanceCapture(input: {
  source: CaptureSource;
  sourceRef?: string;
  sender?: string;
  kind: CaptureKind;
  title: string;
  rawText?: string;
  draft: CaptureDraft;
  validation: CaptureValidationReport;
  attachmentName?: string;
  attachmentMimeType?: string;
}) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("capture_store_unavailable");

  const payload = {
    workspace_id: WORKSPACE_ID,
    source: input.source,
    source_ref: input.sourceRef || null,
    sender: input.sender || null,
    kind: input.kind,
    status: "pending",
    validation_status: input.validation.status,
    validation_score: input.validation.score,
    title: input.title,
    raw_text: input.rawText || null,
    draft: input.draft,
    validation: input.validation,
    attachment_name: input.attachmentName || null,
    attachment_mime_type: input.attachmentMimeType || null
  };

  const query = supabase.from("finance_capture_inbox").insert(payload).select("*").single();
  const { data, error } = await query;

  if (error) {
    if (input.sourceRef && error.code === "23505") {
      const existing = await supabase
        .from("finance_capture_inbox")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("source", input.source)
        .eq("source_ref", input.sourceRef)
        .maybeSingle();
      if (existing.error || !existing.data) throw error;
      return mapCaptureRow(existing.data);
    }
    throw error;
  }

  return mapCaptureRow(data);
}

export async function listFinanceCaptures(options?: { status?: string; limit?: number }) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("capture_store_unavailable");

  await expireStaleCaptures(supabase);

  let query = supabase
    .from("finance_capture_inbox")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(options?.limit ?? 100, 200)));

  if (options?.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapCaptureRow);
}

export async function updateFinanceCapture(
  id: string,
  patch: {
    status?: "pending" | "confirmed" | "discarded" | "expired";
    draft?: CaptureDraft;
    validation?: CaptureValidationReport;
    confirmedBy?: string;
  }
) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("capture_store_unavailable");

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.draft) update.draft = patch.draft;
  if (patch.validation) {
    update.validation = patch.validation;
    update.validation_status = patch.validation.status;
    update.validation_score = patch.validation.score;
  }
  if (patch.status === "confirmed") {
    update.confirmed_at = new Date().toISOString();
    update.confirmed_by = patch.confirmedBy || null;
  }

  const { data, error } = await supabase
    .from("finance_capture_inbox")
    .update(update)
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCaptureRow(data);
}

export async function getFinanceCapture(id: string) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("capture_store_unavailable");
  await expireStaleCaptures(supabase);
  const { data, error } = await supabase
    .from("finance_capture_inbox")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCaptureRow(data) : null;
}

async function expireStaleCaptures(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  if (!supabase) return;
  const { error } = await supabase
    .from("finance_capture_inbox")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("workspace_id", WORKSPACE_ID)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  if (error) throw error;
}

function mapCaptureRow(row: Record<string, unknown>): FinanceCaptureRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    source: row.source as FinanceCaptureRecord["source"],
    sourceRef: nullableString(row.source_ref),
    sender: nullableString(row.sender),
    kind: row.kind as FinanceCaptureRecord["kind"],
    status: row.status as FinanceCaptureRecord["status"],
    validationStatus: row.validation_status as FinanceCaptureRecord["validationStatus"],
    validationScore: Number(row.validation_score ?? 0),
    title: String(row.title ?? "Captura"),
    rawText: nullableString(row.raw_text),
    draft: row.draft as CaptureDraft,
    validation: row.validation as CaptureValidationReport,
    attachmentName: nullableString(row.attachment_name),
    attachmentMimeType: nullableString(row.attachment_mime_type),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    expiresAt: String(row.expires_at),
    confirmedAt: nullableString(row.confirmed_at)
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}
