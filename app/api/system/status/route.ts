import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      maya: {
        available: true,
        level: Boolean(process.env.OPENAI_API_KEY) ? "advanced" : "essential"
      },
      backup: {
        available: true
      },
      whatsapp: {
        available: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
      },
      connections: {
        status: "future",
        message: "Conexoes financeiras futuras dependerao de autorizacao clara."
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
