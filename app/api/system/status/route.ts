import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/app/api/admin/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireWorkspaceAdmin(request);
  if (!access.ok) return access.response;

  return NextResponse.json(
    {
      maya: {
        available: true,
        level: Boolean(process.env.OPENAI_API_KEY) ? "advanced" : "essential"
      },
      backup: {
        available: true
      },
      reports: {
        pdf: true,
        excel: true
      },
      sync: {
        available: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
      },
      admin: {
        available: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      },
      push: {
        available: Boolean(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
            process.env.VAPID_PRIVATE_KEY &&
            process.env.VAPID_SUBJECT &&
            process.env.CRON_SECRET
        )
      },
      storage: {
        bucket: process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET || "maya-finance-attachments",
        available: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
      },
      pwa: {
        available: true,
        cache: "static-assets-only"
      },
      whatsapp: {
        available: Boolean(
          process.env.WHATSAPP_ENABLED === "true" &&
            process.env.WHATSAPP_ACCESS_TOKEN &&
            process.env.WHATSAPP_PHONE_NUMBER_ID
        )
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
