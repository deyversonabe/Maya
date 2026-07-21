import { NextResponse } from "next/server";
import { ADMIN_WORKSPACE_ID, requireWorkspaceAdmin } from "../_shared";

export const dynamic = "force-dynamic";

type WorkspaceMemberRow = {
  user_id: string;
  role: "admin" | "member";
  status?: "active" | "blocked";
  display_name?: string | null;
  recovery_email?: string | null;
  last_seen_at?: string | null;
  blocked_at?: string | null;
  created_at?: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  enabled: boolean;
  last_seen_at: string | null;
  created_at: string | null;
};

export async function GET(request: Request) {
  const context = await requireWorkspaceAdmin(request);

  if (!context.ok) {
    return context.response;
  }

  const { supabase } = context;

  const [{ data: members, error: membersError }, usersResult, stateResult, pushResult] = await Promise.all([
    supabase
      .from("finance_workspace_members")
      .select("user_id, role, status, display_name, recovery_email, last_seen_at, blocked_at, created_at")
      .eq("workspace_id", ADMIN_WORKSPACE_ID)
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase
      .from("finance_workspace_states")
      .select("state, updated_at, updated_by")
      .eq("workspace_id", ADMIN_WORKSPACE_ID)
      .maybeSingle(),
    supabase
      .from("finance_push_subscriptions")
      .select("id, user_id, endpoint, enabled, last_seen_at, created_at")
      .eq("workspace_id", ADMIN_WORKSPACE_ID)
  ]);

  if (membersError) {
    return NextResponse.json(
      { ok: false, message: "A migration administrativa ainda nao foi aplicada no Supabase." },
      { status: 503 }
    );
  }

  const authUsers = usersResult.data?.users ?? [];
  const userEmailById = new Map(authUsers.map((user) => [user.id, user.email ?? "sem e-mail"]));
  const memberRows = (members ?? []) as WorkspaceMemberRow[];
  const pushRows = Array.isArray(pushResult.data) ? (pushResult.data as PushSubscriptionRow[]) : [];
  const state = stateResult.data?.state as Record<string, unknown> | null | undefined;

  return NextResponse.json(
    {
      ok: true,
      workspaceId: ADMIN_WORKSPACE_ID,
      members: memberRows.map((member) => ({
        userId: member.user_id,
        email: userEmailById.get(member.user_id) ?? "usuario nao encontrado",
        displayName: member.display_name ?? "",
        recoveryEmail: member.recovery_email ?? "",
        role: member.role,
        status: member.status ?? "active",
        lastSeenAt: member.last_seen_at ?? null,
        blockedAt: member.blocked_at ?? null,
        createdAt: member.created_at ?? null,
        pushSubscriptions: pushRows.filter((subscription) => subscription.user_id === member.user_id).length
      })),
      sync: {
        updatedAt: stateResult.data?.updated_at ?? null,
        updatedBy: stateResult.data?.updated_by ?? null,
        configured: !stateResult.error
      },
      push: {
        configured: !pushResult.error,
        publicKeyConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        privateKeyConfigured: Boolean(process.env.VAPID_PRIVATE_KEY),
        subjectConfigured: Boolean(process.env.VAPID_SUBJECT),
        subscriptions: pushRows.map((subscription) => ({
          id: subscription.id,
          userId: subscription.user_id,
          enabled: subscription.enabled,
          lastSeenAt: subscription.last_seen_at,
          createdAt: subscription.created_at
        }))
      },
      data: {
        transactions: Array.isArray(state?.transactions) ? state.transactions.length : 0,
        bills: Array.isArray(state?.bills) ? state.bills.length : 0,
        goals: Array.isArray(state?.goals) ? state.goals.length : 0,
        budgets: Array.isArray(state?.budgets) ? state.budgets.length : 0,
        activityLogs: Array.isArray(state?.activityLogs) ? state.activityLogs.length : 0
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
