import { NextResponse } from "next/server";
import { requireCronSecret } from "@/app/api/_shared/cron-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { migrateFinanceState } from "@/modules/finance/lib/migrations";
import { collectFinanceAttachmentPaths, findOrphanAttachmentPaths } from "@/modules/finance/lib/orphan-attachments";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ATTACHMENT_BUCKET = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET || "maya-finance-attachments";
const MAX_FILES_PER_PREFIX = 1000;
const MAX_REMOVALS_PER_RUN = 50;

type WorkspaceStateRow = {
  workspace_id: string;
  state: unknown;
};

export async function POST(request: Request) {
  const cron = requireCronSecret(request);

  if (!cron.ok) {
    return cron.response;
  }

  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Service role do Supabase ausente." }, { status: 503 });
  }

  const { data: states, error } = await supabase.from("finance_workspace_states").select("workspace_id, state");

  if (error) {
    return NextResponse.json({ ok: false, message: "Nao foi possivel ler estados financeiros." }, { status: 503 });
  }

  let inspected = 0;
  let removed = 0;
  const failed: string[] = [];

  for (const row of (states ?? []) as WorkspaceStateRow[]) {
    const state = migrateFinanceState(row.state);
    const knownPaths = collectFinanceAttachmentPaths(state);
    const storagePaths = await listWorkspaceStoragePaths(supabase, row.workspace_id);
    const orphans = findOrphanAttachmentPaths({
      knownPaths,
      storagePaths,
      max: Math.max(0, MAX_REMOVALS_PER_RUN - removed)
    });

    inspected += storagePaths.length;

    if (orphans.length === 0) {
      continue;
    }

    const { error: removeError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove(orphans);

    if (removeError) {
      failed.push(...orphans);
      continue;
    }

    removed += orphans.length;

    if (removed >= MAX_REMOVALS_PER_RUN) {
      break;
    }
  }

  return NextResponse.json({ ok: true, inspected, removed, failed });
}

async function listWorkspaceStoragePaths(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  workspaceId: string
) {
  const { data: folders, error } = await supabase.storage.from(ATTACHMENT_BUCKET).list(workspaceId, {
    limit: MAX_FILES_PER_PREFIX,
    sortBy: { column: "created_at", order: "asc" }
  });

  if (error || !folders) {
    return [];
  }

  const paths: string[] = [];

  for (const folder of folders) {
    if (!folder.name) {
      continue;
    }

    const prefix = `${workspaceId}/${folder.name}`;
    const { data: files } = await supabase.storage.from(ATTACHMENT_BUCKET).list(prefix, {
      limit: MAX_FILES_PER_PREFIX,
      sortBy: { column: "created_at", order: "asc" }
    });

    for (const file of files ?? []) {
      if (file.name) {
        paths.push(`${prefix}/${file.name}`);
      }
    }
  }

  return paths;
}
