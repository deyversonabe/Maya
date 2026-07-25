"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  UnlockKeyhole,
  Users
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { financialValueClass, formatCurrency, formatPercent, toInputDate } from "@/lib/utils";
import { exportFinanceReportExcel, exportFinanceReportJson, exportFinanceReportPdf } from "../lib/report-export";
import { createCurrentMonthReportPeriod, createMonthReportPeriod, buildFinanceReport, type FinanceReportPeriod } from "../lib/reporting";
import { isPushAvailable, registerCurrentDeviceForPush } from "../lib/push-client";
import { buildDataQualityReport } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";

type AdminOverview = {
  ok: boolean;
  message?: string;
  workspaceId: string;
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    recoveryEmail: string;
    role: "admin" | "member";
    status: "active" | "blocked";
    lastSeenAt: string | null;
    blockedAt: string | null;
    createdAt: string | null;
    pushSubscriptions: number;
  }>;
  sync: {
    updatedAt: string | null;
    updatedBy: string | null;
    configured: boolean;
  };
  push: {
    configured: boolean;
    publicKeyConfigured: boolean;
    privateKeyConfigured: boolean;
    subjectConfigured: boolean;
    subscriptions: Array<{
      id: string;
      userId: string;
      enabled: boolean;
      lastSeenAt: string | null;
      createdAt: string | null;
    }>;
  };
  data: {
    transactions: number;
    bills: number;
    goals: number;
    budgets: number;
    activityLogs: number;
  };
};

type PeriodMode = "month" | "custom";

