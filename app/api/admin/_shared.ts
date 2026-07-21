import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServiceClient, getBearerToken } from "@/lib/supabase/server";

export const ADMIN_WORKSPACE_ID =
  process.env.MAYA_WORKSPACE_ID ||
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID ||
  "00000000-0000-4000-8000-000000000001";

type AdminContext =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireWorkspaceAdmin(request: Request): Promise<AdminContext> {
  const supabase = createSupabaseServiceClient();
  const token = getBearerToken(request);

  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Painel admin precisa da service role do Supabase configurada." },
        { status: 503 }
      )
    };
  }

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "Acesso nao autenticado." }, { status: 401 })
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "Sessao invalida." }, { status: 401 })
    };
  }

  const { data: member, error: memberError } = await supabase
    .from("finance_workspace_members")
    .select("role,status")
    .eq("workspace_id", ADMIN_WORKSPACE_ID)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (memberError) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "A migration administrativa ainda nao foi aplicada no Supabase." },
        { status: 503 }
      )
    };
  }

  if (!member || member.role !== "admin" || (member.status && member.status !== "active")) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "Somente administrador pode acessar esta acao." }, { status: 403 })
    };
  }

  return {
    ok: true,
    supabase,
    user: data.user
  };
}
