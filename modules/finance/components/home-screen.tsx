"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  Camera,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Database,
  BellRing,
  HeartPulse,
  ReceiptText,
  ShieldCheck,
  Target,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LedPanel } from "@/components/ui/led-panel";
import { VisualMetric } from "@/components/ui/visual-metric";
import { AppShell } from "@/components/app/app-shell";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { buildBudgetSummary, buildDataQualityReport, buildMayaLocalAnalysis, calculateSummary } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";

const actions = [
  {
    href: "/dashboard",
    icon: ChartNoAxesCombined,
    title: "Ver saude financeira",
    description: "Saldo, desempenho mensal, metas e tendencia em tempo real."
  },
  {
    href: "/months",
    icon: CalendarDays,
    title: "Ver meses",
    description: "Entradas, saidas, somas e lancamentos separados por mes."
  },
  {
    href: "/expenses",
    icon: ReceiptText,
    title: "Adicionar despesa",
    description: "Manual, recorrente, parcelada ou por foto de nota."
  },
  {
    href: "/bills",
    icon: BellRing,
    title: "Contas a pagar",
    description: "Boletos, Pix, vencimentos, anexos, alertas e status."
  },
  {
    href: "/budgets",
    icon: WalletCards,
    title: "Planejar orcamentos",
    description: "Defina limites por categoria e acompanhe saldo restante."
  },
  {
    href: "/maya",
    icon: Bot,
    title: "Falar com a MAYA",
    description: "Assistente financeira com leitura de cenario e proximos passos."
  },
  {
    href: "/data",
    icon: Database,
    title: "Central de dados",
    description: "Qualidade da analise, backup, privacidade e conexoes futuras."
  }
];

export function HomeScreen() {
  const { state } = useFinanceStore();
  const summary = calculateSummary(state);
  const maya = buildMayaLocalAnalysis(state);
  const quality = buildDataQualityReport(state);
  const budgetSummary = buildBudgetSummary(state, summary.currentMonth);

  return (
    <AppShell>
      <LedPanel className="p-5 md:p-8" glow="cyan">
        <motion.div
          className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-terracotta via-bronze to-cyan-300"
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-center">
          <div>
            <motion.h1
              className="max-w-4xl font-serif text-5xl font-bold leading-[0.98] text-bronze md:text-7xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Um centro financeiro vivo para o casal.
            </motion.h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
              Controle despesas por mes, registre parcelas e recorrencias, anexe notas pelo celular e converse com
              a MAYA para entender crescimento, queda e saude financeira sem ansiedade.
            </p>

            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChildCompat>
                <Link href="/expenses">
                  <Camera className="size-4" aria-hidden="true" />
                  Abrir despesas
                </Link>
              </Button>
              <Button variant="secondary" asChildCompat>
                <Link href="/maya">
                  Falar com MAYA
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-4">
              <VisualMetric
                label="Saude"
                value={`${maya.healthScore}/100`}
                detail="Leitura atual da MAYA."
                icon={<HeartPulse className="size-5" />}
                tone={maya.healthScore >= 70 ? "success" : "warning"}
              />
              <VisualMetric
                label="Saldo"
                value={formatCurrency(summary.availableBalance)}
                detail="Depois de despesas e investimentos."
                icon={<WalletCards className="size-5" />}
                tone={summary.availableBalance >= 0 ? "success" : "warning"}
              />
              <VisualMetric
                label="Orcamento"
                value={budgetSummary.totalLimit > 0 ? formatPercent(budgetSummary.usedPercent) : "Novo"}
                detail={budgetSummary.totalLimit > 0 ? "Do limite mensal consumido." : "Crie limites por categoria."}
                icon={<Target className="size-5" />}
                tone={budgetSummary.exceededCount > 0 ? "warning" : "info"}
              />
              <VisualMetric
                label="Qualidade"
                value={`${quality.score}/100`}
                detail={quality.label}
                icon={<Database className="size-5" />}
                tone={quality.level === "consistent" ? "success" : quality.level === "partial" ? "info" : "warning"}
              />
            </div>
          </div>

          <Card className="relative min-h-[28rem] overflow-hidden bg-moss-900/80">
            <motion.div
              className="absolute inset-x-6 top-8 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
              animate={{ y: [0, 280, 0], opacity: [0.2, 0.9, 0.2] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative grid gap-4">
              <div className="rounded-xl border border-bronze/20 bg-cream/[0.05] p-4">
                <p className="eyebrow">Resumo do casal</p>
                <strong className="mt-2 block font-serif text-4xl text-bronze">
                  {maya.trend === "growth" ? "Evoluindo" : maya.trend === "drop" ? "Ajustar rota" : "Estavel"}
                </strong>
                <p className="mt-2 text-sm leading-6 text-muted">{maya.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Receitas" value={formatCurrency(summary.income)} />
                <MiniStat label="Despesas" value={formatCurrency(summary.expenses)} />
                <MiniStat label="Metas" value={formatPercent(summary.goalsTotal > 0 ? (summary.goalsProgress / summary.goalsTotal) * 100 : 0)} />
                <MiniStat label="MAYA" value="Ativa" />
              </div>
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
                A MAYA usa os dados cadastrados por voces para orientar proximos passos com clareza e sem julgamento.
              </div>
            </div>
          </Card>
        </div>
      </LedPanel>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {actions.map((action, index) => {
          const Icon = action.icon;

          return (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Link href={action.href} className="block h-full">
                <Card className="h-full transition hover:-translate-y-1 hover:border-bronze/40 hover:bg-moss-700/60">
                  <div className="mb-5 grid size-12 place-items-center rounded-xl border border-bronze/20 bg-bronze/10 text-bronze">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="section-title">{action.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted">{action.description}</p>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Feature icon={<ReceiptText />} title="Despesas por mes" text="Filtros mensais, recorrencias e parcelas aparecem exatamente no mes correto." />
        <Feature icon={<WalletCards />} title="Orcamentos" text="Limites por categoria mostram o quanto ainda pode ser gasto com tranquilidade." />
        <Feature icon={<Target />} title="Metas do casal" text="Acompanhe reserva, viagens, patrimonio e sonhos com progresso claro." />
        <Feature icon={<ShieldCheck />} title="Seguro por padrao" text="Comprovantes viram rascunhos revisaveis antes de qualquer despesa ser salva." />
      </section>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className="mt-2 block text-lg text-cream">{value}</strong>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card>
      <div className="mb-4 text-bronze [&_svg]:size-5">{icon}</div>
      <h2 className="font-serif text-xl font-bold text-bronze">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </Card>
  );
}
