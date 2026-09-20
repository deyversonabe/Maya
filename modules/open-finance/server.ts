import { createSupabaseServiceClient } from "@/lib/supabase/server";

const WORKSPACE_ID =
  process.env.MAYA_WORKSPACE_ID ||
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID ||
  "00000000-0000-4000-8000-000000000001";

export interface OpenFinanceItemRecord {
  itemId: string;
  provider: "pluggy";
  connectorName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export async function listOpenFinanceItems() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("open_finance_store_unavailable");
  const { data, error } = await supabase
    .from("finance_open_finance_items")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapItem);
}

export async function hasOpenFinanceItem(itemId: string) {
  if (!itemId.trim()) return false;
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("open_finance_store_unavailable");
  const { data, error } = await supabase
    .from("finance_open_finance_items")
    .select("item_id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("provider", "pluggy")
    .eq("item_id", itemId.trim())
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.item_id);
}

export async function upsertOpenFinanceItem(input: { itemId: string; connectorName?: string; status?: string; clientUserId?: string }) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("open_finance_store_unavailable");
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("finance_open_finance_items").upsert({
    workspace_id: WORKSPACE_ID,
    item_id: input.itemId,
    provider: "pluggy",
    connector_name: input.connectorName || null,
    client_user_id: input.clientUserId || null,
    status: input.status || "connected",
    last_synced_at: now,
    updated_at: now
  }, { onConflict: "workspace_id,provider,item_id" }).select("*").single();
  if (error) throw error;
  return mapItem(data);
}

export async function updateOpenFinanceItemFromWebhook(input: { itemId: string; event: string }) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;
  const status = input.event.includes("error") ? "error" : input.event.includes("deleted") ? "deleted" : input.event.includes("waiting") ? "attention" : "connected";
  await supabase.from("finance_open_finance_items").update({
    status,
    last_event: input.event,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("workspace_id", WORKSPACE_ID).eq("provider", "pluggy").eq("item_id", input.itemId);
}

function mapItem(row: Record<string, unknown>): OpenFinanceItemRecord {
  return {
    itemId: String(row.item_id),
    provider: "pluggy",
    connectorName: typeof row.connector_name === "string" ? row.connector_name : undefined,
    status: String(row.status ?? "connected"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastSyncedAt: typeof row.last_synced_at === "string" ? row.last_synced_at : undefined
  };
}
