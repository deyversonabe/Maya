import { AlertTriangle, BellRing, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { FinancialHealthAlert } from "../types";

export function FinancialHealthAlerts({ alerts }: { alerts: FinancialHealthAlert[] }) {
  return (
    <Card>
      <CardHeader
        eyebrow="Saude em tempo real"
        title="Alertas da MAYA"
        action={<Badge tone={alerts.length > 0 ? "warning" : "success"}>{alerts.length}</Badge>}
      />

      <div className="grid gap-3">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-emerald-100">
              <TrendingUp className="size-4" aria-hidden="true" />
              <strong>Rotina sem alerta fora do padrao</strong>
            </div>
            <p className="text-sm leading-6 text-muted">
              A MAYA segue acompanhando entradas e saidas conforme os dados forem salvos.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {alert.priority === "info" ? (
                  <BellRing className="size-4 text-cyan-100" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-100" aria-hidden="true" />
                )}
                <Badge tone={alert.priority === "info" ? "info" : "warning"}>{alert.title}</Badge>
              </div>
              <p className="text-sm leading-6 text-amber-50">{alert.message}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
