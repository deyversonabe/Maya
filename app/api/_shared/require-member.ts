import { NextResponse } from "next/server";
import { createSupabaseBearerClient, createSupabaseServiceClient, getBearerToken } from "@/lib/supabase/server";

const WORKSPACE_ID =
  process.env.MAYA_WORKSPACE_ID ||
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID ||
  "00000000-0000-4000-8000-000000000001";

export async function requireWorkspaceMember(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Acesso nao autenticado." }, { status: 401 })
    };
  }

  const serviceClient = createSupabaseServiceClient();
  const bearerClient = createSupabaseBearerClient(token);
  const authClient = serviceClient ?? bearerClient;

  if (!authClient || !bearerClient) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Supabase nao configurado para validar acesso." }, { status: 503 })
    };
  }

  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 })
    };
  }

  const memberClient = serviceClient ?? bearerClient;
  const { data: member, error: memberError } = await memberClient
    .from("finance_workspace_members")
    .select("role,status")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memberError) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Nao foi possivel validar permissao da workspace." }, { status: 503 })
    };
  }

  if (!member || (member.status && member.status !== "active")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Conta nao autorizada para usar a MAYA." }, { status: 403 })
    };
  }

  return {
    ok: true as const,
    user: userData.user,
    role: member.role as string | null
  };
}
