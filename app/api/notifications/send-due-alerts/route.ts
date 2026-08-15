import { NextResponse } from "next/server";
import webpush from "web-push";
import { requireCronSecret } from "@/app/api/_shared/cron-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildBillAlerts, buildFinancialHealthAlerts } from "@/modules/finance/lib/calculations";
import { migrateFinanceState } from "@/modules/finance/lib/migrations";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BILL_ALERTS = 20;
const MAX_ALERTS_PER_RUN = 25;

type WorkspaceStateRow = {
  workspace_id: string;
  state: unknown;
};

type PushSubscriptionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function GET(request: Request) {
  return sendPushAlerts(request);
}

export async function POST(request: Request) {
  return sendPushAlerts(request);
}

async function sendPushAlerts(request: Request) {
  const cron = requireCronSecret(request);

  if (!cron.ok) {
    return cron.response;
  }

  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Service role do Supabase ausente." }, { status: 503 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:deyversonsilvaf@gmail.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ ok: false, message: "Chaves VAPID de push nao configuradas." }, { status: 503 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const [{ data: states, error: statesError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase.from("finance_workspace_states").select("workspace_id, state"),
    supabase
      .from("finance_push_subscriptions")
      .select("id, workspace_id, user_id, endpoint, p256dh, auth")
      .eq("enabled", true)
  ]);

  if (statesError || subscriptionsError) {
    return NextResponse.json(
      { ok: false, message: "Tabelas de estado ou push ainda nao estao prontas." },
      { status: 503 }
    );
  }

  const subscriptionsByWorkspace = ((subscriptions ?? []) as PushSubscriptionRow[]).reduce<Record<string, PushSubscriptionRow[]>>(
    (groups, subscription) => {
      groups[subscription.workspace_id] = [...(groups[subscription.workspace_id] ?? []), subscription];
      return groups;
    },
    {}
  );
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  for (const row of (states ?? []) as WorkspaceStateRow[]) {
    const state = migrateFinanceState(row.state);
    const alerts = [
      ...buildBillAlerts(state.bills).slice(0, MAX_BILL_ALERTS),
      ...buildFinancialHealthAlerts(state)
    ].slice(0, MAX_ALERTS_PER_RUN);
    const workspaceSubscriptions = subscriptionsByWorkspace[row.workspace_id] ?? [];

    for (const subscription of workspaceSubscriptions) {
      for (const alert of alerts) {
        const alertKey = `${today}_${alert.id}`;
        const delivery = await supabase.from("finance_push_deliveries").insert({
          workspace_id: row.workspace_id,
          subscription_id: subscription.id,
          alert_key: alertKey,
          delivered_on: today
        });

        if (delivery.error) {
          if (delivery.error.code === "23505") {
            skipped += 1;
            continue;
          }

          failed += 1;
          console.error("Erro ao registrar entrega de push da Maya.", delivery.error);
          continue;
        }

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            JSON.stringify({
              title: alert.title,
              body: alert.message,
              url: "/bills",
              tag: `maya_${alert.id}`,
              icon: "/brand/maya-icon-192.png",
              badge: "/brand/maya-icon-192.png"
            })
          );
          sent += 1;
        } catch (error) {
          failed += 1;
          const statusCode = getWebPushStatusCode(error);

          if (statusCode === 404 || statusCode === 410) {
            await supabase
              .from("finance_push_subscriptions")
              .update({ enabled: false })
              .eq("id", subscription.id);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}

function getWebPushStatusCode(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(statusCode) ? statusCode : 0;
  }

  return 0;
}
