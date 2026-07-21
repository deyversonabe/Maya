import { NextResponse } from "next/server";
import { ADMIN_WORKSPACE_ID, requireWorkspaceAdmin } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await requireWorkspaceAdmin(request);

  if (!context.ok) {
    return context.response;
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    status?: "active" | "blocked";
  } | null;

  const userId = body?.userId?.trim();
  const status = body?.status;

  if (!userId || (status !== "active" && status !== "blocked")) {
    return NextResponse.json({ ok: false, message: "Dados invalidos para atualizar usuario." }, { status: 400 });
  }

  if (userId === context.user.id && status === "blocked") {
    return NextResponse.json({ ok: false, message: "Voce nao pode bloquear o proprio administrador." }, { status: 400 });
  }

  const { error } = await context.supabase
    .from("finance_workspace_members")
    .update({
      status,
      blocked_at: status === "blocked" ? new Date().toISOString() : null,
      blocked_by: status === "blocked" ? context.user.id : null
    })
    .eq("workspace_id", ADMIN_WORKSPACE_ID)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "Nao foi possivel atualizar o usuario. Confira a migration administrativa." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
