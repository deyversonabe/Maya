"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Bot,
  HeartPulse,
  ReceiptText,
  Send,
  ShieldCheck,
  Target,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { VisualMetric } from "@/components/ui/visual-metric";
import { AppShell } from "@/components/app/app-shell";
import { cn, financialValueClass, formatCurrency, formatPercent } from "@/lib/utils";
import { mayaFetch } from "@/lib/api-client";
import {
  buildBudgetSummary,
  buildFinancialHealthAlerts,
  buildMayaLocalAnalysis,
  calculateSummary
} from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { MayaAnalysis } from "../types";
import { FinancialHealthAlerts } from "./financial-health-alerts";

export function HomeScreen() {
  const { state } = useFinanceStore();
  const summary = calculateSummary(state);
  const maya = buildMayaLocalAnalysis(state);
  const budgetSummary = buildBudgetSummary(state, summary.currentMonth);
  const healthAlerts = buildFinancialHealthAlerts(state);

  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState(maya.message);
  const [isLoading, setIsLoading] = useState(false);

  async function askMaya(prompt: string) {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await mayaFetch("/api/maya/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, question: trimmed })
      });

      if (!response.ok) {
        throw new Error("maya_unavailable");
      }

      const nextAnalysis = (await response.json()) as MayaAnalysis;

      if (!nextAnalysis?.message) {
        throw new Error("maya_empty_response");
      }

      setReply(nextAnalysis.message);
    } catch {
      const fallback = buildMayaLocalAnalysis(state, trimmed);
      setReply(fallback.message);
    } finally {
      setIsLoading(false);
      setQuestion("");
    }
  }

  return (
    <AppShell>
      <LedPanel className="p-4 md:p-8" glow="cyan">
        <motion.div
          className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-terracotta via-bronze to-cyan-300"
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative grid gap-5 md:gap-8 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-center">
          <div>
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left md:gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7 }}
                className="relative shrink-0 animate-maya-float"
              >
                <div className="absolute inset-[-10px] -z-10 rounded-full border border-neon-cyan/25 bg-gradient-to-br from-neon-cyan/10 via-transparent to-bronze/15 shadow-neon" />
                <Image
                  src="/brand/maya-avatar-welcome.png"
                  alt="MAYA"
                  width={260}
                  height={260}
                  priority
                  className="size-32 rounded-full border border-neon-cyan/35 object-cover object-top shadow-neon drop-shadow-[0_0_28px_rgba(85,247,255,0.18)] sm:size-56 lg:size-64"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
              >
                <p className="eyebrow">Bem-vindos de volta</p>
                <h1 className="mt-2 font-serif text-3xl font-bold leading-[1.05] text-bronze md:text-6xl">
                  Ola! Eu sou a MAYA.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted md:text-base md:leading-7">
                  A assessora financeira particular do casal: precisao de dados, elegancia e um cuidado humano que acompanha cada decisao com voces.
                </p>
              </motion.div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            </div>

            <div className="mt-5 rounded-2xl border border-bronze/20 bg-cream/[0.05] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                <Bot className="size-4 text-bronze" aria-hidden="true" />
                Fale rapido com a MAYA
              </div>
              <p className="mb-3 text-sm leading-6 text-cream/90">{isLoading ? "MAYA esta pensando..." : reply}</p>
              <form
                className="grid gap-2 sm:flex"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askMaya(question);
                }}
              >
                <Input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Pergunte algo para a MAYA..."
                />
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  <Send className="size-4" aria-hidden="true" />
                  Enviar
                </Button>
              </form>
            </div>
          </div>

          <Card className="relative hidden min-h-[28rem] overflow-hidden bg-moss-900/80 xl:block">
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

      <section className="mt-4">
        <FinancialHealthAlerts alerts={healthAlerts} />
      </section>

      <section className="mt-4 hidden gap-4 md:grid md:grid-cols-3">
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
    <div className="rounded-xl border border-neon-cyan/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={cn("mt-2 block text-lg", financialValueClass(value, "text-cream"))}>{value}</strong>
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