export function AdminPage() {
  const { state, cloud } = useFinanceStore();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [feedback, setFeedback] = useState("Painel pronto para administracao, relatorios e notificacoes.");
  const [isLoading, setIsLoading] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(() => toInputDate(new Date()));
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const quality = useMemo(() => buildDataQualityReport(state), [state]);
  const reportPeriod = useMemo(() => buildSelectedPeriod(periodMode, month, startDate, endDate), [endDate, month, periodMode, startDate]);
  const report = useMemo(() => buildFinanceReport(state, reportPeriod), [reportPeriod, state]);

  const loadOverview = useCallback(async () => {
    if (!supabase) {
      setFeedback("Supabase precisa estar configurado para abrir o painel admin.");
      return;
    }

    setIsLoading(true);

    try {
      const token = await getAccessToken(supabase);
      const response = await fetch("/api/admin/overview", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const result = (await response.json()) as AdminOverview;

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Nao consegui carregar o painel admin.");
      }

      setOverview(result);
      setFeedback("Painel admin atualizado.");
    } catch (error) {
      setOverview(null);
      setFeedback(error instanceof Error ? error.message : "Nao consegui carregar o painel admin.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function changeMemberStatus(userId: string, status: "active" | "blocked") {
    if (!supabase) {
      return;
    }

    setIsLoading(true);

    try {
      const token = await getAccessToken(supabase);
      const response = await fetch("/api/admin/member-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, status })
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Nao consegui atualizar o usuario.");
      }

      setFeedback(status === "blocked" ? "Usuario bloqueado." : "Usuario reativado.");
      await loadOverview();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao consegui atualizar o usuario.");
    } finally {
      setIsLoading(false);
    }
  }

  async function enablePush() {
    if (!supabase) {
      setFeedback("Supabase precisa estar configurado para salvar o aparelho.");
      return;
    }

    try {
      const endpoint = await registerCurrentDeviceForPush(supabase);
      setFeedback(`Push real ativado neste aparelho: ${endpoint.slice(0, 42)}...`);
      await loadOverview();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao consegui ativar push real.");
    }
  }

  async function exportPdf() {
    await exportFinanceReportPdf(report);
    setFeedback("Relatorio PDF gerado.");
  }

  async function exportExcel() {
    await exportFinanceReportExcel(report);
    setFeedback("Planilha Excel gerada.");
  }

  function exportJson() {
    exportFinanceReportJson(report);
    setFeedback("Backup JSON do periodo gerado.");
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="cyan">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="eyebrow">Painel admin</p>
            <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze">
              Controle, relatorios e notificacoes.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Administre usuarios autorizados, acompanhe a saude da sincronizacao, gere relatorios profissionais e salve este aparelho para push real.
            </p>
          </div>
          <div className="rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Qualidade da base</p>
            <strong className="mt-2 block font-serif text-5xl text-bronze">{quality.score}/100</strong>
            <p className="mt-2 text-sm font-bold text-cream">{quality.label}</p>
          </div>
        </div>
      </LedPanel>

      <p className="mb-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
        {feedback}
      </p>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <Card>
            <CardHeader
              eyebrow="Usuarios"
              title="Acessos autorizados"
              action={
                <Button variant="secondary" onClick={() => void loadOverview()} disabled={isLoading}>
                  <RefreshCcw className="size-4" aria-hidden="true" />
                  Atualizar
                </Button>
              }
            />

            {!overview ? (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
                {isLoading ? "Carregando usuarios..." : "Aplique a migration admin/push no Supabase e configure a service role na Vercel para habilitar este painel."}
              </p>
            ) : (
              <div className="grid gap-3">
                {overview.members.map((member) => (
                  <div key={member.userId} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Users className="size-4 text-neon-cyan" aria-hidden="true" />
                          <strong className="text-cream">{member.displayName || member.email}</strong>
                          <Badge tone={member.role === "admin" ? "info" : "neutral"}>{member.role === "admin" ? "Admin" : "Usuario"}</Badge>
                          <Badge tone={member.status === "active" ? "success" : "warning"}>{member.status === "active" ? "Ativo" : "Bloqueado"}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted">
                          {member.email} - ultimo acesso: {formatDateTime(member.lastSeenAt)} - push: {member.pushSubscriptions}
                        </p>
                        {member.recoveryEmail ? <p className="text-sm leading-6 text-muted">Recuperacao: {member.recoveryEmail}</p> : null}
                      </div>

                      <Button
                        variant={member.status === "active" ? "danger" : "secondary"}
                        onClick={() => void changeMemberStatus(member.userId, member.status === "active" ? "blocked" : "active")}
                        disabled={isLoading}
                      >
                        {member.status === "active" ? <LockKeyhole className="size-4" /> : <UnlockKeyhole className="size-4" />}
                        {member.status === "active" ? "Bloquear" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Relatorios" title="Exportacao profissional" action={<Badge tone="success">PDF + Excel</Badge>} />
            <div className="grid gap-3 md:grid-cols-3">
              <Label>
                Periodo
                <Select value={periodMode} onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}>
                  <option value="month">Mes</option>
                  <option value="custom">Datas</option>
                </Select>
              </Label>
              {periodMode === "month" ? (
                <Label>
                  Mes
                  <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
                </Label>
              ) : (
                <>
                  <Label>
                    Inicio
                    <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </Label>
                  <Label>
                    Fim
                    <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </Label>
                </>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <ReportMetric label="Renda" value={report.summary.income} />
              <ReportMetric label="Despesa" value={report.summary.expenses} />
              <ReportMetric label="Saldo" value={report.summary.balance} />
              <ReportMetric label="Atrasos" value={report.summary.overdueBills} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void exportPdf()}>
                <FileText className="size-4" aria-hidden="true" />
                PDF
              </Button>
              <Button variant="secondary" onClick={() => void exportExcel()}>
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                Excel
              </Button>
              <Button variant="ghost" onClick={exportJson}>
                <FileJson className="size-4" aria-hidden="true" />
                JSON
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Push real" title="Alertas com app fechado" action={<Badge tone={overview?.push.configured ? "success" : "warning"}>{overview?.push.configured ? "Tabela pronta" : "Configurar"}</Badge>} />
            <div className="grid gap-3 md:grid-cols-3">
              <StatusBox label="Navegador" value={isPushAvailable() ? "Compativel" : "Sem suporte"} tone={isPushAvailable() ? "success" : "warning"} />
              <StatusBox label="Chave publica" value={overview?.push.publicKeyConfigured ? "OK" : "Pendente"} tone={overview?.push.publicKeyConfigured ? "success" : "warning"} />
              <StatusBox label="Aparelhos" value={String(overview?.push.subscriptions.length ?? 0)} tone={(overview?.push.subscriptions.length ?? 0) > 0 ? "success" : "neutral"} />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              O push real depende da migration de notificacoes, chaves VAPID e rotina agendada na Vercel. Depois de ativar, a Maya pode avisar contas a vencer mesmo com o app fechado.
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => void enablePush()}>
              <BellRing className="size-4" aria-hidden="true" />
              Salvar este aparelho para push
            </Button>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="Sincronizacao" title="Saude da nuvem" />
            <div className="grid gap-3">
              <StatusLine icon={<Database />} label="Supabase" value={cloud.isConfigured ? "Configurado" : "Pendente"} />
              <StatusLine icon={<Activity />} label="Estado online" value={cloud.status} />
              <StatusLine icon={<ShieldCheck />} label="Conta atual" value={cloud.email ?? "sem login"} />
              <StatusLine icon={<Smartphone />} label="Ultimo sync" value={overview?.sync.updatedAt ? formatDateTime(overview.sync.updatedAt) : "sem leitura"} />
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Dados" title="Volume atual" />
            <div className="grid gap-3">
              <StatusLine icon={<Database />} label="Transacoes" value={String(overview?.data.transactions ?? state.transactions.length)} />
              <StatusLine icon={<Database />} label="Contas" value={String(overview?.data.bills ?? state.bills.length)} />
              <StatusLine icon={<Database />} label="Metas" value={String(overview?.data.goals ?? state.goals.length)} />
              <StatusLine icon={<Database />} label="Orcamentos" value={String(overview?.data.budgets ?? state.budgets.length)} />
              <StatusLine icon={<Activity />} label="Logs" value={String(overview?.data.activityLogs ?? state.activityLogs.length)} />
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="SaaS" title="Base relacional" action={<Badge tone="info">Preparada</Badge>} />
            <p className="text-sm leading-6 text-muted">
              A nova migration cria tabelas relacionais para transacoes, contas, metas, anexos e push. O estado JSONB compartilhado continua ativo para manter o app estavel enquanto a migracao completa acontece por etapas.
            </p>
          </Card>

          <Card>
            <Button className="w-full" onClick={exportJson}>
              <Download className="size-4" aria-hidden="true" />
              Exportar backup do periodo
            </Button>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function buildSelectedPeriod(mode: PeriodMode, month: string, start: string, end: string): FinanceReportPeriod {
  if (mode === "month") {
    return month ? createMonthReportPeriod(month) : createCurrentMonthReportPeriod();
  }

  const orderedStart = start <= end ? start : end;
  const orderedEnd = start <= end ? end : start;

  return {
    start: orderedStart,
    end: orderedEnd,
    label: `${orderedStart}_a_${orderedEnd}`
  };
}

async function getAccessToken(supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Entre novamente para acessar o painel admin.");
  }

  return token;
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neon-cyan/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={`mt-2 block text-xl ${financialValueClass(value)}`}>{formatCurrency(value)}</strong>
    </div>
  );
}

function StatusBox({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "neutral" }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <Badge className="mt-2" tone={tone === "success" ? "success" : tone === "warning" ? "warning" : "neutral"}>{value}</Badge>
    </div>
  );
}

function StatusLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cream/10 bg-cream/[0.04] p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-neon-cyan [&_svg]:size-4">{icon}</span>
        <span className="text-sm font-bold text-muted">{label}</span>
      </div>
      <strong className="truncate text-right text-sm text-cream">{value}</strong>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "sem registro";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}
