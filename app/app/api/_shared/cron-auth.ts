import { NextResponse } from "next/server";

export function requireCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Segredo do cron nao configurado." }, { status: 503 })
    };
  }

  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${secret}`) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Rotina nao autorizada." }, { status: 401 })
    };
  }

  return { ok: true as const };
}
