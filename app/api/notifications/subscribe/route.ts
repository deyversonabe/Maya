import { NextResponse } from "next/server";
import { createSupabaseBearerClient, getBearerToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const WORKSPACE_ID =
  process.env.MAYA_WORKSPACE_ID ||
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID ||
  "00000000-0000-4000-8000-000000000001";

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(request: Request) {
  const token = getBearerToken(request);
  const supabase = token ? createSupabaseBearerClient(token) : null;

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Push precisa de Supabase configurado." }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, message: "Entre na sua conta para ativar push." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as PushSubscriptionPayload | null;
  const endpoint = payload?.endpoint;
  const p256dh = payload?.keys?.p256dh;
  const auth = payload?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, message: "Inscricao push invalida." }, { status: 400 });
  }

  const { error } = await supabase.from("finance_push_subscriptions").upsert(
    {
      workspace_id: WORKSPACE_ID,
      user_id: userData.user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent") ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, message: "A tabela de push ainda nao foi criada no Supabase." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
