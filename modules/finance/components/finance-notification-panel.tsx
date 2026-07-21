"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillAlert, FinancialHealthAlert } from "../types";

const NOTIFIED_KEY = "maya.finance.notified_alerts.v1";

export function FinanceNotificationPanel({
  billAlerts,
  healthAlerts
}: {
  billAlerts: BillAlert[];
  healthAlerts?: FinancialHealthAlert[];
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (permission !== "granted") {
      return;
    }

    const notified = readNotifiedKeys();
    const today = new Date().toISOString().slice(0, 10);

    [...billAlerts, ...(healthAlerts ?? []).map(mapHealthAlert)]
      .filter((alert) => !notified.has(`${today}_${alert.id}`))
      .slice(0, 4)
      .forEach((alert) => {
        new Notification(alert.title, {
          body: alert.message,
          icon: "/brand/maya-favicon.png",
          badge: "/brand/maya-favicon.png",
          tag: `maya_${alert.id}`
        });
        notified.add(`${today}_${alert.id}`);
      });

    window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(notified).slice(-120)));
  }, [billAlerts, healthAlerts, permission]);

  async function requestPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  if (permission === "unsupported") {
    return (
      <p className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
        Este navegador nao permite notificacoes locais. Os alertas continuam visiveis na tela de contas.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <div className="mb-3 flex items-center gap-2 text-cyan-50">
        <BellRing className="size-4" aria-hidden="true" />
        <strong>Notificacoes no aparelho</strong>
      </div>
      <p className="text-sm leading-6 text-cyan-100">
        {permission === "granted"
          ? "Ativas para avisos de vencimento e alertas financeiros enquanto o navegador permitir."
          : "Ative para receber avisos do navegador sobre contas vencendo, vencendo hoje ou atrasadas."}
      </p>
      {permission !== "granted" ? (
        <Button className="mt-3" variant="secondary" onClick={() => void requestPermission()}>
          <BellRing className="size-4" aria-hidden="true" />
          Ativar notificacoes
        </Button>
      ) : null}
    </div>
  );
}

function readNotifiedKeys() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFIED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function mapHealthAlert(alert: FinancialHealthAlert): BillAlert {
  return {
    id: alert.id,
    bill: {
      id: alert.id,
      title: alert.title,
      amount: 0,
      category: "MAYA",
      person: "Casal",
      dueDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "other",
      recurrence: "none",
      status: "pending",
      source: "manual",
      createdAt: alert.createdAt
    },
    type: "due_soon",
    title: alert.title,
    message: alert.message,
    priority: alert.priority,
    triggerAt: alert.createdAt
  };
}
