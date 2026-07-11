"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LedPanel } from "@/components/ui/led-panel";
import { buildDataQualityReport } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";

type SystemStatus = {
  maya: {
    available: boolean;
    level: "advanced" | "essential";
  };
  backup: {
    available: boolean;
  };
  connections: {
    status: "future";
    message: string;
  };
};

export function DataCenterPage() {
  const { state, isHydrated, actions } = useFinanceStore();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [feedback, setFeedback] = useState("Central pronta para revisar dados, backups e conexoes.");
  const quality = useMemo(() => buildDataQualityReport(state), [state]);
  const transactionCount = state.transactions.length;
  const receiptCount = state.transactions.filter((transaction) => transaction.source === "receipt").length;

  useEffect(() => {
    let isMounted = true;

    fetch("/api/system/status")
      .then((response) => response.json() as Promise<SystemStatus>)
      .then((nextStatus) => {
        if (isMounted) {
          setStatus(nextStatus);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFeedback("Nao consegui atualizar as informacoes agora. Seus dados continuam disponiveis.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `juntos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback("Backup exportado com seus dados atuais.");
  }

  function resetLocalData() {
    actions.reset();
    setFeedback("Cadastros limpos. O sistema volta a iniciar sem informacoes financeiras cadastradas.");
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="cyan">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="eyebrow">Central de Dados e Confianca</p>
            <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze">
              Seus dados, backups e privacidade.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Acompanhe o que ja foi cadastrado, exporte uma copia de seguranca e veja o que falta para a MAYA fazer
              uma leitura melhor da vida financeira do casal.
            </p>
          </div>
          <div className="rounded-2xl border border-bronze/20 bg-bronze/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Qualidade da analise</p>
            <strong className="mt-2 block font-serif text-5xl text-bronze">{quality.score}/100</strong>
            <p className="mt-2 text-sm font-bold text-cream">{quality.label}</p>
          </div>
        </div>
      </LedPanel>

      <p className="mb-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
        {isHydrated ? feedback : "Carregando informacoes..."}
      </p>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <Card>
            <CardHeader
              eyebrow="Dados"
              title="Resumo dos cadastros"
              action={<Badge tone={transactionCount > 0 ? "success" : "neutral"}>{transactionCount} lancamentos</Badge>}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <DataMetric label="Transacoes" value={String(transactionCount)} />
              <DataMetric label="Metas" value={String(state.goals.length)} />
              <DataMetric label="Orcamentos" value={String(state.budgets.length)} />
              <DataMetric label="Comprovantes" value={String(receiptCount)} />
              <DataMetric label="Atualizado em" value={state.updatedAt.slice(0, 10)} />
              <DataMetric label="Backup" value="Disponivel" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={exportBackup}>
                <Download className="size-4" aria-hidden="true" />
                Exportar backup
              </Button>
              <Button variant="danger" onClick={resetLocalData}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Limpar cadastros
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Qualidade"
              title="Base da MAYA"
              action={<Badge tone={quality.level === "consistent" ? "success" : quality.level === "partial" ? "warning" : "neutral"}>{quality.label}</Badge>}
            />
            <p className="mb-4 text-sm leading-6 text-muted">{quality.summary}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <QualityList title="Ja existe" items={quality.completed} empty="Nada concluido ainda." tone="success" />
              <QualityList title="Falta para melhorar" items={quality.missing} empty="Base suficiente para esta etapa." tone="warning" />
            </div>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="Privacidade" title="Recursos disponiveis" />
            <div className="grid gap-3">
              <StatusRow
                icon={<Sparkles />}
                label="MAYA"
                value={status?.maya.level === "advanced" ? "Analise avancada" : "Orientacao essencial"}
                detail="A assistente usa os dados cadastrados para organizar leituras, alertas e proximos passos."
                tone="success"
              />
              <StatusRow
                icon={<Database />}
                label="Backup"
                value="Manual"
                detail="Voce pode exportar uma copia dos dados sempre que quiser guardar ou atualizar o projeto."
                tone="neutral"
              />
              <StatusRow
                icon={<WalletCards />}
                label="Conexoes"
                value="Futuras"
                detail="Conectar instituicoes financeiras sera uma etapa futura e sempre dependera de autorizacao clara."
                tone="neutral"
              />
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Conexoes futuras" title="Antes de conectar uma conta" />
            <div className="grid gap-3">
              <ConsentStep title="Permissao clara" text="Voces sempre devem saber quais dados serao usados antes de qualquer conexao." />
              <ConsentStep title="Uso objetivo" text="Os dados devem servir para organizar o casal e melhorar a leitura da MAYA." />
              <ConsentStep title="Controle do casal" text="Toda conexao futura deve poder ser revisada ou cancelada." />
              <ConsentStep title="Sem movimentar dinheiro" text="O foco continua sendo organizar e orientar, nao fazer pagamentos automaticamente." />
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-1 size-5 text-bronze" aria-hidden="true" />
              <p className="text-sm leading-6 text-muted">
                O Juntos Maya usa apenas os dados que voces cadastram ou confirmam. Nenhuma despesa extraida de imagem
                e salva sem revisao.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function DataMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className="mt-2 block text-xl text-bronze">{value}</strong>
    </div>
  );
}

function QualityList({
  title,
  items,
  empty,
  tone
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "success" | "warning";
}) {
  const Icon = tone === "success" ? CheckCircle2 : CloudOff;

  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-cream">
        <Icon className={tone === "success" ? "size-4 text-emerald-200" : "size-4 text-amber-200"} aria-hidden="true" />
        {title}
      </h3>
      <div className="grid gap-2">
        {(items.length > 0 ? items : [empty]).map((item) => (
          <p key={item} className="text-sm leading-6 text-muted">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-bronze [&_svg]:size-4">{icon}</div>
        <Badge tone={tone === "success" ? "success" : tone === "warning" ? "warning" : "neutral"}>{value}</Badge>
      </div>
      <strong className="block text-cream">{label}</strong>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

function ConsentStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <div className="mb-2 flex items-center gap-2 font-black text-cyan-50">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {title}
      </div>
      <p className="text-sm leading-6 text-cyan-100">{text}</p>
    </div>
  );
}
